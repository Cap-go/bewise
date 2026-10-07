<script setup lang="ts">
import type { Quote } from '~/lib/api'
import { App } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PageShell from '~/components/PageShell.vue'
import QuoteHero from '~/components/QuoteHero.vue'
import { api, localDay } from '~/lib/api'
import { categoryName } from '~/lib/catalog'
import { state } from '~/lib/state'

const { t } = useI18n()
const quote = ref<Quote | null>(null)
const status = ref<'loading' | 'ready' | 'offline' | 'error'>('loading')
const CACHE = 'bewise.today'

async function load() {
  const day = localDay()
  const cacheKey = `${state.category}:${state.lang}:${day}`
  const cached = JSON.parse(localStorage.getItem(CACHE) ?? 'null') as { key: string, quote: Quote } | null
  if (cached?.key === cacheKey) {
    quote.value = cached.quote
    status.value = 'ready'
  }
  try {
    const fresh = await api.today(state.category, state.lang, day, state.userId)
    quote.value = fresh
    status.value = 'ready'
    localStorage.setItem(CACHE, JSON.stringify({ key: cacheKey, quote: fresh }))
  }
  catch {
    if (cached) {
      quote.value ??= cached.quote
      status.value = cached.key === cacheKey ? 'ready' : 'offline'
    }
    else {
      status.value = 'error'
    }
  }
  finally {
    void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {})
  }
}

watch(() => [state.category, state.lang], load)

let lastDay = localDay()
const resume = App.addListener('resume', () => {
  if (localDay() !== lastDay) {
    lastDay = localDay()
    void load()
  }
})

onMounted(load)
onUnmounted(() => void resume.then(h => h.remove()))
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
      <p
        v-if="status === 'offline'"
        class="absolute inset-x-6 rounded-2xl bg-black/60 px-4 py-2.5 text-center text-sm text-white backdrop-blur-md"
        :style="{ top: 'calc(var(--nav-top) + 70px)' }"
      >
        {{ t('today.offline') }}
      </p>
    </div>
  </PageShell>
</template>
