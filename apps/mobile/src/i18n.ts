import { createI18n } from 'vue-i18n'
import de from './locales/de.json'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import it from './locales/it.json'

export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en, fr, es, de, it },
})

const listeners = new Set<(lang: string) => void>()

export function onLocaleChange(fn: (lang: string) => void) {
  listeners.add(fn)
}

export function setLocale(lang: string) {
  i18n.global.locale.value = lang as typeof i18n.global.locale.value
  document.documentElement.lang = lang
  listeners.forEach(fn => fn(lang))
}
