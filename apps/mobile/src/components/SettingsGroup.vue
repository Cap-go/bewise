<script setup lang="ts">
defineProps<{ title?: string, footer?: string }>()
</script>

<template>
  <section class="px-4">
    <h2 v-if="title" class="px-4 pb-2 text-xs font-semibold tracking-[0.12em] text-white/45 uppercase">
      {{ title }}
    </h2>
    <div class="divide-y divide-white/6 overflow-hidden rounded-3xl bg-ink-2 ring-1 ring-white/5">
      <slot />
    </div>
    <p v-if="footer" class="px-4 pt-2 text-[0.8rem] leading-relaxed text-white/40">
      {{ footer }}
    </p>
  </section>
</template>
