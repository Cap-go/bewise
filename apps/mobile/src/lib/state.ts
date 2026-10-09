import { Capacitor } from '@capacitor/core'
import { Device } from '@capacitor/device'
import { Preferences } from '@capacitor/preferences'
import { reactive, watch } from 'vue'
import { normalizeLang } from '../../../translate/src/lang'
import { api } from './api'

export interface AppState {
  userId: string
  category: string
  /** Always the phone's language; content is translated from English for it. */
  lang: string
  reminder: boolean
  reminderTime: string
  /** Finished the first-launch walkthrough. */
  onboarded: boolean
}

/** WKWebView reports the app's own localization (English), not the phone's: ask the OS. */
async function deviceLang(): Promise<string> {
  const tag = await Device.getLanguageTag().then(r => r.value).catch(() => navigator.language)
  return normalizeLang(tag)
}

export const state = reactive<AppState>({
  userId: '',
  category: 'inspire',
  lang: normalizeLang(navigator.language),
  reminder: false,
  reminderTime: '08:00',
  onboarded: false,
})

const KEY = 'bewise.state'

/**
 * Users upgrading from the 2.x app keep their identity: their anonymous
 * Supabase user id (also their Shortcut "API key") and theme were stored in
 * WebView localStorage, which survives the update.
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
  if (category)
    legacy.category = category
  return legacy
}

export async function loadState(appVersion: string) {
  const { value } = await Preferences.get({ key: KEY })
  const saved = value ? JSON.parse(value) as Partial<AppState> : legacyState()
  Object.assign(state, saved, { lang: await deviceLang() })
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
