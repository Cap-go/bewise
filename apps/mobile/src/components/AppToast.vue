<script setup lang="ts">
import { toast } from '~/lib/feedback'
</script>

<template>
  <Transition
    enter-from-class="opacity-0 -translate-y-3"
    leave-to-class="opacity-0 -translate-y-3"
    enter-active-class="transition duration-300"
    leave-active-class="transition duration-300"
  >
    <div
      v-if="toast"
      :key="toast.id"
      role="status"
      class="fixed inset-x-0 z-[60] mx-auto w-max max-w-[85vw] rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink shadow-2xl"
      :style="{ top: 'calc(env(safe-area-inset-top) + 12px)' }"
    >
      {{ toast.text }}
    </div>
  </Transition>
</template>
