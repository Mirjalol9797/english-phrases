<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { ListenStep } from '@/types/practice'
import { isSameAnswer } from '@/utils/answer'
import { isTypingTarget, useWindowKey } from '@/composables/useWindowKey'
import AppIcon from '@/components/AppIcon.vue'
import { useI18n } from '@/i18n'

const { t } = useI18n()

/**
 * Фраза звучит, а на экране её нет — в этом весь смысл задания.
 * Английский текст показывается только после ответа, чтобы сверить услышанное.
 */
const props = defineProps<{
  step: ListenStep
  speak: (text: string) => void
  speaking: boolean
}>()

const emit = defineEmits<{ answer: [correct: boolean] }>()

const chosen = ref<string | null>(null)

function play() {
  props.speak(props.step.phrase.en)
}

onMounted(play)

function choose(option: string) {
  if (chosen.value !== null) return
  chosen.value = option
  emit('answer', isSameAnswer(option, props.step.answer))
}

useWindowKey((event) => {
  if (isTypingTarget(event.target)) return
  // Пробел повторяет фразу: самое частое желание в этом задании.
  if (event.key === ' ') {
    event.preventDefault()
    play()
    return
  }
  if (chosen.value !== null) return
  const position = Number(event.key)
  if (!Number.isInteger(position) || position < 1 || position > props.step.options.length) return
  event.preventDefault()
  choose(props.step.options[position - 1]!)
})

function stateClass(option: string) {
  if (chosen.value === null) return ''
  if (isSameAnswer(option, props.step.answer)) return 'option-correct'
  return option === chosen.value ? 'option-wrong' : 'opacity-50'
}
</script>

<template>
  <div>
    <p class="text-sm text-muted">{{ t('Послушайте и выберите перевод') }}</p>

    <div class="mt-3 flex items-center gap-4">
      <button
        type="button"
        class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-marker text-on-marker"
        :aria-label="t('Послушать ещё раз')"
        @click="play"
      >
        <AppIcon name="volume" :size="28" />
      </button>
      <p class="text-sm text-muted">{{ t('Нажмите, чтобы послушать ещё раз') }}</p>
    </div>

    <ul class="mt-4 sm:mt-5 grid gap-2">
      <li v-for="(option, index) in step.options" :key="option">
        <button
          type="button"
          class="option flex items-baseline gap-3"
          :class="stateClass(option)"
          :disabled="chosen !== null"
          @click="choose(option)"
        >
          <span class="w-4 shrink-0 text-sm text-muted tabular-nums" aria-hidden="true">{{ index + 1 }}</span>
          <span>{{ option }}</span>
        </button>
      </li>
    </ul>

    <!-- После ответа показываем написание: услышанное нужно с чем-то сверить. -->
    <p v-if="chosen !== null" lang="en" class="mt-4 sm:mt-5 font-serif text-lg">{{ step.phrase.en }}</p>
  </div>
</template>
