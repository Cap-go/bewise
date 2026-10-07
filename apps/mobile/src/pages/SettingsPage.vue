<script setup lang="ts">
import { Browser } from '@capacitor/browser'
import { Clipboard } from '@capacitor/clipboard'
import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { CapgoInAppReview } from '@capgo/capacitor-in-app-review'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import PageShell from '~/components/PageShell.vue'
import PageTitle from '~/components/PageTitle.vue'
import SettingsGroup from '~/components/SettingsGroup.vue'
import SettingsRow from '~/components/SettingsRow.vue'
import { setLocale } from '~/i18n'
import { API_URL } from '~/lib/api'
import { push } from '~/lib/chrome'
import { haptic, showToast } from '~/lib/feedback'
import { cancelReminder, scheduleReminder } from '~/lib/reminder'
import { LANGS, state } from '~/lib/state'
import pkg from '../../package.json'

const { t } = useI18n()
const router = useRouter()
const bundle = ref('')
const isIos = Capacitor.getPlatform() === 'ios'

const icon = (body: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">${body}</svg>`
const icons = {
  key: icon('<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>'),
  shortcut: icon('<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>'),
  star: icon('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
  share: icon('<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/>'),
  help: icon('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>'),
  lock: icon('<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  code: icon('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
  sparkles: icon('<path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/>'),
}

function chooseLang(id: string) {
  void haptic.select()
  state.lang = id
  setLocale(id)
  if (state.reminder)
    void scheduleReminder(state.reminderTime)
}

async function toggleReminder() {
  void haptic.select()
  if (state.reminder) {
    state.reminder = false
    await cancelReminder()
    return
  }
  state.reminder = await scheduleReminder(state.reminderTime)
  if (!state.reminder)
    showToast(t('settings.notifDenied'))
}

async function changeTime(event: Event) {
  state.reminderTime = (event.target as HTMLInputElement).value || '08:00'
  if (state.reminder)
    await scheduleReminder(state.reminderTime)
}

async function copyKey() {
  void haptic.tap()
  await Clipboard.write({ string: state.userId })
  showToast(t('settings.apiKeyCopied'))
}

const open = (url: string) => Browser.open({ url })

async function shortcut() {
  const settings = await fetch(`${API_URL}/v1/settings`).then(r => r.json()).catch(() => ({})) as { shortcutUrl?: string }
  await open(settings.shortcutUrl ?? 'https://bewise.love/shortcut')
}

async function rate() {
  void haptic.tap()
  await CapgoInAppReview.requestReview().catch(() => open('https://apps.apple.com/app/id1448918843?action=write-review'))
}

async function shareApp() {
  await Share.share({ text: t('settings.shareAppText') }).catch(() => {})
}

onMounted(async () => {
  try {
    const { bundle: current } = await CapacitorUpdater.current()
    bundle.value = ['builtin', pkg.version].includes(current.version) ? '' : current.version
  }
  catch {}
})
</script>

<template>
  <PageShell tab="settings">
    <div class="page-scroll mx-auto max-w-2xl space-y-7">
      <PageTitle :title="t('settings.title')" />

      <SettingsGroup :title="t('settings.language')">
        <SettingsRow v-for="lang in LANGS" :key="lang.id" :label="lang.name" @click="chooseLang(lang.id)">
          <svg v-if="state.lang === lang.id" viewBox="0 0 24 24" class="size-5 text-sky" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup :title="t('settings.reminder')" :footer="t('settings.reminderDesc')">
        <SettingsRow :label="t('settings.reminder')" @click="toggleReminder">
          <span
            role="switch"
            :aria-checked="state.reminder"
            class="relative h-[31px] w-[51px] rounded-full transition-colors"
            :class="state.reminder ? 'bg-sky' : 'bg-white/15'"
          >
            <span class="absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow transition-transform" :class="state.reminder ? 'translate-x-5' : ''" />
          </span>
        </SettingsRow>
        <label v-if="state.reminder" class="flex min-h-14 items-center px-4">
          <span class="flex-1 text-[1.02rem]">{{ t('settings.reminderTime') }}</span>
          <input type="time" :value="state.reminderTime" class="rounded-xl bg-ink-3 px-3 py-1.5 text-white" @change="changeTime">
        </label>
      </SettingsGroup>

      <SettingsGroup :footer="t('settings.shortcutDesc')">
        <SettingsRow v-if="isIos" :label="t('settings.shortcut')" :icon="icons.shortcut" tint="#5e5ce6" chevron @click="shortcut" />
        <SettingsRow :label="t('settings.apiKey')" :value="`${state.userId.slice(0, 8)}…`" :icon="icons.key" tint="#0a84ff" @click="copyKey" />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow :label="t('settings.howItWorks')" :icon="icons.sparkles" tint="#bf5af2" chevron @click="push(router, '/welcome')" />
        <SettingsRow :label="t('settings.rate')" :icon="icons.star" tint="#ff9f0a" chevron @click="rate" />
        <SettingsRow :label="t('settings.shareApp')" :icon="icons.share" tint="#30d158" chevron @click="shareApp" />
        <SettingsRow :label="t('settings.support')" :icon="icons.help" tint="#00c0ff" chevron @click="open('https://bewise.love/support')" />
        <SettingsRow :label="t('settings.privacy')" :icon="icons.lock" tint="#8e8e93" chevron @click="open('https://bewise.love/privacy')" />
        <SettingsRow label="GitHub" :icon="icons.code" tint="#24292f" chevron @click="open('https://github.com/Cap-go/bewise')" />
      </SettingsGroup>

      <div class="px-8 text-center">
        <img src="/app-icon.png" alt="" class="mx-auto size-14 rounded-2xl">
        <p class="mt-3 text-sm font-semibold">
          BeWise {{ pkg.version }}<span v-if="bundle" class="text-white/40"> · {{ bundle }}</span>
        </p>
        <p class="mt-1 text-[0.8rem] leading-relaxed text-white/40">
          {{ t('settings.madeBy') }}
        </p>
        <button
          class="pressable mx-auto mt-5 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 pr-4 pl-1.5 text-[0.85rem] font-semibold text-white/80"
          @click="open('https://capgo.app/?ref=bewise')"
        >
          <img src="/capgo.svg" alt="" class="size-6 rounded-full">
          {{ t('settings.madeWith') }}
        </button>
      </div>
    </div>
  </PageShell>
</template>
