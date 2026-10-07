<script setup lang="ts">
import { isNative } from '~/lib/chrome'

defineProps<{ title: string, subtitle?: string }>()
</script>

<template>
  <header class="px-5 pb-4">
    <h1 v-if="!isNative" class="pt-4 text-[2.1rem] font-bold tracking-tight">
      {{ title }}
    </h1>
    <p v-if="subtitle" class="mt-1 text-[0.95rem] text-white/55">
      {{ subtitle }}
    </p>
  </header>
</template>
