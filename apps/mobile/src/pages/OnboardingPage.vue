<script setup lang="ts">
import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { setDirection } from '@capgo/capacitor-transitions/vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import PageShell from '~/components/PageShell.vue'
import { photo } from '~/lib/api'
import { categories, loadCategories } from '~/lib/catalog'
import { haptic, showToast } from '~/lib/feedback'
import { scheduleReminder } from '~/lib/reminder'
import { state } from '~/lib/state'

const { t } = useI18n()
const router = useRouter()
const pager = ref<HTMLElement | null>(null)
const step = ref(0)
const STEPS = 4
const platform = Capacitor.getPlatform()

const hero = computed(() => categories.value.find(c => c.id === state.category)?.img ?? categories.value[0]?.img)
const widgetHint = computed(() => platform === 'ios'
  ? t('onboarding.widgetIos')
  : platform === 'android' ? t('onboarding.widgetAndroid') : t('onboarding.widgetWeb'))

function onScroll() {
  const el = pager.value
  if (el)
    step.value = Math.round(el.scrollLeft / el.clientWidth)
}

function goTo(index: number) {
  pager.value?.scrollTo({ left: index * pager.value.clientWidth, behavior: 'smooth' })
}

function next() {
  void haptic.tap()
  if (step.value < STEPS - 1)
    goTo(step.value + 1)
  else
    finish()
}

function finish() {
  state.onboarded = true
  setDirection('forward')
  void router.replace('/today')
}

function pick(id: string) {
  void haptic.select()
  state.category = id
}

async function enableReminder() {
  void haptic.tap()
  state.reminder = await scheduleReminder(state.reminderTime)
  if (state.reminder) {
    void haptic.success()
    setTimeout(goTo, 500, 3)
  }
  else {
    showToast(t('settings.notifDenied'))
  }
}

onMounted(() => {
  void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {})
  if (!categories.value.length)
    void loadCategories()
})
</script>

