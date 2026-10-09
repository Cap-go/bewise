import type { Kind } from './lang'
import { WorkerEntrypoint } from 'cloudflare:workers'
import { cacheKey, languageName, normalizeLang } from './lang'

// BeWise stores English only. This worker translates quotes, theme names and
// app strings into any language on demand with Workers AI, and caches every
// string in KV forever, so each text is translated once per language.
// It has no public route: bewise-api calls it through a service binding.

interface Env {
  AI: Ai
  TRANSLATIONS: KVNamespace
  MODEL: string
}

// Long quotes in big batches make the model skip items: keep them small.
const BATCH: Record<Kind, number> = { quote: 5, category: 20, ui: 20 }
const MAX_TEXTS = 100
const MAX_LENGTH = 2000
/** Seconds before retrying a text the model failed to translate. */
const RETRY_AFTER = 86400

const INSTRUCTIONS: Record<Kind, string> = {
  quote: 'Each item is a famous quote shown in BeWise, a daily wisdom app. Render it the way a published translation reads: faithful meaning, natural phrasing, same tone and rhythm. When a well-known translation of the quote exists in the target language, use it. Do not add quotation marks, notes, or the author name.',
  category: 'Each item names a theme of quotes in a daily quote app (the app shows quotes about Love, Life, Art...). Translate each theme name as the common, natural word a native speaker would use as a category label; never transliterate English words.',
  ui: 'Each item is an interface string of BeWise, an iOS and Android app showing one quote a day. Translate concisely and naturally, the way a well-made native app in the target language phrases it. Keep the brand and product names BeWise, Capgo, Capacitor, iOS, iPhone, Android and Shortcuts, URLs, emoji, and line breaks.',
}

interface Source { text: string, context?: string }

const PLACEHOLDER_RE = /\{\w+\}/g
// Writing systems of languages whose script code covers several Unicode scripts.
const SCRIPTS: Record<string, string[]> = { Hans: ['Han'], Hant: ['Han'], Jpan: ['Han', 'Hira', 'Kana'], Kore: ['Hang', 'Han'] }

function placeholders(text: string): string {
  return [...text.matchAll(PLACEHOLDER_RE)].map(m => m[0]).sort().join()
}

