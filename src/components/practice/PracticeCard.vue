<script setup lang="ts">
import { watch } from 'vue'
import type { Phrase } from '@/types/content'
import SpeakButton from './SpeakButton.vue'

// Этап знакомства: фраза сразу вместе с переводом, проверять здесь нечего.
const props = defineProps<{
  phrase: Phrase
  speak: (text: string) => void
  speechSupported: boolean
  autoSpeak: boolean
}>()

watch(
  () => props.phrase.id,
  () => {
    if (props.autoSpeak) props.speak(props.phrase.en)
  },
  { immediate: true },
)
</script>

<template>
  <div>
    <div class="flex items-start gap-3">
      <p lang="en" class="flex-1 font-serif text-[clamp(1.5rem,6vw,2.5rem)] leading-tight font-semibold">
        <span class="marker">{{ phrase.en }}</span>
      </p>
      <SpeakButton :text="phrase.en" :speak="speak" :supported="speechSupported" />
    </div>

    <p class="mt-4 text-lg">{{ phrase.ru }}</p>

    <p v-if="phrase.example" class="mt-4 border-l-2 border-line pl-3 text-sm text-muted">
      <span lang="en" class="block font-serif">{{ phrase.example.en }}</span>
      <span class="block">{{ phrase.example.ru }}</span>
    </p>
  </div>
</template>
