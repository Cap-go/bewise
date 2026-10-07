<script setup lang="ts">
import { setupRouterOutlet } from '@capgo/capacitor-transitions/vue'
import { onMounted, ref } from 'vue'
import AppToast from '~/components/AppToast.vue'
import WebTabbar from '~/components/WebTabbar.vue'
import { isNative } from '~/lib/chrome'

const outlet = ref<HTMLElement | null>(null)

onMounted(() => {
  if (outlet.value)
    setupRouterOutlet(outlet.value, { platform: 'auto', swipeGesture: 'auto', keepInDom: true, maxCached: 6 })
})
</script>

<template>
  <cap-router-outlet ref="outlet">
    <router-view />
  </cap-router-outlet>
  <WebTabbar v-if="!isNative && $route.meta.tabbar !== false" />
  <AppToast />
</template>
