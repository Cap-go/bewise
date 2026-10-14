import type { Quote } from './api'
import { LocalNotifications } from '@capacitor/local-notifications'
import { i18n } from '~/i18n'
import { addDays, localDay } from './api'
import { state } from './state'
import { readJSON, writeJSON } from './storage'

// The daily reminder is a run of one-shot notifications instead of one
// repeating alarm, so the ones for days whose quote we already know can carry
// the quote itself. Re-planned every time the app loads a quote.

/** Id of the repeating reminder used by builds before 3.1. */
const LEGACY_ID = 1
const FIRST_ID = 100
const DAYS = 30
const QUOTES = 'bewise.reminder.quotes'

type KnownQuotes = Record<string, { text: string, author: string, lang: string }>

const ids = () => [LEGACY_ID, ...Array.from({ length: DAYS }, (_, i) => FIRST_ID + i)].map(id => ({ id }))

function excerpt(quote: { text: string, author: string }) {
  const text = quote.text.trim().length > 170 ? `${quote.text.trim().slice(0, 167).trimEnd()}…` : quote.text.trim()
  return quote.author.trim() ? `“${text}” — ${quote.author.trim()}` : `“${text}”`
}

async function plan(time: string) {
  const [hour = 8, minute = 0] = time.split(':').map(Number)
  const known = readJSON<KnownQuotes>(QUOTES, {})
  const now = new Date()
  const today = localDay(now)
  const notifications = []
  for (let i = 0; i < DAYS + 1 && notifications.length < DAYS; i++) {
    const day = addDays(today, i)
    const at = new Date(`${day}T00:00:00`)
    at.setHours(hour, minute, 0, 0)
    if (at <= now)
      continue
    const quote = known[day]?.lang === state.lang ? known[day] : undefined
    notifications.push({
      id: FIRST_ID + notifications.length,
      title: i18n.global.t('settings.notifTitle'),
      body: quote ? excerpt(quote) : i18n.global.t('settings.notifBody'),
      schedule: { at, allowWhileIdle: true },
      extra: { route: '/today' },
      // Inexact is fine for a daily nudge and needs no special Android permission.
      isExactNotification: false,
    })
  }
  await LocalNotifications.cancel({ notifications: ids() }).catch(() => {})
  await LocalNotifications.schedule({ notifications })
}

/** Asks for permission if needed. Returns false when the user denied it. */
export async function scheduleReminder(time: string): Promise<boolean> {
  let { display } = await LocalNotifications.checkPermissions()
  if (display !== 'granted')
    ({ display } = await LocalNotifications.requestPermissions())
  if (display !== 'granted')
    return false
  await plan(time)
  return true
}

/** Re-plan without prompting: after a new quote, a language change, or at launch. */
export async function refreshReminder() {
  if (!state.reminder)
    return
  const { display } = await LocalNotifications.checkPermissions().catch(() => ({ display: 'denied' }))
  if (display === 'granted')
    await plan(state.reminderTime).catch(error => console.warn('reminder planning failed', error))
}

/** Remember the quote of `quote.date` so that day's reminder can show it. */
export function rememberQuote(quote: Quote) {
  const today = localDay()
  const known = readJSON<KnownQuotes>(QUOTES, {})
  for (const day of Object.keys(known)) {
    if (day < today)
      delete known[day]
  }
  const previous = known[quote.date]
  if (previous?.text === quote.text && previous.lang === state.lang)
    return false
  known[quote.date] = { text: quote.text, author: quote.author, lang: state.lang }
  writeJSON(QUOTES, known)
  return true
}

export async function cancelReminder() {
  await LocalNotifications.cancel({ notifications: ids() }).catch(() => {})
}

export async function notificationsDenied(): Promise<boolean> {
  const { display } = await LocalNotifications.checkPermissions().catch(() => ({ display: 'granted' }))
  return display === 'denied'
}
