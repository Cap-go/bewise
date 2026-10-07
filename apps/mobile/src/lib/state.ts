import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { reactive, watch } from 'vue'
import { api } from './api'

export const LANGS = [
  { id: 'en', name: 'English' },
  { id: 'fr', name: 'Français' },
  { id: 'es', name: 'Español' },
  { id: 'de', name: 'Deutsch' },
  { id: 'it', name: 'Italiano' },
] as const

export interface AppState {
  userId: string
  category: string
  lang: string
  reminder: boolean
  reminderTime: string
}

function deviceLang(): string {
  const short = (navigator.language || 'en').slice(0, 2).toLowerCase()
  return LANGS.some(l => l.id === short) ? short : 'en'
}

export const state = reactive<AppState>({
  userId: '',
  category: 'inspire',
  lang: deviceLang(),
  reminder: false,
  reminderTime: '08:00',
})

const KEY = 'bewise.state'

/**
 * Users upgrading from the 2.x app keep their identity: their anonymous
 * Supabase user id (also their Shortcut "API key"), theme and language were
 * stored in WebView localStorage, which survives the update.
 */
function legacyState(): Partial<AppState> {
  const legacy: Partial<AppState> = {}
  try {
    const session = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    const id = session && JSON.parse(localStorage.getItem(session) ?? '{}')?.user?.id
    if (typeof id === 'string')
      legacy.userId = id
  }
  catch {}
  const category = localStorage.getItem('category')
  const lang = localStorage.getItem('language')
  if (category)
    legacy.category = category
  if (lang && LANGS.some(l => l.id === lang))
    legacy.lang = lang
  return legacy
}

export async function loadState(appVersion: string) {
  const { value } = await Preferences.get({ key: KEY })
  const saved = value ? JSON.parse(value) as Partial<AppState> : legacyState()
  Object.assign(state, saved)
  if (!state.userId)
    state.userId = crypto.randomUUID()

  watch(state, () => {
    void Preferences.set({ key: KEY, value: JSON.stringify(state) })
  }, { deep: true, immediate: !value })

  const sync = () => api.saveUser(state.userId, {
    category: state.category,
    lang: state.lang,
    platform: Capacitor.getPlatform(),
    appVersion,
  }).catch(() => {})
  void sync()
  watch(() => [state.category, state.lang], sync)
}
