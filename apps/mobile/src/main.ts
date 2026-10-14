import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { initTransitions } from '@capgo/capacitor-transitions/vue'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { createApp, watch } from 'vue'
import pkg from '../package.json'
import App from './App.vue'
import { i18n, onLocaleChange, setLocale } from './i18n'
import { loadCategories } from './lib/catalog'
import { setupChrome, switchTab } from './lib/chrome'
import { refreshReminder } from './lib/reminder'
import { trackFirstLaunch } from './lib/review'
import { deviceLang, loadState, state } from './lib/state'
import { refreshWidget } from './lib/widget'
import { router } from './router'
import '@capgo/capacitor-transitions'
import './style.css'

async function start() {
  const native = Capacitor.isNativePlatform()
  if (!native)
    document.documentElement.classList.add('web-chrome')
  else
    void StatusBar.setStyle({ style: Style.Dark }).catch(() => {})

  await loadState(pkg.version)
  trackFirstLaunch()
  // Translations arrived or the language changed: re-word the reminders and the widget label.
  onLocaleChange(() => {
    void refreshReminder()
    refreshWidget()
  })
  // First launch in a new language: give the translation a moment before showing English.
  await Promise.race([setLocale(state.lang), new Promise(resolve => setTimeout(resolve, 1500))])
  watch(() => state.lang, lang => void setLocale(lang))
  void loadCategories()
  // Replaces the repeating alarm of older builds and keeps 30 days planned ahead.
  void refreshReminder()
  watch(() => state.reminderTime, () => void refreshReminder())

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

  if (native) {
    // The phone's language can change while BeWise sits in the background.
    void CapApp.addListener('resume', async () => {
      state.lang = await deviceLang()
    })
    // Tapping the daily reminder opens today's quote, wherever the app was left.
    void LocalNotifications.addListener('localNotificationActionPerformed', () => {
      if (state.onboarded && router.currentRoute.value.path !== '/today')
        void switchTab(router, '/today')
    })
  }

  // Only now is this bundle known to start: Capgo rolls back an update that never gets here.
  void CapacitorUpdater.notifyAppReady().catch(() => {})
  // Pages hide the splash once their content is ready; never leave it up if one fails to.
  setTimeout(() => void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {}), 4000)
}

void start()
