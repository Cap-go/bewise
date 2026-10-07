<script setup lang="ts">
import type { Quote } from '~/lib/api'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { api, photo } from '~/lib/api'
import { haptic, showToast } from '~/lib/feedback'
import { copyQuote, shareQuote } from '~/lib/share'
import { state } from '~/lib/state'

const props = defineProps<{ quote: Quote, eyebrow: string, category?: string }>()
const { t, locale } = useI18n()

const voted = ref(props.quote.voted)
const votes = ref(props.quote.votes)
const burst = ref(0)
const bigHeart = ref(0)
const imageLoaded = ref(false)

const bg = computed(() => photo(props.quote.img, window.innerWidth, window.innerHeight))
const textSize = computed(() => {
  const n = props.quote.text.length
  if (n > 260)
    return 'text-[1.35rem] leading-[1.35] md:text-[2rem]'
  if (n > 160)
    return 'text-[1.6rem] leading-[1.3] md:text-[2.4rem]'
  if (n > 90)
    return 'text-[1.95rem] leading-[1.22] md:text-[2.9rem]'
  return 'text-[2.4rem] leading-[1.15] md:text-[3.6rem]'
})
const dateLabel = computed(() => {
  const label = new Date(`${props.quote.date}T12:00:00`).toLocaleDateString(locale.value, { weekday: 'long', month: 'long', day: 'numeric' })
  return label.charAt(0).toLocaleUpperCase(locale.value) + label.slice(1)
})

async function love(fromDoubleTap = false) {
  if (fromDoubleTap)
    bigHeart.value++
  burst.value++
  void haptic.success()
  if (voted.value)
    return
  voted.value = true
  votes.value++
  try {
    const res = await api.vote(props.quote.id, state.userId)
    votes.value = res.votes
  }
  catch {}
}

let lastTap = 0
function onTap() {
  const now = Date.now()
  if (now - lastTap < 300)
    void love(true)
  lastTap = now
}

async function share() {
  void haptic.tap()
  await shareQuote(props.quote)
}

async function copy() {
  void haptic.tap()
  await copyQuote(props.quote)
  showToast(t('quote.copied'))
}
</script>

<template>
  <section class="relative h-full w-full overflow-hidden bg-ink" @click="onTap">
    <div class="absolute inset-0 brand-gradient opacity-90" />
    <img
      v-if="bg"
      :key="bg"
      :src="bg"
      alt=""
      class="animate-kenburns absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
      :class="imageLoaded ? 'opacity-100' : 'opacity-0'"
      @load="imageLoaded = true"
    >
    <div class="absolute inset-0 bg-gradient-to-b from-black/45 via-black/35 to-black/85" />

    <div class="relative mx-auto flex h-full max-w-3xl flex-col px-7 md:px-12" :style="{ paddingTop: 'calc(var(--nav-top) + 18px)', paddingBottom: 'calc(var(--nav-bottom) + 22px)' }">
      <header class="animate-rise flex items-center justify-between gap-3">
        <div>
          <p class="text-[0.7rem] font-semibold tracking-[0.18em] text-white/70 uppercase">
            {{ eyebrow }}
          </p>
          <p class="mt-1 text-[0.95rem] font-medium text-white">
            {{ dateLabel }}
          </p>
        </div>
        <span v-if="category" class="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white capitalize backdrop-blur-md">
          {{ category }}
        </span>
      </header>

      <div class="flex flex-1 flex-col justify-end pb-8">
        <span class="text-gradient block font-serif text-[5.5rem] leading-[0.6] font-semibold">“</span>
        <blockquote class="animate-rise mt-4 font-serif font-medium tracking-[-0.01em] text-balance text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.35)]" :class="textSize" style="animation-delay: 80ms">
          {{ quote.text }}
        </blockquote>
        <p v-if="quote.author.trim()" class="animate-rise mt-6 flex items-center gap-3 text-base font-medium text-white/85" style="animation-delay: 160ms">
          <span class="h-px w-8 bg-mint/80" />
          {{ quote.author }}
        </p>
      </div>

      <footer class="animate-rise flex items-center gap-3" style="animation-delay: 240ms" @click.stop>
        <button
          class="pressable flex h-14 items-center gap-2.5 rounded-full border border-white/20 bg-white/12 pr-5 pl-4 backdrop-blur-xl"
          :aria-label="voted ? t('quote.loved') : t('quote.love')"
          :aria-pressed="voted"
          @click="love()"
        >
          <span :key="burst" class="relative grid size-7 place-items-center" :class="burst ? 'heart-pop' : ''">
            <svg viewBox="0 0 24 24" class="size-7 transition-colors" :class="voted ? 'fill-rose text-rose' : 'fill-transparent text-white'" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
            <span v-if="burst" class="burst-ring absolute inset-0 rounded-full" />
          </span>
          <span class="min-w-[1.5ch] text-base font-semibold tabular-nums">{{ votes }}</span>
        </button>
        <div class="flex-1" />
        <button class="pressable grid size-14 place-items-center rounded-full border border-white/20 bg-white/12 backdrop-blur-xl" :aria-label="t('quote.copy')" @click="copy">
          <svg viewBox="0 0 24 24" class="size-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
        </button>
        <button class="pressable flex h-14 items-center gap-2 rounded-full bg-white px-6 font-semibold text-ink" @click="share">
          <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" x2="12" y1="2" y2="15" /></svg>
          {{ t('quote.share') }}
        </button>
      </footer>
    </div>

    <svg v-if="bigHeart" :key="`big-${bigHeart}`" viewBox="0 0 24 24" class="big-heart pointer-events-none absolute top-1/2 left-1/2 size-32 fill-rose text-rose"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
  </section>
</template>

<style scoped>
.heart-pop {
  animation: pop 420ms cubic-bezier(0.2, 1.6, 0.4, 1);
}
.burst-ring {
  animation: ring 600ms ease-out forwards;
  box-shadow: 0 0 0 2px var(--color-rose);
}
.big-heart {
  animation: big 900ms cubic-bezier(0.2, 0.9, 0.3, 1) forwards;
  filter: drop-shadow(0 10px 30px rgba(255, 95, 143, 0.5));
}
@keyframes pop {
  0% { transform: scale(1); }
  40% { transform: scale(1.35); }
  100% { transform: scale(1); }
}
@keyframes ring {
  from { transform: scale(0.6); opacity: 1; }
  to { transform: scale(2.2); opacity: 0; }
}
@keyframes big {
  0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
  25% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
  45% { transform: translate(-50%, -50%) scale(0.95); }
  70% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -60%) scale(1); opacity: 0; }
}
</style>
