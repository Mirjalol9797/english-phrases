<script setup lang="ts">
import { computed, ref, useTemplateRef, onMounted } from 'vue'
import type { TypingStep } from '@/types/practice'
import { isSameAnswer } from '@/utils/answer'
import { closestAnswer, diffWords } from '@/utils/diff'
import { useI18n } from '@/i18n'

const { t } = useI18n()

const props = defineProps<{ step: TypingStep }>()
const emit = defineEmits<{ answer: [correct: boolean] }>()

const value = ref('')
const checked = ref(false)

// Поле получает фокус сразу: иначе на компьютере приходится тянуться к мыши.
const field = useTemplateRef<HTMLInputElement>('field')
onMounted(() => field.value?.focus())

// Верным считаем любую фразу урока с этим же переводом: по «Привет!» одинаково
// подходят и Hi!, и Hey!.
const correct = computed(() => props.step.accept.some((variant) => isSameAnswer(value.value, variant)))

/** Что показать после проверки: то, что ждали, или то, что написано в главе. */
const expected = computed(() => props.step.accept.join(' / '))

/**
 * Разбор ошибки по словам. Показать правильный ответ целиком мало:
 * на длинной фразе непонятно, где именно разошлось.
 */
const diff = computed(() => diffWords(value.value, closestAnswer(value.value, props.step.accept)))

function check() {
  if (checked.value || !value.value.trim()) return
  checked.value = true
  emit('answer', correct.value)
}
</script>

<template>
  <div>
    <p class="text-sm text-muted">{{ t('Напишите по-английски') }}</p>
    <p class="mt-3 text-[clamp(1.125rem,4vw,1.5rem)] leading-snug">{{ step.phrase.ru }}</p>

    <form class="mt-4 sm:mt-5" @submit.prevent="check">
      <input
        ref="field"
        v-model="value"
        type="text"
        lang="en"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        :readonly="checked"
        :aria-label="t('Английская фраза')"
        class="field font-serif text-lg"
        :class="checked ? (correct ? 'option-correct' : 'option-wrong') : ''"
      />
      <button v-if="!checked" type="submit" class="btn-primary mt-4" :disabled="!value.trim()">{{ t('Проверить') }}</button>
    </form>

    <template v-if="checked && !correct">
      <p class="mt-4 sm:mt-5 text-sm text-muted">{{ t('Вы написали') }}</p>
      <!-- Пробел внутри слова, а не отдельным узлом: между тегами его съедает сборка,
           а раскладкой через flex слова разъезжаются переносами при копировании. -->
      <p lang="en" class="mt-1 font-serif text-lg">
        <span
          v-for="(part, index) in diff.typed"
          :key="`t-${index}`"
          :class="part.same ? '' : 'text-bad line-through'"
          >{{ index < diff.typed.length - 1 ? `${part.text} ` : part.text }}</span
        >
      </p>

      <p class="mt-3 text-sm text-muted">{{ t('Правильно') }}</p>
      <p lang="en" class="mt-1 font-serif text-lg">
        <span
          v-for="(part, index) in diff.expected"
          :key="`e-${index}`"
          :class="part.same ? '' : 'marker font-semibold'"
          >{{ index < diff.expected.length - 1 ? `${part.text} ` : part.text }}</span
        >
      </p>
      <p v-if="step.accept.length > 1" class="mt-2 text-sm text-muted">
        {{ t('Подошло бы и так:') }} <span lang="en" class="font-serif">{{ expected }}</span>
      </p>
    </template>

    <!-- Регистр, апостроф и точка в конце ошибкой не считаются, но написание покажем как в главе. -->
    <p v-else-if="checked && value.trim() !== step.phrase.en" class="mt-4 sm:mt-5 text-sm text-muted">
      {{ t('В главе записано так:') }} <span lang="en" class="font-serif">{{ step.phrase.en }}</span>
    </p>
  </div>
</template>
