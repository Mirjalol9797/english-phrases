<script setup lang="ts">
// Небольшой набор линейных иконок. Разметка статичная и задана здесь же, поэтому v-html безопасен.
const icons = {
  home: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v11h13V9"/><path d="M10 20v-5h4v5"/>',
  book: '<path d="M12 6.5C10.5 5 8 4.5 4 4.5v14c4 0 6.5.5 8 2"/><path d="M12 6.5c1.5-1.5 4-2 8-2v14c-4 0-6.5.5-8 2"/><path d="M12 6.5v14"/>',
  repeat: '<path d="M4.5 11a7.5 7.5 0 0 1 13-4.5l2 2"/><path d="M19.5 4v4.5H15"/><path d="M19.5 13a7.5 7.5 0 0 1-13 4.5l-2-2"/><path d="M4.5 20v-4.5H9"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  sliders: '<path d="M4 7h9"/><path d="M17 7h3"/><circle cx="15" cy="7" r="2"/><path d="M4 17h3"/><path d="M11 17h9"/><circle cx="9" cy="17" r="2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  moon: '<path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8Z"/>',
  display: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M9 20.5h6"/><path d="M12 16.5v4"/>',
  volume: '<path d="M11 5.5 6.5 9H3.5v6h3l4.5 3.5z"/><path d="M15 9.5a3.5 3.5 0 0 1 0 5"/><path d="M17.5 7a7 7 0 0 1 0 10"/>',
  'volume-off': '<path d="M11 5.5 6.5 9H3.5v6h3l4.5 3.5z"/><path d="m15.5 10 5 4"/><path d="m20.5 10-5 4"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  speaker: '<path d="M11 5.5 6.5 9H3.5v6h3l4.5 3.5z"/><path d="M15 9.5a3.5 3.5 0 0 1 0 5"/>',
  'chevron-left': '<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>',
  'chevron-right': '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
} as const

export type IconName = keyof typeof icons

defineProps<{ name: IconName; size?: number }>()
</script>

<template>
  <svg
    :width="size ?? 22"
    :height="size ?? 22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="icons[name]"
  />
</template>
