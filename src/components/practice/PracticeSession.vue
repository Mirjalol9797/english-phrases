<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useSpeech } from '@/composables/useSpeech'
import AppIcon from '@/components/AppIcon.vue'
import PracticeCard from './PracticeCard.vue'
import ChoiceExercise from './ChoiceExercise.vue'
import AssembleExercise from './AssembleExercise.vue'
import TypingExercise from './TypingExercise.vue'
import ListenExercise from './ListenExercise.vue'
import FormsExercise from './FormsExercise.vue'
import { EXERCISE_ORDER, EXERCISE_TITLES } from '@/utils/practice'
import { isPhraseDone } from '@/utils/session'
import { isTypingTarget, useHasKeyboard, useWindowKey } from '@/composables/useWindowKey'
import type { ExerciseKind, PracticeStep, StepResult } from '@/types/practice'

/**
 * Прохождение набора шагов: карточки, упражнения, полоса прогресса и звук.
 * Что именно проходим и что делать с результатом — забота родителя,
 * поэтому компонент одинаково подходит и уроку, и повторению.
 */
const props = defineProps<{
  steps: PracticeStep[]
  /** Куда ведёт крестик выхода. */
  exitTo: string
  /** Подпись вместо «Знакомство» на карточках, если набор не из урока. */
  cardLabel?: string
}>()

const emit = defineEmits<{
  /** Фраза прошла все свои упражнения — её результат можно записывать. */
  phraseDone: [results: StepResult[]]
  finish: [results: StepResult[]]
}>()

const settings = useSettingsStore()
const { supported: speechSupported, speaking, speak, stop: stopSpeech } = useSpeech()

const index = ref(0)
const answered = ref(false)
const results = ref<StepResult[]>([])

/** Что уже отдано наверх: нельзя записать одну фразу дважды. */
let saved = new Set<string>()

function savePhrase(phraseId: string) {
  if (saved.has(phraseId)) return
  const own = results.value.filter((r) => r.phrase.id === phraseId)
  if (own.length === 0) return
  saved.add(phraseId)
  emit('phraseDone', own)
}

/**
 * Записать всё, что успели ответить. Нужно при выходе на середине:
 * этапы идут подряд по всем фразам, поэтому к середине занятия
 * ни одна фраза ещё не закончена, и иначе работа пропала бы целиком.
 */
function saveUnfinished() {
  for (const id of new Set(results.value.map((r) => r.phrase.id))) savePhrase(id)
}

// Новый набор шагов (повтор ошибок, следующий урок) начинается с начала.
watch(
  () => props.steps,
  () => {
    saveUnfinished()
    index.value = 0
    answered.value = false
    results.value = []
    saved = new Set()
    stopSpeech()
  },
)

// Уход с экрана и закрытие вкладки — тоже выход с середины.
onMounted(() => window.addEventListener('pagehide', saveUnfinished))
onBeforeUnmount(() => {
  window.removeEventListener('pagehide', saveUnfinished)
  saveUnfinished()
})

const step = computed<PracticeStep | null>(() => props.steps[index.value] ?? null)

const cardStep = computed(() => (step.value?.kind === 'card' ? step.value : null))
const choiceStep = computed(() =>
  step.value?.kind === 'choice-ru' || step.value?.kind === 'choice-en' ? step.value : null,
)
const listenStep = computed(() => (step.value?.kind === 'listen' ? step.value : null))
const assembleStep = computed(() => (step.value?.kind === 'assemble' ? step.value : null))
const typingStep = computed(() => (step.value?.kind === 'typing' ? step.value : null))
const formsStep = computed(() => (step.value?.kind === 'forms' ? step.value : null))

const progress = computed(() =>
  props.steps.length ? Math.round((Math.min(index.value, props.steps.length) / props.steps.length) * 100) : 0,
)

/** Этапы, которые реально есть в наборе: у однословных фраз сборки не будет. */
const stages = computed(() => EXERCISE_ORDER.filter((kind) => props.steps.some((s) => s.kind === kind)))

/** «Знакомство · 3 из 10» или «Этап 2 из 4 · Выбор фразы · 5 из 10». */
const position = computed(() => {
  const current = step.value
  if (!current) return null
  const sameKind = props.steps.filter((s) => s.kind === current.kind)
  const inStage = `${sameKind.indexOf(current) + 1} из ${sameKind.length}`
  if (current.kind === 'card') return `${props.cardLabel ?? 'Знакомство'} · ${inStage}`
  const number = stages.value.indexOf(current.kind) + 1
  return `Этап ${number} из ${stages.value.length} · ${EXERCISE_TITLES[current.kind]} · ${inStage}`
})

