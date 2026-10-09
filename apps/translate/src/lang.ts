// Shared by the translate worker and its seed script.

export type Kind = 'quote' | 'category' | 'ui'

const displayNames = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' })

/**
 * Reduce any device locale to the language we translate into: the base
 * language, plus the script for Chinese and the variant for Portuguese, where
 * the written language really differs. Unknown input falls back to English.
 */
export function normalizeLang(input: string | null | undefined): string {
  try {
    const locale = new Intl.Locale(Intl.getCanonicalLocales(input || 'en')[0])
    const lang = locale.language
    if (lang === 'zh')
      return `zh-${locale.script ?? (['TW', 'HK', 'MO'].includes(locale.region ?? '') ? 'Hant' : 'Hans')}`
    if (lang === 'pt')
      return locale.region === 'PT' ? 'pt-PT' : 'pt-BR'
    return displayNames.of(lang) ? lang : 'en'
  }
  catch {
    return 'en'
  }
}

/** English name of a normalized language, for the model prompt. */
export function languageName(lang: string): string {
  return displayNames.of(lang) ?? lang
}

export async function cacheKey(kind: Kind, lang: string, text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
  return `${kind}:${lang}:${hex.slice(0, 40)}`
}
