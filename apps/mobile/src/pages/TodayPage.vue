<script setup lang="ts">
import type { Quote } from '~/lib/api'
import { App } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PageShell from '~/components/PageShell.vue'
import QuoteHero from '~/components/QuoteHero.vue'
import { addDays, api, localDay } from '~/lib/api'
import { bundledQuote } from '~/lib/bundled'
import { categoryName } from '~/lib/catalog'
import { adoptVote } from '~/lib/loved'
import { refreshReminder, rememberQuote } from '~/lib/reminder'
import { state } from '~/lib/state'
import { readJSON, writeJSON } from '~/lib/storage'
import { syncWidget } from '~/lib/widget'

const { t } = useI18n()
const quote = ref<Quote | null>(null)
/** offline: an older quote of this theme; first: the quote shipped with the app. */
const status = ref<'loading' | 'ready' | 'offline' | 'first' | 'error'>('loading')
const CACHE = 'bewise.today'

let generation = 0
let loadedDay = ''
/** Theme and language of the quote on screen. */
let shownScope = ''

async function load() {
  const current = ++generation
  const day = localDay()
  const scope = `${state.category}:${state.lang}`
  const cached = readJSON<{ key: string, quote: Quote } | null>(CACHE, null)
  const sameScope = cached?.key.startsWith(`${scope}:`) ?? false
  if (cached?.key === `${scope}:${day}`) {
    quote.value = cached.quote
    shownScope = scope
    status.value = 'ready'
  }
  else if (quote.value && shownScope !== scope) {
    // Never leave another theme's quote on screen while this one loads.
    quote.value = null
    status.value = 'loading'
  }
  try {
    const fresh = await api.today(state.category, state.lang, day, state.userId)
    if (current !== generation)
      return
    quote.value = fresh
    shownScope = scope
    status.value = 'ready'
    loadedDay = day
    writeJSON(CACHE, { key: `${scope}:${day}`, quote: fresh })
    adoptVote(fresh)
    void syncWidget(fresh)
    void planReminder(fresh)
  }
  catch {
    if (current !== generation)
      return
    if (cached && sameScope) {
      quote.value = cached.quote
      shownScope = scope
      status.value = cached.key === `${scope}:${day}` ? 'ready' : 'offline'
    }
    else if (!localStorage.getItem(CACHE)) {
      // First launch without network: start with the quote shipped in the app.
      quote.value = bundledQuote(state.category, day)
      shownScope = scope
      status.value = 'first'
    }
    else {
      quote.value = null
      status.value = 'error'
    }
  }
  finally {
    if (current === generation)
      void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {})
  }
}

/** Put today's and tomorrow's quotes into the reminders, so the notification is the quote itself. */
async function planReminder(today: Quote) {
  if (!state.reminder)
    return
  let changed = rememberQuote(today)
  try {
    changed = rememberQuote(await api.today(state.category, state.lang, addDays(today.date, 1), state.userId)) || changed
  }
  catch {}
  if (changed)
    await refreshReminder()
}

watch(() => [state.category, state.lang], load)

// A new day while the app stays open, or coming back online after an offline start.
let midnight: ReturnType<typeof setTimeout> | undefined
function armMidnight() {
  clearTimeout(midnight)
  const next = new Date()
  next.setHours(24, 0, 5, 0)
  midnight = setTimeout(() => {
    void load()
    armMidnight()
  }, next.getTime() - Date.now())
}

function refreshIfStale() {
  if (loadedDay !== localDay() || status.value !== 'ready')
    void load()
}

const resume = App.addListener('resume', () => {
  armMidnight()
  refreshIfStale()
})
window.addEventListener('online', refreshIfStale)

onMounted(() => {
  void load()
  armMidnight()
})
onUnmounted(() => {
  clearTimeout(midnight)
  window.removeEventListener('online', refreshIfStale)
  void resume.then(h => h.remove())
})
</script>

<template>
  <PageShell tab="today">
    <div class="relative flex min-h-full flex-col">
      <QuoteHero
        v-if="quote"
        :key="quote.id"
        :quote="quote"
        :eyebrow="t('today.eyebrow')"
        :category="categoryName(quote.category)"
      />
      <div v-else class="photo-placeholder grid flex-1 place-items-center px-10 text-center">
        <div v-if="status === 'error'" class="space-y-5">
          <p class="font-serif text-2xl text-white">
            {{ t('today.error') }}
          </p>
          <button class="pressable rounded-full bg-white px-6 py-3 font-semibold text-ink" @click="load">
            {{ t('today.retry') }}
          </button>
        </div>
        <div v-else class="size-10 animate-spin rounded-full border-[3px] border-white/40 border-t-white" />
      </div>
      <button
        v-if="status === 'offline' || status === 'first'"
        class="absolute inset-x-6 rounded-2xl bg-black/60 px-4 py-2.5 text-center text-sm text-white backdrop-blur-md"
        :style="{ top: 'calc(var(--nav-top) + 70px)' }"
        @click="load"
      >
        {{ status === 'first' ? t('today.offlineFirst') : t('today.offline') }}
      </button>
    </div>
  </PageShell>
</template>
