<script setup lang="ts">
import type { Quote } from '~/lib/api'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import PageShell from '~/components/PageShell.vue'
import QuoteHero from '~/components/QuoteHero.vue'
import { api } from '~/lib/api'
import { categoryName } from '~/lib/catalog'
import { back, isNative } from '~/lib/chrome'
import { quoteCache } from '~/lib/quoteCache'
import { state } from '~/lib/state'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))
const quote = ref<Quote | null>(quoteCache.get(id.value) ?? null)

onMounted(async () => {
  try {
    quote.value = await api.quote(id.value, state.lang, state.userId)
  }
  catch {}
})
</script>

<template>
  <PageShell>
    <div class="relative flex min-h-full flex-col">
      <QuoteHero v-if="quote" :key="quote.id" :quote="quote" :eyebrow="t('archive.title')" :category="categoryName(quote.category)" />
      <button
        v-if="!isNative"
        class="pressable absolute left-4 grid size-11 place-items-center rounded-full bg-black/40 backdrop-blur-md"
        :style="{ top: 'calc(var(--nav-top) + 12px)' }"
        aria-label="Back"
        @click="back(router)"
      >
        <svg viewBox="0 0 24 24" class="size-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      </button>
    </div>
  </PageShell>
</template>
