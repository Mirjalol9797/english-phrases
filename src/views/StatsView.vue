<script setup lang="ts">
import { computed } from 'vue'
import { useContentStore } from '@/stores/content'
import { useProgressStore } from '@/stores/progress'
import { useAsyncData } from '@/composables/useAsyncData'
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import StatusMessage from '@/components/StatusMessage.vue'
import { plural, itemForms } from '@/utils/plural'
import { addDays, formatDay, today, weekdayOf, type DayKey } from '@/utils/date'
import { LEARNED_INTERVAL } from '@/utils/sm2'

/** Календарь занятий: 18 недель назад — примерно четыре месяца, помещается в ширину экрана. */
const WEEKS = 18

const content = useContentStore()
const progress = useProgressStore()

useDocumentTitle(() => 'Статистика')

const { data: index, loading, error, reload } = useAsyncData(
  () => 'stats',
  () => content.loadIndex(),
)

const DAY_FORMS: [string, string, string] = ['день', 'дня', 'дней']
const ANSWER_FORMS: [string, string, string] = ['ответ', 'ответа', 'ответов']

/** Недели календаря, каждая — семь дней с понедельника. Последний столбец кончается сегодня. */
const calendar = computed(() => {
  const end = today()
  // Отступаем до конца текущей недели, чтобы строки шли ровно по дням недели.
  const lastDay = addDays(end, 6 - weekdayOf(end))
  const weeks: { day: DayKey; answers: number; future: boolean }[][] = []

  for (let week = WEEKS - 1; week >= 0; week--) {
    const start = addDays(lastDay, -(week * 7 + 6))
    weeks.push(
      Array.from({ length: 7 }, (_, i) => {
        const day = addDays(start, i)
        return { day, answers: progress.answersOn(day), future: day > end }
      }),
    )
  }
  return weeks
})

const maxAnswers = computed(() =>
  Math.max(1, ...calendar.value.flat().map((cell) => cell.answers)),
)

/** Насыщенность клетки календаря: от едва заметной до полной. */
function cellStyle(answers: number) {
  if (answers === 0) return { background: 'var(--line)' }
  const share = Math.min(1, answers / maxAnswers.value)
  return { background: 'var(--marker)', opacity: String(0.35 + share * 0.65) }
}

const maxBucket = computed(() => Math.max(1, ...progress.intervalBuckets.map((b) => b.count)))

/** Прогресс по главам: берём названия из индекса, числа — из прогресса. */
const chapters = computed(() =>
  (index.value?.chapters ?? [])
    .map((chapter) => ({
      ...chapter,
      ...(progress.countsByChapter[chapter.id] ?? { started: 0, learned: 0 }),
    }))
    .filter((chapter) => chapter.started > 0),
)
</script>