function squash(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

function script(lang: string): string | undefined {
  try {
    return new Intl.Locale(lang).maximize().script
  }
  catch {
    return undefined
  }
}

/** Letters outside the target language's script (Latin is always fine: names, brands). */
function foreignLetters(lang: string): RegExp | undefined {
  const code = script(lang)
  if (!code)
    return undefined
  const scripts = new Set(['Latin', 'Common', ...(SCRIPTS[code] ?? [code])])
  try {
    return new RegExp(`[^\\P{L}${[...scripts].map(s => `\\p{Script_Extensions=${s}}`).join('')}]`, 'u')
  }
  catch {
    return undefined
  }
}

/** Catch the model's usual misses: echoing the English, or mixing in another script. */
function untranslated(source: string, value: string, lang: string): boolean {
  const sentence = source.trim().split(/\s+/).length >= 3
  const latinTarget = script(lang) === 'Latn'
  if (value.trim() === source.trim() && (sentence || !latinTarget))
    return true
  // Smaller models sometimes leak words of another language (Chinese, Korean...).
  if (foreignLetters(lang)?.test(value))
    return true
  if (sentence && !latinTarget) {
    const letters = value.match(/\p{L}/gu)?.length ?? 0
    const latin = value.match(/\p{Script=Latin}/gu)?.length ?? 0
    return letters > 0 && latin / letters > 0.5
  }
  return false
}

function aiText(result: unknown): unknown {
  const response = (result as { response?: unknown } | null)?.response ?? result
  if (typeof response !== 'string')
    return response
  try {
    return JSON.parse(response.replace(/^```(?:json)?\s*|\s*```$/g, ''))
  }
  catch {
    return null
  }
}

export default class Translate extends WorkerEntrypoint<Env> {
  override async fetch() {
    return new Response('Not found', { status: 404 })
  }

  /**
   * Translate English `texts` into `lang`, in order. English input, unknown
   * languages and texts the model can't translate safely come back unchanged.
   * `contexts` optionally tells the model where each text appears (e.g. "tabs.archive").
   */
  async translate(texts: string[], lang: string, kind: Kind = 'ui', contexts: string[] = []): Promise<string[]> {
    const target = normalizeLang(lang)
    if (target === 'en' || texts.length === 0)
      return texts
    if (texts.length > MAX_TEXTS)
      throw new Error(`at most ${MAX_TEXTS} texts per call`)

    const unique = [...new Set(texts.filter(t => t.trim() && t.length <= MAX_LENGTH))]
    const contextOf = new Map(texts.map((t, i) => [t, contexts[i]]))
    const keys = await Promise.all(unique.map(t => cacheKey(kind, target, t)))
    const cached = await Promise.all(keys.map(k => this.env.TRANSLATIONS.get(k, { cacheTtl: 3600 })))
    const found = new Map<string, string>()
    const missing: number[] = []
    // An empty value marks a recent failure: serve English until it expires.
    cached.forEach((value, i) => value === null ? missing.push(i) : value && found.set(unique[i], value))

    const batches: number[][] = []
    for (let start = 0; start < missing.length; start += BATCH[kind])
      batches.push(missing.slice(start, start + BATCH[kind]))
    await Promise.all(batches.map(async (batch) => {
      const translated = await this.translateBatch(batch.map(i => ({ text: unique[i], context: contextOf.get(unique[i]) })), target, kind)
      await Promise.all(batch.map(async (i, j) => {
        const value = translated[j]
        if (value === null)
          return this.env.TRANSLATIONS.put(keys[i], '', { expirationTtl: RETRY_AFTER })
        found.set(unique[i], value)
        await this.env.TRANSLATIONS.put(keys[i], value)
      }))
    }))
    return texts.map(t => found.get(t) ?? t)
  }

  /** One model call for the batch; failed items are retried one by one. */
  private async translateBatch(texts: Source[], lang: string, kind: Kind): Promise<(string | null)[]> {
    const out = await this.ask(texts, lang, kind)
    if (texts.length === 1)
      return out
    return Promise.all(out.map(async (value, i) => value ?? (await this.ask([texts[i]], lang, kind))[0]))
  }

  private async ask(items: Source[], lang: string, kind: Kind): Promise<(string | null)[]> {
    const texts = items.map(item => item.text)
    const language = languageName(lang)
    try {
      const result = await this.env.AI.run(this.env.MODEL as Parameters<Ai['run']>[0], {
        temperature: 0.2,
        max_tokens: 4096,
        response_format: {
          type: 'json_schema',
          json_schema: {
            type: 'object',
            properties: {
              translations: {
                type: 'array',
                items: { type: 'object', properties: { source: { type: 'string' }, translation: { type: 'string' } }, required: ['source', 'translation'] },
                minItems: texts.length,
                maxItems: texts.length,
              },
            },
            required: ['translations'],
          },
        },
        messages: [
          {
            role: 'system',
            content: [
              `You are a professional translator from English into ${language} (${lang}).`,
              INSTRUCTIONS[kind],
              'The input is a JSON array of {"text", "context"} objects: translate "text"; "context", when present, tells where it appears in the app.',
              'Keep every placeholder written in curly braces, like {time}, exactly as it is.',
              `Reply with a JSON object {"translations": [{"source": "...", "translation": "..."}]} with one entry for each of the ${texts.length} input strings: "source" copies the English input exactly, "translation" is its ${language} translation.`,
            ].join(' '),
          },
          { role: 'user', content: JSON.stringify(items) },
        ],
      } as never)
      const translations = (aiText(result) as { translations?: unknown } | null)?.translations
      if (!Array.isArray(translations))
        throw new Error('no translations')
      // In batches the model can shift translations between items: match each
      // one to its input through the echoed source instead of trusting order.
      const bySource = new Map<string, unknown>()
      for (const item of translations as { source?: unknown, translation?: unknown }[]) {
        if (typeof item?.source === 'string')
          bySource.set(squash(item.source), item.translation)
      }
      return texts.map((source) => {
        const value = texts.length === 1 ? (translations[0] as { translation?: unknown } | undefined)?.translation : bySource.get(squash(source))
        if (typeof value !== 'string' || !value.trim() || placeholders(value) !== placeholders(source) || untranslated(source, value, lang))
          return null
        // Models like to wrap quotes in quotation marks; the app adds its own.
        return kind === 'quote' ? value.trim().replace(/^["“”«»„「『\s]+|["“”«»」』\s]+$/g, '') : value.trim()
      })
    }
    catch (error) {
      console.warn('translation failed', { lang, kind, count: texts.length, error: String(error) })
      return texts.map(() => null)
    }
  }
}
