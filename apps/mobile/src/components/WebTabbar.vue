<script setup lang="ts">
// Browser fallback for local development and the website demo.
// In the native app the tab bar is a real UITabBar / Android view.
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { switchTab } from '~/lib/chrome'
import { TABS } from '~/lib/tabs'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
</script>

<template>
  <nav class="fixed inset-x-4 z-50 mx-auto flex max-w-md rounded-full border border-white/10 bg-ink/70 p-1.5 backdrop-blur-2xl" :style="{ bottom: 'calc(env(safe-area-inset-bottom) + 10px)' }">
    <button
      v-for="tab in TABS"
      :key="tab.id"
      class="flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[0.65rem] font-semibold transition-colors"
      :class="route.meta.tab === tab.id ? 'bg-white/10 text-sky' : 'text-white/55'"
      @click="switchTab(router, tab.path)"
    >
      <span class="size-6 [&>svg]:size-6" v-html="tab.svg" />
      {{ t(`tabs.${tab.id}`) }}
    </button>
  </nav>
</template>
