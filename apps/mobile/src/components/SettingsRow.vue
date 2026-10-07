<script setup lang="ts">
defineProps<{ label: string, value?: string, chevron?: boolean, icon?: string, tint?: string }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <button class="flex min-h-14 w-full items-center gap-3.5 px-4 py-3 text-left active:bg-white/5" @click="$emit('click')">
    <span v-if="icon" class="grid size-8 shrink-0 place-items-center rounded-[10px]" :style="{ background: tint ?? '#1b2531' }">
      <span class="size-[18px] text-white" v-html="icon" />
    </span>
    <span class="flex-1 text-[1.02rem] text-white">{{ label }}</span>
    <slot>
      <span v-if="value" class="max-w-[45%] truncate text-[0.95rem] text-white/45">{{ value }}</span>
    </slot>
    <svg v-if="chevron" viewBox="0 0 24 24" class="size-4 shrink-0 text-white/30" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
  </button>
</template>
