<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useContentStore } from '@/stores/content'
import { useProgressStore } from '@/stores/progress'
import { useSettingsStore } from '@/stores/settings'
import { useSpeech } from '@/composables/useSpeech'
import { useAsyncData } from '@/composables/useAsyncData'
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import StatusMessage from '@/components/StatusMessage.vue'
import ChapterFilter from '@/components/ChapterFilter.vue'
import { byLoad, chapterFilters } from '@/utils/filters'
import PracticeSession from '@/components/practice/PracticeSession.vue'
import { buildReview } from '@/utils/practice'
import { toOutcomes } from '@/utils/session'
import { plural, itemForms, ENTRY_FORMS } from '@/utils/plural'
import { formatDay, today } from '@/utils/date'
import { plural as pluralOf } from '@/utils/plural'
import type { Phrase } from '@/types/content'
import type { PracticeStep, StepResult } from '@/types/practice'

/** За один заход повторяем не больше: длинная очередь отпугивает сильнее, чем помогает. */
const BATCH_SIZE = 20

const DAY_FORMS: [string, string, string] = ['день', 'дня', 'дней']

const content = useContentStore()
const progress = useProgressStore()
const settings = useSettingsStore()
const { supported: speechSupported } = useSpeech()

/**
 * Этапы повторения: выбранные в настройках, но «На слух» отпадает,
 * если английского голоса нет или звук выключен — отвечать нечем.
 */
const stages = computed(() =>
  settings.enabledStages.filter(
    (kind) => kind !== 'listen' || (speechSupported.value && settings.speechEnabled),
  ),
)

useDocumentTitle(() => 'Повторение')

/**
 * Грузим только те главы, фразы которых сегодня понадобятся: к повторению
 * и трудные. Их обычно одна-две, а не двенадцать. В какой главе фраза —
 * записано в самом прогрессе, содержимое для этого открывать не нужно.
 */
