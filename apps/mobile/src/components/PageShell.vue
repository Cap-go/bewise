<script setup lang="ts">
import { Capacitor } from '@capacitor/core'
import { setupPage } from '@capgo/capacitor-transitions/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { isNative } from '~/lib/chrome'

const props = defineProps<{ tab?: string, scroll?: boolean }>()
const emit = defineEmits<{ enter: [] }>()
const page = ref<HTMLElement | null>(null)
const route = useRoute()
// iOS 26+ draws the native nav bar with no background and relies on the scroll
// view's edge effect, which a web page doesn't get: recreate it under the title.
const navEdge = computed(() => isNative && Capacitor.getPlatform() === 'ios' && route.meta.navbar !== false)
let cleanup: (() => void) | undefined

onMounted(() => {
  if (page.value)
    cleanup = setupPage(page.value, { onDidEnter: () => emit('enter') })
})
onUnmounted(() => cleanup?.())
</script>

<template>
  <cap-page ref="page">
    <div v-if="navEdge" aria-hidden="true" class="nav-edge" />
    <cap-content slot="content" fullscreen :scroll-y="props.scroll !== false" :data-tab-root="props.tab">
      <slot />
    </cap-content>
  </cap-page>
</template>

<style scoped>
.nav-edge {
  position: fixed;
  inset: 0 0 auto;
  z-index: 40;
  height: calc(var(--nav-top) + 16px);
  pointer-events: none;
  background: linear-gradient(180deg, rgb(11 16 22 / 0.9) 0%, rgb(11 16 22 / 0.7) 70%, rgb(11 16 22 / 0) 100%);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  mask-image: linear-gradient(180deg, black 75%, transparent 100%);
}
</style>
