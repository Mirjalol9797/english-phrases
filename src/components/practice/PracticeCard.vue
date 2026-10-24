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

    <!-- Три формы неправильного глагола: их и надо запомнить, перевод здесь вторичен. -->
    <p v-if="phrase.forms" lang="en" class="mt-3 font-serif text-xl">
      {{ phrase.forms.v2 }} — {{ phrase.forms.v3 }}
    </p>

    <!-- Часть речи есть только у слов: «n.», «prep., adv.». Перенос строки между
         переводом и ею дал бы лишний пробел, поэтому теги стоят вплотную. -->
    <p class="mt-4 text-lg">{{ phrase.ru
      }}<span v-if="phrase.pos" lang="en" class="font-serif text-sm text-muted">&nbsp;{{ phrase.pos }}</span></p>

    <p
      v-for="(example, index) in phrase.examples"
      :key="index"
      class="mt-4 border-l-2 border-line pl-3 text-sm text-muted"
    >
      <span lang="en" class="block font-serif">{{ example.en }}</span>
      <span class="block">{{ example.ru }}</span>
    </p>
  </div>
</template>
