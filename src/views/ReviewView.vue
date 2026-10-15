<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { useContentStore } from '@/stores/content'
import { useProgressStore } from '@/stores/progress'
import { useAsyncData } from '@/composables/useAsyncData'
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import StatusMessage from '@/components/StatusMessage.vue'
import PracticeSession from '@/components/practice/PracticeSession.vue'
import { buildReview } from '@/utils/practice'
import { toOutcomes } from '@/utils/session'
import { plural, PHRASE_FORMS } from '@/utils/plural'
import { formatDay, today } from '@/utils/date'
import { LAST_BOX } from '@/utils/leitner'
import type { Phrase } from '@/types/content'
import type { PracticeStep, StepResult } from '@/types/practice'

/** За один заход повторяем не больше: длинная очередь отпугивает сильнее, чем помогает. */
const BATCH_SIZE = 20

const content = useContentStore()
const progress = useProgressStore()

useDocumentTitle(() => 'Повторение')

const { data: chapters, loading, error, reload } = useAsyncData(
  () => 'review',
  () => content.loadAllChapters(),
)

/** Все фразы по ID — нужно, чтобы по прогрессу найти саму фразу и её главу. */
const byId = computed(() => {
  const map = new Map<string, { phrase: Phrase; chapterId: string }>()
  for (const chapter of chapters.value ?? []) {
    for (const lesson of chapter.lessons) {
      for (const phrase of lesson.phrases) map.set(phrase.id, { phrase, chapterId: chapter.id })
    }
  }
  return map
})

const allPhrases = computed(() => [...byId.value.values()].map((entry) => entry.phrase))

/** Фразы, которым подошёл срок. Удалённые из данных ID просто пропускаем. */
const due = computed(() =>
  progress
    .dueIds(today())
    .map((id) => byId.value.get(id)?.phrase)
    .filter((phrase): phrase is Phrase => Boolean(phrase)),
)

/** Фразы, на которых чаще всего ошибались. Срок здесь не важен. */
const hard = computed(() =>
  progress
    .hardestIds(BATCH_SIZE)
    .map((id) => byId.value.get(id)?.phrase)
    .filter((phrase): phrase is Phrase => Boolean(phrase)),
)

const steps = shallowRef<PracticeStep[]>([])
const results = ref<StepResult[] | null>(null)
const running = ref(false)

const correctCount = computed(() => results.value?.filter((r) => r.correct).length ?? 0)

function start(batch: Phrase[]) {
  if (batch.length === 0) return
  results.value = null
  steps.value = buildReview(batch, (phrase) => progress.boxOf(phrase.id), {
    near: batch,
    far: allPhrases.value,
  })
  running.value = true
}

const startReview = () => start(due.value.slice(0, BATCH_SIZE))
const startHard = () => start(hard.value)

/** Запись идёт по ходу занятия, по одной фразе — см. PracticeSession. */
function onPhraseDone(phraseResults: StepResult[]) {
  progress.commitSession(toOutcomes(phraseResults, (id) => byId.value.get(id)?.chapterId ?? ''))
}

function onFinish(sessionResults: StepResult[]) {
  results.value = sessionResults
  running.value = false
}
</script>

<template>
  <StatusMessage v-if="loading || error" :loading="loading" :error="error" @retry="reload" />

  <template v-else-if="chapters">
    <PracticeSession
      v-if="running"
      :steps="steps"
      exit-to="/review"
      card-label="Повторение"
      @phrase-done="onPhraseDone"
      @finish="onFinish"
    />

    <section v-else>
      <h1 class="text-xl sm:text-2xl font-semibold">Повторение</h1>

      <!-- Итог только что законченного захода. -->
      <p v-if="results" class="mt-3">
        <span class="marker text-lg font-medium">{{ correctCount }} из {{ results.length }}</span>
      </p>

      <template v-if="progress.startedCount === 0">
        <p class="mt-3 max-w-prose text-muted">
          Здесь появятся фразы, которые пора освежить. Система сама решает когда: чем увереннее
          отвечаете, тем реже спрашивает — от следующего дня до трёх недель.
        </p>
        <RouterLink to="/chapters" class="btn-primary mt-5 sm:mt-6">Начать первый урок</RouterLink>
      </template>

      <template v-else-if="due.length === 0">
        <p class="mt-3 text-muted">Сегодня повторять нечего.</p>
        <p v-if="progress.nextDueDay" class="mt-1 text-muted">
          Следующее повторение — {{ formatDay(progress.nextDueDay) }}.
        </p>
        <div class="mt-5 sm:mt-6 flex flex-wrap gap-3">
          <button v-if="hard.length" type="button" class="btn-primary" @click="startHard">
            Повторить трудные
          </button>
          <RouterLink to="/chapters" class="btn-quiet">Учить новое</RouterLink>
        </div>
      </template>

      <template v-else>
        <p class="mt-3 text-muted">
          Пора повторить {{ plural(due.length, PHRASE_FORMS) }}.
          <template v-if="due.length > BATCH_SIZE">За один заход — {{ BATCH_SIZE }}.</template>
        </p>

        <div class="mt-5 sm:mt-6 flex flex-wrap gap-3">
          <button type="button" class="btn-primary" @click="startReview">Начать повторение</button>
          <button v-if="hard.length" type="button" class="btn-quiet" @click="startHard">Сначала трудные</button>
        </div>

        <ol class="mt-6 sm:mt-8 divide-y divide-line border-y border-line">
          <li v-for="phrase in due.slice(0, BATCH_SIZE)" :key="phrase.id" class="flex items-baseline gap-3 py-3">
            <span class="w-10 shrink-0 text-xs text-muted tabular-nums">
              {{ progress.boxOf(phrase.id) }} / {{ LAST_BOX }}
            </span>
            <span class="min-w-0 flex-1">
              <span lang="en" class="block font-serif text-lg leading-snug">{{ phrase.en }}</span>
              <span class="block text-sm text-muted">{{ phrase.ru }}</span>
            </span>
          </li>
        </ol>
        <p class="mt-3 text-sm text-muted">Слева — коробка: чем выше, тем реже фраза будет возвращаться.</p>
      </template>

      <!-- Где чаще всего спотыкаемся. Эти данные копились всё время, но нигде не показывались. -->
      <template v-if="progress.startedCount > 0 && hard.length">
        <h2 class="mt-6 sm:mt-8 text-lg font-semibold">Трудные фразы</h2>
        <p class="mt-1 text-sm text-muted">
          Здесь ошибались чаще всего — {{ plural(progress.hardCount, PHRASE_FORMS) }} за всё время.
        </p>
        <ol class="mt-3 divide-y divide-line border-y border-line">
          <li v-for="phrase in hard" :key="phrase.id" class="flex items-baseline gap-3 py-3">
            <span class="w-14 shrink-0 text-xs text-bad tabular-nums">
              {{ progress.get(phrase.id)?.wrong }} из {{ progress.get(phrase.id)?.seen }}
            </span>
            <span class="min-w-0 flex-1">
              <span lang="en" class="block font-serif text-base leading-snug sm:text-lg">{{ phrase.en }}</span>
              <span class="block text-sm text-muted">{{ phrase.ru }}</span>
            </span>
          </li>
        </ol>
        <p class="mt-3 text-sm text-muted">Слева — на скольких занятиях из пройденных была ошибка.</p>
      </template>
    </section>
  </template>
</template>
