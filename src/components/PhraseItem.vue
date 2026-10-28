<script setup lang="ts">
import type { Phrase } from '@/types/content'
import HighlightedText from './HighlightedText.vue'
import { useI18n } from '@/i18n'

const { tr } = useI18n()

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
    <p class="mt-0.5 text-[0.9375rem] leading-snug text-muted sm:mt-1 sm:text-base sm:leading-normal">
      <HighlightedText :text="tr(phrase)" :query="query" />
      <span v-if="phrase.pos" lang="en" class="font-serif opacity-75">&nbsp;{{ phrase.pos }}</span>
    </p>

    <!-- У неправильного глагола вторая и третья формы важнее примера. -->
    <p v-if="phrase.forms" lang="en" class="mt-0.5 font-serif text-[0.9375rem] leading-snug text-muted sm:text-base">
      {{ phrase.forms.v2 }} — {{ phrase.forms.v3 }}
    </p>

    <!-- Пример употребления есть у выражений, у обычных фраз его нет. -->
    <p
      v-for="(example, index) in phrase.examples"
      :key="index"
      class="mt-1.5 border-l-2 border-line pl-3 text-sm leading-snug text-muted sm:mt-2"
    >
      <span lang="en" class="block font-serif">{{ example.en }}</span>
      <span class="block">{{ tr(example) }}</span>
    </p>

    <slot name="meta" />
  </li>
</template>