<template>
  <section>
    <h1 class="text-xl sm:text-2xl font-semibold">Статистика</h1>

    <template v-if="progress.startedCount === 0">
      <p class="mt-3 max-w-prose text-muted">
        Пока пусто. Пройдите первый урок — здесь появятся серия дней, календарь занятий и то,
        насколько прочно сидит каждая фраза.
      </p>
      <RouterLink to="/chapters" class="btn-primary mt-5 sm:mt-6">Выбрать главу</RouterLink>
    </template>

    <template v-else>
      <!-- Сводка -->
      <dl class="mt-4 sm:mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div class="rounded-xl border border-line px-4 py-3">
          <dt class="text-sm text-muted">Серия</dt>
          <dd class="mt-1 text-xl sm:text-2xl font-semibold tabular-nums">{{ progress.streak }}</dd>
          <dd class="text-xs text-muted">лучшая — {{ progress.bestStreak }}</dd>
        </div>
        <div class="rounded-xl border border-line px-4 py-3">
          <dt class="text-sm text-muted">Выучено</dt>
          <dd class="mt-1 text-xl sm:text-2xl font-semibold tabular-nums">{{ progress.learnedCount }}</dd>
          <dd class="text-xs text-muted">из {{ progress.startedCount }} начатых</dd>
        </div>
        <div class="rounded-xl border border-line px-4 py-3">
          <dt class="text-sm text-muted">Дней занятий</dt>
          <dd class="mt-1 text-xl sm:text-2xl font-semibold tabular-nums">{{ progress.activeDays }}</dd>
          <dd class="text-xs text-muted">{{ plural(progress.totalAnswers, ANSWER_FORMS) }}</dd>
        </div>
        <div class="rounded-xl border border-line px-4 py-3">
          <dt class="text-sm text-muted">Трудных</dt>
          <dd class="mt-1 text-xl sm:text-2xl font-semibold tabular-nums">{{ progress.hardCount }}</dd>
          <dd class="text-xs text-muted">
            <RouterLink v-if="progress.hardCount" to="/review" class="underline underline-offset-2">
              повторить
            </RouterLink>
            <template v-else>сейчас чисто</template>
          </dd>
        </div>
        <div class="rounded-xl border border-line px-4 py-3">
          <dt class="text-sm text-muted">Сегодня</dt>
          <dd class="mt-1 text-xl sm:text-2xl font-semibold tabular-nums">{{ progress.answersToday }}</dd>
          <dd class="text-xs text-muted">
            <RouterLink to="/review" class="underline underline-offset-2">к повторению {{ progress.dueIds().length }}</RouterLink>
          </dd>
        </div>
      </dl>

      <!-- Календарь занятий -->
      <h2 class="mt-6 sm:mt-8 text-lg font-semibold">Занятия</h2>
      <p class="mt-1 text-sm text-muted">Последние {{ WEEKS }} недель. Чем ярче, тем больше ответов в тот день.</p>
      <div class="mt-3 overflow-x-auto">
        <div class="flex gap-1">
          <div v-for="(week, w) in calendar" :key="w" class="flex flex-col gap-1">
            <div
              v-for="cell in week"
              :key="cell.day"
              class="h-3.5 w-3.5 rounded-sm"
              :class="cell.future ? 'opacity-0' : ''"
              :style="cell.future ? undefined : cellStyle(cell.answers)"
              :title="`${formatDay(cell.day)} — ${cell.answers ? plural(cell.answers, ANSWER_FORMS) : 'не занимались'}`"
            />
          </div>
        </div>
      </div>

      <!-- Насколько прочно сидят фразы -->
      <h2 class="mt-6 sm:mt-8 text-lg font-semibold">Прочность</h2>
      <p class="mt-1 text-sm text-muted">
        Перерыв у каждой фразы свой: отвечаете верно — он растёт, ошибаетесь — возвращается к двум дням.
        Выученной фраза считается с перерыва в {{ plural(LEARNED_INTERVAL, DAY_FORMS) }}.
      </p>
      <ol class="mt-3 space-y-2">
        <li v-for="bucket in progress.intervalBuckets" :key="bucket.label" class="flex items-center gap-3">
          <span class="w-28 shrink-0 text-sm text-muted">{{ bucket.label }}</span>
          <span class="h-5 flex-1 overflow-hidden rounded-sm bg-line">
            <span
              class="block h-full rounded-sm"
              :class="bucket.from >= LEARNED_INTERVAL ? 'bg-ok' : 'bg-marker'"
              :style="{ width: `${(bucket.count / maxBucket) * 100}%` }"
            />
          </span>
          <span class="w-16 shrink-0 text-right text-sm tabular-nums">{{ bucket.count }}</span>
        </li>
      </ol>

      <!-- Главы -->
      <StatusMessage v-if="loading || error" :loading="loading" :error="error" @retry="reload" />
      <template v-else-if="chapters.length">
        <h2 class="mt-6 sm:mt-8 text-lg font-semibold">Главы</h2>
        <ol class="mt-3 divide-y divide-line border-y border-line">
          <li v-for="chapter in chapters" :key="chapter.id" class="py-3">
            <div class="flex items-baseline justify-between gap-4">
              <RouterLink :to="`/chapters/${chapter.id}`" lang="en" class="font-serif text-lg hover:underline">
                {{ chapter.title.en }}
              </RouterLink>
              <span class="shrink-0 text-sm text-muted tabular-nums">
                {{ chapter.learned }} / {{ chapter.started }} из {{ chapter.phraseCount }}
              </span>
            </div>
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
              <div class="h-full bg-ok" :style="{ width: `${(chapter.learned / chapter.phraseCount) * 100}%` }" />
            </div>
            <p class="mt-1 text-xs text-muted">
              выучено {{ chapter.learned }}, начато {{ plural(chapter.started, itemForms(chapter.kind)) }}
            </p>
          </li>
        </ol>
      </template>

      <p v-if="progress.nextDueDay" class="mt-6 sm:mt-8 text-sm text-muted">
        Ближайшее повторение — {{ formatDay(progress.nextDueDay) }}.
      </p>
    </template>
  </section>
</template>
