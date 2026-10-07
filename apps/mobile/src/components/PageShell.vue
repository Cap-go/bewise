<script setup lang="ts">
import { setupPage } from '@capgo/capacitor-transitions/vue'
import { onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{ tab?: string, scroll?: boolean }>()
const emit = defineEmits<{ enter: [] }>()
const page = ref<HTMLElement | null>(null)
let cleanup: (() => void) | undefined

onMounted(() => {
  if (page.value)
    cleanup = setupPage(page.value, { onDidEnter: () => emit('enter') })
})
onUnmounted(() => cleanup?.())
</script>

<template>
  <cap-page ref="page">
    <cap-content slot="content" fullscreen :scroll-y="props.scroll !== false" :data-tab-root="props.tab">
      <slot />
    </cap-content>
  </cap-page>
</template>
