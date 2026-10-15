<script setup lang="ts">
import { ref } from 'vue'
import type { ChoiceStep } from '@/types/practice'
import { isSameAnswer } from '@/utils/answer'
import SpeakButton from './SpeakButton.vue'

const props = defineProps<{
  step: ChoiceStep
  speak: (text: string) => void
  speechSupported: boolean
}>()

const emit = defineEmits<{ answer: [correct: boolean] }>()

const chosen = ref<string | null>(null)

/** Вопрос в choice-ru на английском, в choice-en — на русском. */
const askingTranslation = props.step.kind === 'choice-ru'

function choose(option: string) {
  if (chosen.value !== null) return
  chosen.value = option
  emit('answer', isSameAnswer(option, props.step.answer))
}

function stateClass(option: string) {
  if (chosen.value === null) return ''
  if (isSameAnswer(option, props.step.answer)) return 'option-correct'
  return option === chosen.value ? 'option-wrong' : 'opacity-50'
}
</script>

<template>
  <div>
    <p class="text-sm text-muted">
      {{ askingTranslation ? 'Выберите перевод' : 'Выберите английскую фразу' }}
    </p>

    <div class="mt-3 flex items-start gap-3">
      <p
        :lang="askingTranslation ? 'en' : undefined"
        class="flex-1 text-[clamp(1.5rem,5vw,2rem)] leading-tight"
        :class="askingTranslation ? 'font-serif font-semibold' : ''"
      >
        {{ askingTranslation ? step.phrase.en : step.phrase.ru }}
      </p>
      <SpeakButton
        v-if="askingTranslation"
        :text="step.phrase.en"
        :speak="speak"
        :supported="speechSupported"
      />
    </div>

    <ul class="mt-5 grid gap-2">
      <li v-for="option in step.options" :key="option">
        <button
          type="button"
          class="option"
          :class="stateClass(option)"
          :disabled="chosen !== null"
          @click="choose(option)"
        >
          <span :lang="askingTranslation ? undefined : 'en'" :class="askingTranslation ? '' : 'font-serif'">
            {{ option }}
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>
