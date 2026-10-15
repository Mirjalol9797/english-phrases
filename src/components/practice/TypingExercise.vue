<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TypingStep } from '@/types/practice'
import { isSameAnswer } from '@/utils/answer'

const props = defineProps<{ step: TypingStep }>()
const emit = defineEmits<{ answer: [correct: boolean] }>()

const value = ref('')
const checked = ref(false)

// Верным считаем любую фразу урока с этим же переводом: по «Привет!» одинаково
// подходят и Hi!, и Hey!.
const correct = computed(() => props.step.accept.some((variant) => isSameAnswer(value.value, variant)))

/** Что показать после проверки: то, что ждали, или то, что написано в главе. */
const expected = computed(() => props.step.accept.join(' / '))

function check() {
  if (checked.value || !value.value.trim()) return
  checked.value = true
  emit('answer', correct.value)
}
</script>

<template>
  <div>
    <p class="text-sm text-muted">Напишите по-английски</p>
    <p class="mt-3 text-[clamp(1.25rem,4vw,1.5rem)] leading-snug">{{ step.phrase.ru }}</p>

    <form class="mt-5" @submit.prevent="check">
      <input
        v-model="value"
        type="text"
        lang="en"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        :readonly="checked"
        aria-label="Английская фраза"
        class="field font-serif text-lg"
        :class="checked ? (correct ? 'option-correct' : 'option-wrong') : ''"
      />
      <button v-if="!checked" type="submit" class="btn-primary mt-4" :disabled="!value.trim()">Проверить</button>
    </form>

    <p v-if="checked && !correct" class="mt-5">
      <span class="text-sm text-muted">Правильно:</span>
      <span lang="en" class="mt-1 block font-serif text-lg">{{ expected }}</span>
    </p>
    <!-- Регистр, апостроф и точка в конце ошибкой не считаются, но написание покажем как в главе. -->
    <p v-else-if="checked && value.trim() !== step.phrase.en" class="mt-5 text-sm text-muted">
      В главе записано так: <span lang="en" class="font-serif">{{ step.phrase.en }}</span>
    </p>
  </div>
</template>
