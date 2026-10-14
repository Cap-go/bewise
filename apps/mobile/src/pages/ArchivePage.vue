<script setup lang="ts">
import type { Quote } from '~/lib/api'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import PageShell from '~/components/PageShell.vue'
import PageTitle from '~/components/PageTitle.vue'
import { addDays, api, localDay, photo } from '~/lib/api'
import { categoryName } from '~/lib/catalog'
import { push } from '~/lib/chrome'
import { haptic } from '~/lib/feedback'
import { lovedQuotes } from '~/lib/loved'
import { quoteCache } from '~/lib/quoteCache'
import { state } from '~/lib/state'
import { readJSON, writeJSON } from '~/lib/storage'

const { t, locale } = useI18n()
const router = useRouter()
const view = ref<'all' | 'loved'>('all')
const query = ref('')
/** Archive starts on this day (exclusive) instead of today. */
const from = ref('')
const quotes = ref<Quote[]>([])
const loading = ref(false)
const done = ref(false)
const failed = ref(false)
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined

const search = computed(() => query.value.trim().length >= 2 ? query.value.trim().slice(0, 64) : '')
const lovedList = computed(() => {
  const all = lovedQuotes()
  const q = search.value.toLocaleLowerCase(locale.value)
  return q ? all.filter(x => `${x.text} ${x.author}`.toLocaleLowerCase(locale.value).includes(q)) : all
})
const shown = computed(() => view.value === 'loved' ? lovedList.value : quotes.value)

/** First page of the plain archive, kept for offline starts. */
const pageKey = () => `bewise.archive.${state.category}.${state.lang}`

let generation = 0
/** The list on screen is the saved first page, still to be replaced by a fresh one. */
let fromCache = false

async function more() {
  if (view.value !== 'all' || loading.value || done.value)
    return
  loading.value = true
  failed.value = false
  const current = generation
  const first = fromCache || !quotes.value.length
  const plain = !search.value && !from.value
  try {
    const before = (first ? undefined : quotes.value.at(-1)?.date) ?? (from.value ? addDays(from.value, 1) : localDay())
    const page = await api.archive(state.category, state.lang, before, search.value || undefined)
    if (current !== generation)
      return
    page.forEach(q => quoteCache.set(q.id, q))
    fromCache = false
    quotes.value = first ? page : [...quotes.value, ...page.filter(q => !quotes.value.some(x => x.id === q.id))]
    done.value = page.length === 0
    if (first && plain)
      writeJSON(pageKey(), page)
  }
  catch {
    if (current === generation)
      failed.value = true
  }
  finally {
    // A request from before a reset must not unlock the newer one.
    if (current === generation)
      loading.value = false
  }
}

function reset() {
  generation++
  loading.value = false
  failed.value = false
  done.value = false
  quotes.value = !search.value && !from.value ? readJSON<Quote[]>(pageKey(), []) : []
  fromCache = quotes.value.length > 0
  void more()
}

function open(quote: Quote) {
  void haptic.tap()
  void push(router, `/archive/${quote.id}`)
}

function formatDate(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString(locale.value, { month: 'short', day: 'numeric', year: 'numeric' })
}

function setView(next: 'all' | 'loved') {
  void haptic.select()
  view.value = next
}

function jump(event: Event) {
  from.value = (event.target as HTMLInputElement).value
}

let typing: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(typing)
  typing = setTimeout(reset, 350)
})
watch(() => [state.category, state.lang, from.value], reset)
watch(view, () => void more())

onMounted(() => {
  reset()
  observer = new IntersectionObserver(entries => entries[0]?.isIntersecting && void more(), { rootMargin: '600px' })
  if (sentinel.value)
    observer.observe(sentinel.value)
})
onUnmounted(() => {
  clearTimeout(typing)
  observer?.disconnect()
})
</script>

