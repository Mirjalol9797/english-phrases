<script setup lang="ts">
// Выбор главы: один и тот же ряд чипсов в словаре и в повторении.
export interface ChapterFilterOption {
  /** Пустая строка — «все главы». */
  id: string
  title: string
  count: number
}

defineProps<{ options: ChapterFilterOption[]; label: string }>()
const model = defineModel<string>({ required: true })
</script>

<template>
  <!-- Делить не на что, пока глава одна: кроме «всех глав» в списке ничего нет. -->
  <ul v-if="options.length > 2" class="flex flex-wrap gap-2" :aria-label="label">
    <li v-for="option in options" :key="option.id">
      <button
        type="button"
        class="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm"
        :class="
          model === option.id
            ? 'border-transparent bg-marker text-on-marker'
            : 'border-line text-muted hover:text-ink'
        "
        :aria-pressed="model === option.id"
        :aria-label="`${option.title}: ${option.count}`"
        @click="model = option.id"
      >
        <span :lang="option.id ? 'en' : undefined" :class="option.id ? 'font-serif' : ''">{{ option.title }}</span>
        <span class="tabular-nums opacity-70">{{ option.count }}</span>
      </button>
    </li>
  </ul>
</template>
