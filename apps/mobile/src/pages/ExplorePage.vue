<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import PageShell from '~/components/PageShell.vue'
import PageTitle from '~/components/PageTitle.vue'
import { photo } from '~/lib/api'
import { categories, loadCategories } from '~/lib/catalog'
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
  if (!categories.value.length)
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
          class="pressable photo-placeholder relative aspect-[4/5] overflow-hidden rounded-3xl text-left"
          :class="state.category === category.id ? 'ring-[3px] ring-sky ring-offset-2 ring-offset-ink' : ''"
          @click="pick(category.id)"
        >
          <img v-if="category.img" :src="photo(category.img, 200, 250)" alt="" :loading="i > 5 ? 'lazy' : 'eager'" class="fade-in absolute inset-0 h-full w-full object-cover" @load="($event.target as HTMLImageElement).classList.add('loaded')">
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
          <span
            v-if="state.category === category.id"
            class="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-sky px-2.5 py-1 text-[0.7rem] font-bold text-ink"
          >
            <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            {{ t('explore.current') }}
          </span>
          <span class="absolute bottom-4 left-4 right-4 text-xl leading-tight font-semibold text-white capitalize">{{ category.name }}</span>
        </button>
        <template v-if="!categories.length">
          <div v-for="i in 6" :key="i" class="aspect-[4/5] animate-pulse rounded-3xl bg-ink-2" />
        </template>
      </div>
    </div>
  </PageShell>
</template>
