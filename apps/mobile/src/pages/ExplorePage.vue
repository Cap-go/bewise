<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import PageShell from '~/components/PageShell.vue'
import PageTitle from '~/components/PageTitle.vue'
import { photo } from '~/lib/api'
import { catalogStale, categories, loadCategories } from '~/lib/catalog'
import { switchTab } from '~/lib/chrome'
import { haptic } from '~/lib/feedback'
import { state } from '~/lib/state'

const { t } = useI18n()
const router = useRouter()

function pick(id: string) {
  void haptic.select()
  state.category = id
  setTimeout(() => void switchTab(router, '/today'), 180)
}

onMounted(() => {
  if (catalogStale.value)
    void loadCategories()
})
</script>

<template>
  <PageShell tab="explore">
    <div class="page-scroll mx-auto max-w-5xl">
      <PageTitle :title="t('explore.title')" :subtitle="t('explore.subtitle')" />
      <div class="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 lg:grid-cols-4">
        <button
          v-for="(category, i) in categories"
          :key="category.id"
          class="pressable photo-placeholder relative aspect-[4/5] overflow-hidden rounded-3xl text-start"
          :class="state.category === category.id ? 'ring-[3px] ring-sky ring-offset-2 ring-offset-ink' : ''"
          :aria-pressed="state.category === category.id"
          @click="pick(category.id)"
        >
          <img v-if="category.img" :src="photo(category.img, 200, 250)" alt="" :loading="i > 5 ? 'lazy' : 'eager'" class="fade-in absolute inset-0 h-full w-full object-cover" @load="($event.target as HTMLImageElement).classList.add('loaded')">
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
          <span
            v-if="state.category === category.id"
            class="absolute end-3 top-3 flex items-center gap-1 rounded-full bg-sky px-2.5 py-1 text-[0.7rem] font-bold text-ink"
          >
            <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            {{ t('explore.current') }}
          </span>
          <span class="absolute bottom-4 left-4 right-4 text-xl leading-tight font-semibold text-white capitalize">{{ category.name }}</span>
        </button>
      </div>
      <div v-if="catalogStale" class="space-y-4 px-8 py-8 text-center">
        <p class="text-sm text-white/55">
          {{ t('explore.error') }}
        </p>
        <button class="pressable rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink" @click="loadCategories">
          {{ t('today.retry') }}
        </button>
      </div>
    </div>
  </PageShell>
</template>
