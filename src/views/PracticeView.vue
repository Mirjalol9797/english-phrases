<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from '@/i18n'
import { useRoute } from 'vue-router'
import { useContentStore } from '@/stores/content'
import { useProgressStore } from '@/stores/progress'
import { useSettingsStore } from '@/stores/settings'
import { useAsyncData } from '@/composables/useAsyncData'
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import StatusMessage from '@/components/StatusMessage.vue'
import PracticeSession from '@/components/practice/PracticeSession.vue'
import { buildPractice, buildRepeat } from '@/utils/practice'
import { toOutcomes } from '@/utils/session'
import { formatDay } from '@/utils/date'
import { splitIntoParts } from '@/utils/parts'
import { useSpeech } from '@/composables/useSpeech'
import type { Phrase } from '@/types/content'
import type { ExerciseKind, PracticeStep, StepResult } from '@/types/practice'

const { plural } = useI18n()

const props = defineProps<{ lessonId: string }>()

const content = useContentStore()
const progress = useProgressStore()
const settings = useSettingsStore()
const route = useRoute()
const { supported: speechSupported } = useSpeech()

/**
 * Этапы занятия: выбранные в настройках, но «На слух» отпадает,
 * если английского голоса нет или звук выключен — отвечать нечем.
 */
const stages = computed(() =>
  settings.enabledStages.filter(
    (kind) => kind !== 'listen' || (speechSupported.value && settings.speechEnabled),
  ),
)


const { data: ctx, loading, error, notFound, reload } = useAsyncData(
  () => props.lessonId,
  () => content.loadLesson(props.lessonId),
)

const steps = shallowRef<PracticeStep[]>([])
const results = ref<StepResult[] | null>(null)

/** Урок, разбитый на части по размеру занятия из настроек. */
const parts = computed(() => splitIntoParts(ctx.value?.lesson.phrases ?? [], settings.sessionSize))

/** Какую часть проходим. Номер в адресе человеческий, с единицы. */
const partIndex = computed(() => {
  const asked = Number(route.query.part)
  if (!Number.isInteger(asked) || asked < 1 || asked > parts.value.length) return 0
  return asked - 1
})

const sessionPhrases = computed(() => parts.value[partIndex.value] ?? [])

const split = computed(() => parts.value.length > 1)
const hasNextPart = computed(() => partIndex.value < parts.value.length - 1)

const finished = computed(() => results.value !== null)
const correctCount = computed(() => results.value?.filter((r) => r.correct).length ?? 0)
const wrongAnswers = computed(() => results.value?.filter((r) => !r.correct) ?? [])

/** Для списка в итоге фразы нужны без повторов: одна могла провалить несколько этапов. */
const mistakenPhrases = computed(() => {
  const byId = new Map<string, Phrase>()
  for (const result of wrongAnswers.value) byId.set(result.phrase.id, result.phrase)
  return [...byId.values()]
})

/** Когда фразы урока снова попросят повторить. */
const nextReview = computed(() => {
  const days = (ctx.value?.lesson.phrases ?? [])
    .map((phrase) => progress.get(phrase.id)?.due)
    .filter((day): day is string => Boolean(day))
  return days.length ? days.reduce((min, day) => (day < min ? day : min)) : null
})

function pools() {
  const current = ctx.value!
  return {
    near: current.lesson.phrases,
    far: current.chapter.lessons.flatMap((lesson) => lesson.phrases),
    stages: stages.value,
  }
}

function startLesson(phrases: Phrase[]) {
  if (!ctx.value) return
  results.value = null
  steps.value = buildPractice(phrases, { ...pools(), withCards: true })
}

/** Перезапуск текущей части: нужен и при смене урока, и при переходе между частями. */
function startCurrentPart() {
  startLesson(sessionPhrases.value)
}

function repeatMistakes(mistakes: { phrase: Phrase; kind: ExerciseKind }[]) {
  if (!ctx.value) return
  results.value = null
  steps.value = buildRepeat(mistakes, pools())
}

// Смена урока, номера части в адресе или размера занятия начинает заново.
watch([ctx, partIndex, () => settings.sessionSize], () => {
  if (ctx.value) startCurrentPart()
})

/** Запись идёт по ходу занятия, по одной фразе — см. PracticeSession. */
function onPhraseDone(phraseResults: StepResult[]) {
  if (!ctx.value) return
  progress.commitSession(toOutcomes(phraseResults, () => ctx.value!.chapter.id))
}

function onFinish(sessionResults: StepResult[]) {
  results.value = sessionResults
}

useDocumentTitle(() => (ctx.value ? `Урок: ${ctx.value.lesson.title.ru}` : 'Урок'))
</script>

<template>
  <StatusMessage v-if="loading || error" :loading="loading" :error="error" :not-found="notFound" @retry="reload" />

  <section v-else-if="ctx">
    <PracticeSession
      v-if="!finished"
      :steps="steps"
      :exit-to="`/lessons/${ctx.lesson.id}`"
      @phrase-done="onPhraseDone"
      @finish="onFinish"
    />

    <div v-else class="mt-5 sm:mt-6">
      <p class="text-sm text-muted">
        {{ split ? `Часть ${partIndex + 1} из ${parts.length} пройдена` : 'Урок пройден' }}
      </p>
      <h1 class="mt-2 text-[clamp(1.5rem,6vw,2.5rem)] leading-tight font-semibold">
        <span class="marker">{{ correctCount }} из {{ results?.length ?? 0 }}</span>
      </h1>
      <p class="mt-3 text-muted">
        {{
          mistakenPhrases.length === 0
            ? 'Без единой ошибки.'
            : `Стоит повторить ${plural(mistakenPhrases.length, 'phraseAcc')}.`
        }}
      </p>
      <p v-if="nextReview" class="mt-1 text-sm text-muted">
        Следующее повторение — {{ formatDay(nextReview) }}.
      </p>

      <ol v-if="mistakenPhrases.length" class="mt-4 sm:mt-5 divide-y divide-line border-y border-line">
        <li v-for="phrase in mistakenPhrases" :key="phrase.id" class="py-2 sm:py-3">
          <p lang="en" class="font-serif text-lg leading-snug">{{ phrase.en }}</p>
          <p class="mt-0.5 text-sm leading-snug text-muted">{{ phrase.ru }}</p>
        </li>
      </ol>

      <div class="mt-5 sm:mt-6 flex flex-wrap gap-3">
        <button
          v-if="wrongAnswers.length"
          type="button"
          class="btn-primary"
          @click="repeatMistakes(wrongAnswers.map(({ phrase, kind }) => ({ phrase, kind })))"
        >
          Повторить ошибки
        </button>
        <RouterLink
          v-if="hasNextPart"
          :to="`/lessons/${ctx.lesson.id}/practice?part=${partIndex + 2}`"
          class="btn-quiet"
        >
          Следующая часть
        </RouterLink>
        <button type="button" class="btn-quiet" @click="startCurrentPart">
          {{ split ? 'Пройти часть заново' : 'Пройти заново' }}
        </button>
        <RouterLink v-if="!hasNextPart && ctx.next" :to="`/lessons/${ctx.next.id}/practice`" class="btn-quiet">
          Следующий урок
        </RouterLink>
        <RouterLink :to="`/lessons/${ctx.lesson.id}`" class="btn-quiet">К уроку</RouterLink>
        <RouterLink :to="`/chapters/${ctx.chapter.id}`" class="btn-quiet">К главе</RouterLink>
      </div>
    </div>
  </section>
</template>
