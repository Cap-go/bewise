<script setup lang="ts">
import type { Quote } from '~/lib/api'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import PageShell from '~/components/PageShell.vue'
import QuoteHero from '~/components/QuoteHero.vue'
import { api } from '~/lib/api'
import { categoryName } from '~/lib/catalog'
import { back, isNative } from '~/lib/chrome'
import { loved } from '~/lib/loved'
import { quoteCache } from '~/lib/quoteCache'
import { state } from '~/lib/state'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const id = computed(() => route.params.id ? String(route.params.id) : '')
const quote = ref<Quote | null>(null)
const failed = ref(false)

let generation = 0

async function load() {
  const current = ++generation
  const quoteId = id.value
  if (!quoteId)
    return
  // Lists and the Loved collection already have the quote: show it during the push transition.
  quote.value = quoteCache.get(quoteId) ?? loved[quoteId]?.quote ?? null
  failed.value = false
  try {
    const fresh = await api.quote(quoteId, state.lang, state.userId)
    if (current === generation)
      quote.value = fresh
  }
  catch {
    if (current === generation)
      failed.value = !quote.value
  }
}

// The page stays mounted when a deep link opens another quote: follow the id.
watch(id, load, { immediate: true })
</script>

<template>
  <PageShell>
    <div class="relative flex min-h-full flex-col">
      <QuoteHero v-if="quote" :key="quote.id" :quote="quote" :eyebrow="t('archive.title')" :category="categoryName(quote.category)" />
      <div v-else class="photo-placeholder grid flex-1 place-items-center px-10 text-center">
        <div v-if="failed" class="space-y-5">
          <p class="font-serif text-2xl text-white">
            {{ t('quote.error') }}
          </p>
          <button class="pressable rounded-full bg-white px-6 py-3 font-semibold text-ink" @click="load">
            {{ t('today.retry') }}
          </button>
        </div>
        <div v-else class="size-10 animate-spin rounded-full border-[3px] border-white/40 border-t-white" />
      </div>
      <button
        v-if="!isNative"
        class="pressable absolute grid size-11 place-items-center rounded-full bg-black/40 backdrop-blur-md"
        :style="{ top: 'calc(var(--nav-top) + 12px)', insetInlineStart: 'calc(var(--nav-left) + 1rem)' }"
        :aria-label="t('common.back')"
        @click="back(router)"
      >
        <svg viewBox="0 0 24 24" class="size-6 rtl:rotate-180" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      </button>
    </div>
  </PageShell>
</template>
