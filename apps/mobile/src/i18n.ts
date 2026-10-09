import { createI18n } from 'vue-i18n'
import { API_URL } from './lib/api'
import en from './locales/en.json'

// The app ships English only. Any other language is translated by the API
// (bewise-translate) from this same en.json and cached on the device.

interface Messages { [key: string]: string | Messages }

export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: { en } as Record<string, Messages>,
})

/** Changes whenever en.json changes, so cached translations get refreshed. */
const SOURCE_HASH = (() => {
  let h = 5381
  for (const c of JSON.stringify(en))
    h = Math.imul(h, 33) ^ c.charCodeAt(0)
  return (h >>> 0).toString(36)
})()

const listeners = new Set<(lang: string) => void>()

export function onLocaleChange(fn: (lang: string) => void) {
  listeners.add(fn)
}

const RTL = /^(?:ar|he|fa|ur|ps|sd|ug|yi|dv|ckb)\b/

function apply(lang: string, messages?: Messages) {
  if (messages)
    i18n.global.setLocaleMessage(lang, messages)
  i18n.global.locale.value = lang
  document.documentElement.lang = lang
  document.documentElement.dir = RTL.test(lang) ? 'rtl' : 'ltr'
  listeners.forEach(fn => fn(lang))
}

function covers(messages: Messages, source: Messages): boolean {
  return Object.entries(source).every(([key, value]) => typeof value === 'string'
    ? typeof messages[key] === 'string'
    : typeof messages[key] === 'object' && covers(messages[key] as Messages, value))
}

/**
 * Switch the UI to `lang`. Cached translations apply at once; otherwise the
 * returned promise resolves when the API answered (English shows until then).
 */
export async function setLocale(lang: string) {
  if (lang === 'en')
    return apply('en')
  const key = `bewise.i18n.${lang}`
  const cached = JSON.parse(localStorage.getItem(key) ?? 'null') as { hash: string, messages: Messages } | null
  if (cached)
    apply(lang, cached.messages)
  if (cached?.hash === SOURCE_HASH)
    return
  try {
    const res = await fetch(`${API_URL}/v1/i18n/${encodeURIComponent(lang)}?v=${SOURCE_HASH}`)
    if (!res.ok)
      throw new Error(String(res.status))
    const { messages } = await res.json() as { messages: Messages }
    apply(lang, messages)
    // Keep partial answers (API older than this bundle) out of the cache so they get fetched again.
    if (covers(messages, en))
      localStorage.setItem(key, JSON.stringify({ hash: SOURCE_HASH, messages }))
  }
  catch (error) {
    console.warn('translations unavailable', lang, error)
    if (!cached)
      apply(lang)
  }
}
