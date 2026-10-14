// Shared by the translate worker, its scripts and bewise-api.

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

/**
 * Languages the model translates well enough to show: every language of the
 * App Store and Google Play listings (store/metadata), plus other widely
 * spoken ones. Any other language is served in English, without a model call.
 */
export const MACHINE_LANGS = new Set([
  // Store listings
  'af',
  'am',
  'ar',
  'az',
  'be',
  'bg',
  'bn',
  'ca',
  'cs',
  'da',
  'de',
  'el',
  'es',
  'et',
  'eu',
  'fa',
  'fi',
  'fil',
  'fr',
  'gl',
  'gu',
  'he',
  'hi',
  'hr',
  'hu',
  'hy',
  'id',
  'is',
  'it',
  'ja',
  'ka',
  'kk',
  'km',
  'kn',
  'ko',
  'ky',
  'lo',
  'lt',
  'lv',
  'mk',
  'ml',
  'mn',
  'mr',
  'ms',
  'my',
  'nb',
  'ne',
  'nl',
  'no',
  'or',
  'pa',
  'pl',
  'pt',
  'rm',
  'ro',
  'ru',
  'si',
  'sk',
  'sl',
  'sq',
  'sr',
  'sv',
  'sw',
  'ta',
  'te',
  'th',
  'tr',
  'uk',
  'ur',
  'vi',
  'zh',
  'zu',
  // Other widely spoken languages
  'as',
  'bs',
  'ckb',
  'cy',
  'eo',
  'fy',
  'ga',
  'gd',
  'ha',
  'ht',
  'ig',
  'jv',
  'ku',
  'la',
  'lb',
  'mg',
  'mt',
  'nn',
  'om',
  'ps',
  'rw',
  'sd',
  'so',
  'su',
  'tg',
  'ti',
  'tk',
  'tl',
  'tt',
  'ug',
  'uz',
  'xh',
  'yi',
  'yo',
])

/** Whether a normalized language gets machine translations (English needs none). */
export function machineTranslated(lang: string): boolean {
  return lang !== 'en' && MACHINE_LANGS.has(lang.split('-')[0])
}

/**
 * Translation revision per kind. Bump one when its prompt or the model changes
 * enough that cached translations should be redone: new entries get new keys
 * and the old ones are simply no longer read (they never expire, delete them
 * with scripts/purge.ts if needed). Revision 1 is the original key format.
 */
export const REVISION: Record<Kind, number> = { quote: 1, category: 1, ui: 1 }

/**
 * Human translations from the old app were seeded at revision 1 in these
 * languages (scripts/seed.ts): later revisions still fall back to them.
 */
export const SEEDED_LANGS = new Set(['fr', 'es', 'de', 'it'])

export async function cacheKey(kind: Kind, lang: string, text: string, revision = REVISION[kind]): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
  const key = `${kind}:${lang}:${hex.slice(0, 40)}`
  return revision > 1 ? `${key}:r${revision}` : key
}