const { data: chapters, loading, error, reload } = useAsyncData(
  () => 'review',
  () => {
    const needed = new Set<string>()
    let unknown = false
    for (const id of [...progress.dueIds(), ...progress.hardestIds(BATCH_SIZE)]) {
      const chapter = progress.get(id)?.chapter
      if (chapter) needed.add(chapter)
      // Записи из старых копий своей главы не знают — тогда придётся открыть всё.
      else unknown = true
    }
    return unknown ? content.loadAllChapters() : content.loadChapters([...needed])
  },
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

/**
 * Выбранная глава. К повторению приходит всё вперемешку — фразы, слова Oxford
 * и глаголы, — а это разные занятия. Чип ограничивает заход одной главой.
 * Пустая строка — все главы.
 */
const chapterId = ref('')

/** Записи с их главой: ID, которых уже нет в данных, просто пропускаем. */
function resolve(ids: string[]) {
  return ids
    .map((id) => byId.value.get(id))
    .filter((entry): entry is { phrase: Phrase; chapterId: string } => Boolean(entry))
}

function inChapter<T extends { chapterId: string }>(entries: T[]): T[] {
  return chapterId.value ? entries.filter((entry) => entry.chapterId === chapterId.value) : entries
}

/** Всё, чему подошёл срок, без учёта выбранной главы — по нему считаются числа на чипсах. */
const dueAll = computed(() => resolve(progress.dueIds(today())))

const dueEntries = computed(() => inChapter(dueAll.value))
const due = computed(() => dueEntries.value.map((entry) => entry.phrase))

/**
 * Записи, на которых чаще всего ошибались. Срок здесь не важен.
 *
 * Без выбранной главы берём ровно столько, сколько грузилось глав, — иначе
 * записи незагруженных глав отсеялись бы и список молча съехал бы вниз
 * по трудности. Внутри одной главы можно брать с запасом: сама она загружена,
 * а её трудные могут и не попасть в общую двадцатку.
 */
const hardAll = computed(() => resolve(progress.hardestIds(BATCH_SIZE)))

const hardEntries = computed(() => {
  if (!chapterId.value) return hardAll.value
  return inChapter(resolve(progress.hardestIds(BATCH_SIZE * 10))).slice(0, BATCH_SIZE)
})
const hard = computed(() => hardEntries.value.map((entry) => entry.phrase))

/** Названия глав — для чипсов и для подписи под записью. */
const titleOf = computed(() => {
  const map = new Map<string, string>()
  for (const chapter of chapters.value ?? []) map.set(chapter.id, chapter.title.en)
  return map
})

/**
 * Как называть то, что повторяем. В одной главе это фразы, слова или глаголы,
 * а во всех сразу — вперемешку, и общее слово им «запись».
 */
const entryForms = computed(() => {
  const chapter = (chapters.value ?? []).find((c) => c.id === chapterId.value)
  return chapter ? itemForms(chapter.kind) : ENTRY_FORMS
})

/**
 * Чем занят экран: обычно срочным, а когда срок пуст — трудными. Чипсы считают
 * именно это, иначе в день без повторений они показывали бы нули, а «Повторить
 * трудные» шло бы вперемешку по всем главам.
 */
const subject = computed(() => (dueAll.value.length ? dueAll.value : hardAll.value))

/** Главы, в которых сегодня есть чем заняться. Пустые в список не попадают. */
const filters = computed(() =>
  byLoad(
    chapterFilters(
      subject.value,
      (chapters.value ?? []).map((chapter) => ({ id: chapter.id, title: chapter.title.en })),
    ),
  ),
)

// Глава могла кончиться, пока шло занятие: тогда фильтр снимаем, иначе экран
// выглядел бы пустым без видимой причины.
watch(subject, (entries) => {
  if (chapterId.value && !entries.some((entry) => entry.chapterId === chapterId.value)) chapterId.value = ''
})

const steps = shallowRef<PracticeStep[]>([])
const results = ref<StepResult[] | null>(null)
const running = ref(false)

const correctCount = computed(() => results.value?.filter((r) => r.correct).length ?? 0)

function start(batch: Phrase[]) {
  if (batch.length === 0) return
  results.value = null
  steps.value = buildReview(batch, (phrase) => progress.levelOf(phrase.id), {
    near: batch,
    far: allPhrases.value,
    stages: stages.value,
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

      <template v-else>
        <!-- К повторению приходит всё вперемешку: фразы, слова и глаголы.
             Чип сужает заход до одной главы — это разные занятия. В день без
             срочного он так же делит трудные. -->
        <ChapterFilter v-model="chapterId" :options="filters" label="Глава для повторения" class="mt-4" />

        <template v-if="due.length === 0">
          <p class="mt-4 text-muted">Сегодня повторять нечего.</p>
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
          <p class="mt-4 text-muted">
            Пора повторить {{ plural(due.length, entryForms) }}.
            <template v-if="due.length > BATCH_SIZE">За один заход — {{ BATCH_SIZE }}.</template>
          </p>

          <div class="mt-5 sm:mt-6 flex flex-wrap gap-3">
            <button type="button" class="btn-primary" @click="startReview">Начать повторение</button>
            <button v-if="hard.length" type="button" class="btn-quiet" @click="startHard">Сначала трудные</button>
          </div>

          <ol class="mt-6 sm:mt-8 divide-y divide-line border-y border-line">
            <li
              v-for="entry in dueEntries.slice(0, BATCH_SIZE)"
              :key="entry.phrase.id"
              class="flex items-baseline gap-3 py-2 sm:py-3"
            >
              <span class="w-16 shrink-0 text-xs text-muted tabular-nums">
                {{ pluralOf(progress.get(entry.phrase.id)?.interval ?? 0, DAY_FORMS) }}
              </span>
              <span class="min-w-0 flex-1">
                <span lang="en" class="block font-serif text-lg leading-snug">{{ entry.phrase.en }}</span>
                <span class="block text-sm leading-snug text-muted">{{ entry.phrase.ru }}</span>
                <!-- Когда главу не выбирали, по записи не видно, откуда она. -->
                <span v-if="!chapterId" lang="en" class="mt-0.5 block font-serif text-xs text-muted">
                  {{ titleOf.get(entry.chapterId) }}
                </span>
              </span>
            </li>
          </ol>
          <p class="mt-3 text-sm text-muted">
            Слева — нынешний перерыв: через столько дней фраза вернётся, если ответить верно.
          </p>
        </template>
      </template>

      <!-- Где чаще всего спотыкаемся. Эти данные копились всё время, но нигде не показывались. -->
      <template v-if="hardEntries.length">
        <h2 class="mt-6 sm:mt-8 text-lg font-semibold">Трудные</h2>
        <p v-if="chapterId" class="mt-1 text-sm text-muted">Здесь ошибались чаще всего в этой главе.</p>
        <p v-else class="mt-1 text-sm text-muted">
          Здесь ошибались чаще всего — {{ plural(progress.hardCount, ENTRY_FORMS) }} за всё время.
        </p>
        <ol class="mt-3 divide-y divide-line border-y border-line">
          <li v-for="entry in hardEntries" :key="entry.phrase.id" class="flex items-baseline gap-3 py-2 sm:py-3">
            <span class="w-14 shrink-0 text-xs text-bad tabular-nums">
              {{ progress.get(entry.phrase.id)?.wrong }} из {{ progress.get(entry.phrase.id)?.seen }}
            </span>
            <span class="min-w-0 flex-1">
              <span lang="en" class="block font-serif text-base leading-snug sm:text-lg">{{ entry.phrase.en }}</span>
              <span class="block text-sm leading-snug text-muted">{{ entry.phrase.ru }}</span>
              <span v-if="!chapterId" lang="en" class="mt-0.5 block font-serif text-xs text-muted">
                {{ titleOf.get(entry.chapterId) }}
              </span>
            </span>
          </li>
        </ol>
        <p class="mt-3 text-sm text-muted">Слева — на скольких занятиях из пройденных была ошибка.</p>
      </template>
    </section>
  </template>
</template>
