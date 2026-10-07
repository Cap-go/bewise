<script setup lang="ts">
import type { Quote } from '~/lib/api'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import PageShell from '~/components/PageShell.vue'
import PageTitle from '~/components/PageTitle.vue'
import { api, localDay, photo } from '~/lib/api'
import { categoryName } from '~/lib/catalog'
import { push } from '~/lib/chrome'
import { haptic } from '~/lib/feedback'
import { quoteCache } from '~/lib/quoteCache'
import { state } from '~/lib/state'

const { t, locale } = useI18n()
const router = useRouter()
const quotes = ref<Quote[]>([])
const loading = ref(false)
const done = ref(false)
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined

let generation = 0

async function more() {
  if (loading.value || done.value)
    return
  loading.value = true
  const current = generation
  try {
    const before = quotes.value.at(-1)?.date ?? localDay()
    const page = await api.archive(state.category, state.lang, before)
    if (current !== generation)
      return
    page.forEach(q => quoteCache.set(q.id, q))
    quotes.value.push(...page)
    done.value = page.length === 0
  }
  catch {}
  finally {
    loading.value = false
  }
}

function reset() {
  generation++
  loading.value = false
  quotes.value = []
  done.value = false
  void more()
}

function open(quote: Quote) {
  void haptic.tap()
  void push(router, `/archive/${quote.id}`)
}

function formatDate(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString(locale.value, { month: 'short', day: 'numeric', year: 'numeric' })
}

watch(() => [state.category, state.lang], reset)

onMounted(() => {
  void more()
  observer = new IntersectionObserver(entries => entries[0]?.isIntersecting && void more(), { rootMargin: '600px' })
  if (sentinel.value)
    observer.observe(sentinel.value)
})
onUnmounted(() => observer?.disconnect())
</script>

<template>
  <PageShell tab="archive">
    <div class="page-scroll mx-auto max-w-3xl">
      <PageTitle :title="t('archive.title')" :subtitle="t('archive.subtitle', { category: categoryName(state.category) })" />
      <ul class="grid gap-3 px-4 md:grid-cols-2">
        <li v-for="quote in quotes" :key="quote.id">
          <button class="pressable flex w-full gap-4 rounded-3xl bg-ink-2 p-3 text-left ring-1 ring-white/5" @click="open(quote)">
            <div class="photo-placeholder relative h-28 w-20 shrink-0 overflow-hidden rounded-2xl">
              <img v-if="quote.img" :src="photo(quote.img, 80, 112)" alt="" loading="lazy" class="fade-in absolute inset-0 h-full w-full object-cover" @load="($event.target as HTMLImageElement).classList.add('loaded')">
            </div>
            <div class="flex min-w-0 flex-1 flex-col py-1">
              <p class="text-xs font-semibold tracking-wide text-sky uppercase">
                {{ formatDate(quote.date) }}
              </p>
              <p class="mt-1.5 line-clamp-3 font-serif text-[1.05rem] leading-snug text-white">
                {{ quote.text }}
              </p>
              <div class="mt-auto flex items-center justify-between pt-2 text-sm text-white/55">
                <span class="truncate">{{ quote.author }}</span>
                <span v-if="quote.votes" class="flex shrink-0 items-center gap-1 text-rose">
                  <svg viewBox="0 0 24 24" class="size-3.5 fill-current"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
                  {{ quote.votes }}
                </span>
              </div>
            </div>
          </button>
        </li>
        <template v-if="loading && !quotes.length">
          <li v-for="i in 5" :key="i" class="h-34 animate-pulse rounded-3xl bg-ink-2" />
        </template>
      </ul>
      <div ref="sentinel" class="h-px" />
      <p v-if="done" class="py-8 text-center text-sm text-white/40">
        {{ quotes.length ? t('archive.end') : t('archive.empty') }}
      </p>
    </div>
  </PageShell>
</template>
