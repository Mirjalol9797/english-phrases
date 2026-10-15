<script setup lang="ts">
import type { Phrase } from '@/types/content'
import HighlightedText from './HighlightedText.vue'

defineProps<{
  phrase: Phrase
  /** Запрос из словаря: совпадения подсвечиваются маркером. */
  query?: string
}>()
</script>

<template>
  <li class="py-2 sm:py-4">
    <p lang="en" class="font-serif text-lg leading-snug sm:text-xl">
      <HighlightedText :text="phrase.en" :query="query" />
    </p>
    <p class="mt-0.5 text-[0.9375rem] leading-snug text-muted sm:mt-1 sm:text-base sm:leading-normal"><HighlightedText :text="phrase.ru" :query="query" /></p>

    <!-- Пример употребления есть у выражений, у обычных фраз его нет. -->
    <p v-if="phrase.example" class="mt-1.5 border-l-2 border-line pl-3 text-sm leading-snug text-muted sm:mt-2">
      <span lang="en" class="block font-serif">{{ phrase.example.en }}</span>
      <span class="block">{{ phrase.example.ru }}</span>
    </p>

    <slot name="meta" />
  </li>
</template>