<template>
  <PageShell :scroll="false">
    <div class="relative flex h-full flex-col bg-ink">
      <button
        v-if="step < STEPS - 1"
        class="pressable absolute right-5 z-10 rounded-full px-3 py-1.5 text-sm font-semibold text-white/70"
        :style="{ top: 'calc(var(--nav-top) + 10px)' }"
        @click="finish"
      >
        {{ t('onboarding.skip') }}
      </button>

      <div ref="pager" class="pager flex flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden" @scroll.passive="onScroll">
        <!-- 1. What BeWise is -->
        <section class="slide relative">
          <img v-if="hero" :src="photo(hero, 430, 932)" alt="" class="fade-in absolute inset-0 h-full w-full object-cover" @load="($event.target as HTMLImageElement).classList.add('loaded')">
          <div class="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/50 to-ink" />
          <div class="slide-body relative justify-end">
            <img src="/app-icon.png" alt="" class="size-16 rounded-[1.1rem] shadow-2xl">
            <h1 class="mt-6 font-serif text-[2.4rem] leading-[1.08] font-semibold text-balance">
              {{ t('onboarding.welcomeTitle') }}
            </h1>
            <p class="mt-4 text-[1.05rem] leading-relaxed text-white/75">
              {{ t('onboarding.welcomeBody') }}
            </p>
          </div>
        </section>

        <!-- 2. Pick a theme -->
        <section class="slide">
          <div class="slide-body justify-center">
            <h2 class="font-serif text-[2rem] leading-tight font-semibold text-balance">
              {{ t('onboarding.themeTitle') }}
            </h2>
            <p class="mt-3 text-white/65">
              {{ t('onboarding.themeBody') }}
            </p>
            <div class="mt-6 grid grid-cols-3 gap-2.5">
              <button
                v-for="category in categories"
                :key="category.id"
                class="pressable photo-placeholder relative aspect-square overflow-hidden rounded-2xl text-left"
                :class="state.category === category.id ? 'ring-[3px] ring-sky ring-offset-2 ring-offset-ink' : ''"
                @click="pick(category.id)"
              >
                <img v-if="category.img" :src="photo(category.img, 120, 120)" alt="" class="fade-in absolute inset-0 h-full w-full object-cover" @load="($event.target as HTMLImageElement).classList.add('loaded')">
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <span class="absolute right-2 bottom-2 left-2 text-[0.8rem] leading-tight font-semibold capitalize">{{ category.name }}</span>
              </button>
              <template v-if="!categories.length">
                <div v-for="i in 9" :key="i" class="aspect-square animate-pulse rounded-2xl bg-ink-2" />
              </template>
            </div>
          </div>
        </section>

        <!-- 3. Daily reminder -->
        <section class="slide">
          <div class="slide-body justify-center">
            <div class="grid size-20 place-items-center rounded-[1.6rem] bg-gradient-to-br from-sky/30 to-mint/20 ring-1 ring-white/10">
              <svg viewBox="0 0 24 24" class="size-10 text-mint" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
            </div>
            <h2 class="mt-7 font-serif text-[2rem] leading-tight font-semibold text-balance">
              {{ t('onboarding.reminderTitle') }}
            </h2>
            <p class="mt-3 text-white/65">
              {{ t('onboarding.reminderBody') }}
            </p>
            <label class="mt-7 flex min-h-14 items-center rounded-2xl bg-ink-2 px-4 ring-1 ring-white/5">
              <span class="flex-1 text-[1.02rem]">{{ t('settings.reminderTime') }}</span>
              <input v-model="state.reminderTime" type="time" class="rounded-xl bg-ink-3 px-3 py-1.5 text-white">
            </label>
            <p v-if="state.reminder" class="mt-4 flex items-center gap-2 font-semibold text-mint">
              <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              {{ t('onboarding.reminderSet', { time: state.reminderTime }) }}
            </p>
            <button v-else class="pressable mt-4 h-13 rounded-full border border-white/15 bg-white/10 font-semibold" @click="enableReminder">
              {{ t('onboarding.reminderOn') }}
            </button>
          </div>
        </section>

        <!-- 4. Widgets -->
        <section class="slide">
          <div class="slide-body justify-center">
            <div class="relative mx-auto aspect-[2.1/1] w-full max-w-sm overflow-hidden rounded-[1.6rem] bg-ink-2 shadow-2xl ring-1 ring-white/10">
              <img v-if="hero" :src="photo(hero, 380, 180)" alt="" class="fade-in absolute inset-0 h-full w-full object-cover" @load="($event.target as HTMLImageElement).classList.add('loaded')">
              <div class="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/85" />
              <div class="relative flex h-full flex-col p-4">
                <p class="text-[0.6rem] font-semibold tracking-[0.18em] text-white/75 uppercase">
                  {{ t('today.eyebrow') }}
                </p>
                <p class="mt-auto font-serif text-[1.05rem] leading-snug font-semibold">
                  {{ t('onboarding.sampleQuote') }}
                </p>
                <p class="mt-1.5 flex items-center gap-2 text-xs text-white/80">
                  <span class="h-px w-4 bg-mint/80" />Walt Disney
                </p>
              </div>
            </div>
            <h2 class="mt-8 font-serif text-[2rem] leading-tight font-semibold text-balance">
              {{ t('onboarding.widgetTitle') }}
            </h2>
            <p class="mt-3 text-white/65">
              {{ t('onboarding.widgetBody') }}
            </p>
            <p class="mt-4 rounded-2xl bg-ink-2 p-4 text-[0.95rem] leading-relaxed text-white/80 ring-1 ring-white/5">
              {{ widgetHint }}
            </p>
          </div>
        </section>
      </div>

      <footer class="mx-auto flex w-full max-w-lg items-center gap-4 px-7 pt-3" :style="{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }">
        <div class="flex gap-1.5" role="tablist">
          <button
            v-for="i in STEPS"
            :key="i"
            role="tab"
            :aria-selected="step === i - 1"
            :aria-label="`${i} / ${STEPS}`"
            class="h-2 rounded-full transition-all duration-300"
            :class="step === i - 1 ? 'w-6 bg-white' : 'w-2 bg-white/25'"
            @click="goTo(i - 1)"
          />
        </div>
        <div class="flex-1" />
        <button class="pressable flex h-14 items-center gap-2 rounded-full bg-white px-7 font-semibold text-ink" @click="next">
          {{ step === STEPS - 1 ? t('onboarding.start') : t('onboarding.next') }}
          <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </button>
      </footer>
    </div>
  </PageShell>
</template>

<style scoped>
.pager {
  scrollbar-width: none;
  overscroll-behavior-x: contain;
}
.pager::-webkit-scrollbar {
  display: none;
}
.slide {
  flex: 0 0 100%;
  height: 100%;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  overflow-y: auto;
}
.slide-body {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  max-width: 32rem;
  margin: 0 auto;
  padding: calc(var(--nav-top) + 56px) 1.75rem 1rem;
}
</style>
