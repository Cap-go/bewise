import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { initTransitions } from '@capgo/capacitor-transitions/vue'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { createApp } from 'vue'
import pkg from '../package.json'
import App from './App.vue'
import { i18n, onLocaleChange, setLocale } from './i18n'
import { loadCategories } from './lib/catalog'
import { setupChrome } from './lib/chrome'
import { scheduleReminder } from './lib/reminder'
import { loadState, state } from './lib/state'
import { router } from './router'
import '@capgo/capacitor-transitions'
import './style.css'

async function start() {
  // Tell Capgo this bundle booted fine, otherwise it rolls back to the previous one.
  void CapacitorUpdater.notifyAppReady().catch(() => {})
  if (!Capacitor.isNativePlatform())
    document.documentElement.classList.add('web-chrome')
  else
    void StatusBar.setStyle({ style: Style.Dark }).catch(() => {})

  await loadState(pkg.version)
  // Re-word the daily notification when the phone's language changed.
  onLocaleChange((lang) => {
    if (state.reminder && i18n.global.te('settings.notifTitle', lang) && localStorage.getItem('bewise.reminder.lang') !== lang) {
      localStorage.setItem('bewise.reminder.lang', lang)
      void scheduleReminder(state.reminderTime)
    }
  })
  // First launch in a new language: give the translation a moment before showing English.
  await Promise.race([setLocale(state.lang), new Promise(resolve => setTimeout(resolve, 1500))])
  void loadCategories()

  // Store screenshot automation: `defaults write ee.forgr.bewise CapacitorStorage.bewise.route /archive`
  if (import.meta.env.VITE_SCREENSHOTS) {
    const { Preferences } = await import('@capacitor/preferences')
    const { value } = await Preferences.get({ key: 'bewise.route' })
    if (value)
      await router.replace(value)
  }

  initTransitions({ platform: 'auto' })
  const app = createApp(App).use(i18n).use(router)
  await router.isReady()
  app.mount('#app')
  await setupChrome(router)
}

void start()