function onAnswer(correct: boolean) {
  const current = step.value
  if (!current || current.kind === 'card' || answered.value) return
  answered.value = true
  results.value.push({ phrase: current.phrase, kind: current.kind as ExerciseKind, correct })

  if (isPhraseDone(props.steps, index.value)) savePhrase(current.phrase.id)
}

function next() {
  stopSpeech()
  if (index.value >= props.steps.length - 1) {
    emit('finish', [...results.value])
    return
  }
  index.value += 1
  answered.value = false
}

/** У карточки нет ответа, поэтому «Дальше» доступно сразу. */
const canGoNext = computed(() => step.value?.kind === 'card' || answered.value)
const isLast = computed(() => index.value === props.steps.length - 1)

const autoSpeak = computed(() => settings.speechEnabled && speechSupported.value)

const hasKeyboard = useHasKeyboard()

/**
 * Enter листает дальше. В поле ввода его не перехватываем: там он сначала
 * проверяет ответ, а до нас событие дойдёт уже следующим нажатием.
 */
useWindowKey((event) => {
  if (event.key !== 'Enter' || !canGoNext.value) return
  if (isTypingTarget(event.target) && !answered.value) return
  event.preventDefault()
  next()
})

/** Что напомнить про клавиши на текущем шаге. */
const keyboardHint = computed(() => {
  if (!hasKeyboard.value) return null
  if (answered.value || step.value?.kind === 'card') return 'Enter — дальше'
  if (listenStep.value) return 'Цифры — ответ, пробел — повторить'
  if (choiceStep.value) return 'Цифры — ответ, Enter — дальше'
  if (assembleStep.value) return 'Enter — проверить, Backspace — убрать слово'
  if (typingStep.value) return 'Enter — проверить'
  return null
})
</script>

<template>
  <div v-if="step">
    <div class="flex items-center gap-3">
      <RouterLink :to="exitTo" class="link-back shrink-0" aria-label="Выйти из занятия">
        <AppIcon name="close" :size="18" />
      </RouterLink>

      <div class="h-2 flex-1 overflow-hidden rounded-full bg-line">
        <div
          class="h-full rounded-full bg-marker transition-[width] duration-200"
          :style="{ width: `${progress}%` }"
          role="progressbar"
          :aria-valuenow="progress"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Прогресс занятия"
        />
      </div>

      <button
        v-if="speechSupported"
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink"
        :aria-label="settings.speechEnabled ? 'Выключить автоозвучку' : 'Включить автоозвучку'"
        :aria-pressed="settings.speechEnabled"
        @click="settings.speechEnabled = !settings.speechEnabled"
      >
        <AppIcon :name="settings.speechEnabled ? 'volume' : 'volume-off'" :size="19" />
      </button>
    </div>

    <p class="mt-4 text-sm text-muted">{{ position }}</p>

    <div class="mt-4">
      <PracticeCard
        v-if="cardStep"
        :key="`card-${index}`"
        :phrase="cardStep.phrase"
        :speak="speak"
        :speech-supported="speechSupported"
        :auto-speak="autoSpeak"
      />
      <ChoiceExercise
        v-else-if="choiceStep"
        :key="`choice-${index}`"
        :step="choiceStep"
        :speak="speak"
        :speech-supported="speechSupported"
        @answer="onAnswer"
      />
      <ListenExercise
        v-else-if="listenStep"
        :key="`listen-${index}`"
        :step="listenStep"
        :speak="speak"
        :speaking="speaking"
        @answer="onAnswer"
      />
      <AssembleExercise v-else-if="assembleStep" :key="`assemble-${index}`" :step="assembleStep" @answer="onAnswer" />
      <TypingExercise v-else-if="typingStep" :key="`typing-${index}`" :step="typingStep" @answer="onAnswer" />
      <FormsExercise v-else-if="formsStep" :key="`forms-${index}`" :step="formsStep" @answer="onAnswer" />
    </div>

    <div class="mt-6 sm:mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
      <button type="button" class="btn-primary" :disabled="!canGoNext" @click="next">
        {{ isLast ? 'Завершить' : 'Дальше' }}
      </button>
      <p v-if="!canGoNext" class="text-sm text-muted">Ответьте, чтобы продолжить.</p>
      <p v-if="keyboardHint" class="text-xs text-muted">{{ keyboardHint }}</p>
    </div>
  </div>
</template>
