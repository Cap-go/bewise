import type { Quote } from './api'
import { Capacitor } from '@capacitor/core'
import { CapgoWidgetKit } from '@capgo/capacitor-widget-kit'
import { i18n } from '~/i18n'
import { API_URL } from './api'
import { categoryName } from './catalog'
import { state } from './state'

// Shared with the native widgets (ios/App/BeWiseWidget, android BeWiseWidgetProvider).
const WIDGET_ID = 'bewise-daily'
const WIDGET_KIND = 'BeWiseQuoteWidget'

/**
 * Hand today's quote and the reader's preferences to the home/lock screen
 * widgets through Capgo Widget Kit's shared store, then refresh them.
 * The widgets fetch the next day's quote themselves, so they stay current
 * even when the app is not opened.
 */
export async function syncWidget(quote: Quote) {
  // Builds released before widgets shipped don't have the native plugin.
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('CapgoWidgetKit'))
    return
  try {
    await CapgoWidgetKit.startWidgetSession({
      widgetId: WIDGET_ID,
      kind: WIDGET_KIND,
      state: {
        apiUrl: API_URL,
        user: state.userId,
        category: state.category,
        categoryName: categoryName(quote.category),
        lang: state.lang,
        eyebrow: i18n.global.t('today.eyebrow'),
        quote: {
          id: quote.id,
          date: quote.date,
          text: quote.text,
          author: quote.author,
          img: quote.img ?? '',
        },
      },
    })
    await CapgoWidgetKit.reloadWidgets({ kind: WIDGET_KIND })
  }
  catch (error) {
    console.warn('widget sync failed', error)
  }
}
