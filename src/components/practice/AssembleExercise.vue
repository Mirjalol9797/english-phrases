<script setup lang="ts">
import { computed, ref } from 'vue'
import { isTypingTarget, useWindowKey } from '@/composables/useWindowKey'
import type { AssembleStep } from '@/types/practice'
import { isSameAnswer } from '@/utils/answer'
import { useI18n } from '@/i18n'

const { t } = useI18n()

const props = defineProps<{ step: AssembleStep }>()
const emit = defineEmits<{ answer: [correct: boolean] }>()

/** Храним позиции в перемешанном списке: одно и то же слово может встретиться дважды. */
const picked = ref<number[]>([])
const checked = ref(false)

const answer = computed(() => picked.value.map((i) => props.step.words[i]).join(' '))
const correct = computed(() => isSameAnswer(answer.value, props.step.phrase.en))

function add(index: number) {
  if (checked.value || picked.value.includes(index)) return
  picked.value.push(index)
}

function remove(position: number) {
  if (checked.value) return
  picked.value.splice(position, 1)
}

useWindowKey((event) => {
  if (checked.value || isTypingTarget(event.target)) return
  if (event.key === 'Enter' && picked.value.length > 0) {
    event.preventDefault()
    check()
  } else if (event.key === 'Backspace' && picked.value.length > 0) {
    // Убираем последнее собранное слово — как при наборе текста.
    event.preventDefault()
    picked.value.pop()
  }
})

function check() {
  if (checked.value || picked.value.length === 0) return
  checked.value = true
  emit('answer', correct.value)
}
</script>

<template>
  <div>
    <p class="text-sm text-muted">{{ t('Соберите фразу') }}</p>
    <p class="mt-3 text-[clamp(1.125rem,4vw,1.5rem)] leading-snug">{{ step.phrase.ru }}</p>

    <!-- Собранная фраза. Пустая строка держит высоту, чтобы кнопки не прыгали. -->
    <div
      class="mt-4 sm:mt-5 flex min-h-14 flex-wrap items-center gap-2 rounded-xl border border-dashed p-2"
      :class="checked ? (correct ? 'border-ok' : 'border-bad') : 'border-line'"
    >
      <button
        v-for="(index, position) in picked"
        :key="`${index}-${position}`"
        type="button"
        lang="en"
        class="word-chip font-serif"
        :disabled="checked"
        @click="remove(position)"
      >
        {{ step.words[index] }}
      </button>
      <span v-if="picked.length === 0" class="px-2 text-sm text-muted">{{ t('Нажимайте слова по порядку') }}</span>
    </div>

    <ul class="mt-4 flex flex-wrap gap-2">
      <li v-for="(word, index) in step.words" :key="`${word}-${index}`">
        <button
          type="button"
          lang="en"
          class="word-chip font-serif"
          :disabled="checked || picked.includes(index)"
          @click="add(index)"
        >
          {{ word }}
        </button>
      </li>
    </ul>

    <button v-if="!checked" type="button" class="btn-primary mt-5 sm:mt-6" :disabled="picked.length === 0" @click="check">
      {{ t('Проверить') }}
    </button>
    <p v-else-if="!correct" class="mt-4 sm:mt-5">
      <span class="text-sm text-muted">{{ t('Правильно:') }}</span>
      <span lang="en" class="mt-1 block font-serif text-lg">{{ step.phrase.en }}</span>
    </p>
  </div>
</template>