<template>
  <PageShell tab="archive">
    <div class="page-scroll mx-auto max-w-3xl">
      <PageTitle :title="t('archive.title')" :subtitle="view === 'all' ? t('archive.subtitle', { category: categoryName(state.category) }) : t('archive.lovedSubtitle')" />

      <div class="space-y-3 px-4 pb-4">
        <div class="flex rounded-full bg-ink-2 p-1 ring-1 ring-white/5" role="tablist">
          <button
            v-for="v in (['all', 'loved'] as const)"
            :key="v"
            role="tab"
            :aria-selected="view === v"
            class="h-10 flex-1 rounded-full text-[0.95rem] font-semibold transition-colors"
            :class="view === v ? 'bg-white text-ink' : 'text-white/60'"
            @click="setView(v)"
          >
            {{ v === 'all' ? t('archive.all') : t('archive.loved') }}
          </button>
        </div>
        <div class="flex gap-2">
          <label class="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl bg-ink-2 px-4 ring-1 ring-white/5">
            <svg viewBox="0 0 24 24" class="size-5 shrink-0 text-white/40" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <input v-model="query" type="search" enterkeyhint="search" :placeholder="t('archive.search')" :aria-label="t('archive.search')" class="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-white/35">
          </label>
          <label v-if="view === 'all'" class="pressable relative grid size-12 shrink-0 place-items-center rounded-2xl bg-ink-2 ring-1 ring-white/5" :class="from ? 'text-sky' : 'text-white/60'" :aria-label="t('archive.jump')">
            <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
            <input type="date" :value="from" :max="localDay()" class="absolute inset-0 opacity-0" @change="jump">
          </label>
        </div>
        <button v-if="from && view === 'all'" class="pressable flex items-center gap-2 rounded-full bg-sky/15 py-1.5 ps-3.5 pe-2.5 text-sm font-semibold text-sky" @click="from = ''">
          {{ t('archive.from', { date: formatDate(from) }) }}
          <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <ul class="grid gap-3 px-4 md:grid-cols-2">
        <li v-for="quote in shown" :key="quote.id">
          <button class="pressable flex w-full gap-4 rounded-3xl bg-ink-2 p-3 text-start ring-1 ring-white/5" @click="open(quote)">
            <div class="photo-placeholder relative h-28 w-20 shrink-0 overflow-hidden rounded-2xl">
              <img v-if="quote.img" :src="photo(quote.img, 80, 112)" alt="" loading="lazy" class="fade-in absolute inset-0 h-full w-full object-cover" @load="($event.target as HTMLImageElement).classList.add('loaded')">
            </div>
            <div class="flex min-w-0 flex-1 flex-col py-1">
              <p class="text-xs font-semibold tracking-wide text-sky uppercase">
                {{ formatDate(quote.date) }}<span v-if="view === 'loved'" class="text-white/40"> · {{ categoryName(quote.category) }}</span>
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
        <template v-if="view === 'all' && loading && !quotes.length">
          <li v-for="i in 5" :key="i" class="h-34 animate-pulse rounded-3xl bg-ink-2" />
        </template>
      </ul>
      <div ref="sentinel" class="h-px" />

      <div v-if="view === 'all' && failed" class="space-y-4 py-8 text-center">
        <p class="text-sm text-white/55">
          {{ t('archive.error') }}
        </p>
        <button class="pressable rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink" @click="more">
          {{ t('today.retry') }}
        </button>
      </div>
      <p v-else-if="view === 'all' && done" class="py-8 text-center text-sm text-white/40">
        {{ search && !quotes.length ? t('archive.noResults', { query: search }) : quotes.length ? t('archive.end') : t('archive.empty') }}
      </p>
      <p v-else-if="view === 'loved' && !lovedList.length" class="px-10 py-10 text-center text-sm leading-relaxed text-white/45">
        {{ search ? t('archive.noResults', { query: search }) : t('archive.lovedEmpty') }}
      </p>
    </div>
  </PageShell>
</template>
