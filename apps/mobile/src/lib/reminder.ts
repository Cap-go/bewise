import { LocalNotifications } from '@capacitor/local-notifications'
import { i18n } from '~/i18n'

const REMINDER_ID = 1

/** Returns false when the user denied notification permission. */
export async function scheduleReminder(time: string): Promise<boolean> {
  let { display } = await LocalNotifications.checkPermissions()
  if (display !== 'granted')
    ({ display } = await LocalNotifications.requestPermissions())
  if (display !== 'granted')
    return false

  const [hour, minute] = time.split(':').map(Number)
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] }).catch(() => {})
  await LocalNotifications.schedule({
    notifications: [{
      id: REMINDER_ID,
      title: i18n.global.t('settings.notifTitle'),
      body: i18n.global.t('settings.notifBody'),
      schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
      // Inexact is fine for a daily nudge and needs no special Android permission.
      isExactNotification: false,
    }],
  })
  return true
}

export async function cancelReminder() {
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] }).catch(() => {})
}
