import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { addDays, daysBetween, isDayKey, today, type DayKey } from '@/utils/date'
import { dueAfter, FIRST_BOX, isLearned, LAST_BOX, nextBox } from '@/utils/leitner'

const STORAGE_KEY = 'english-phrases:progress'
const DATA_VERSION = 1

/** Сколько дней занятий храним: года календаря хватает, дальше файл только растёт. */
const MAX_DAYS = 400

export interface PhraseProgress {
  /** Глава фразы. Храним здесь, чтобы считать прогресс по главам, не загружая их. */
  chapter: string
  /** Коробка Лейтнера, 1…5. */
  box: number
  /** День, с которого фразу пора повторить. */
  due: DayKey
  /** Сколько занятий прошла и в скольких были ошибки. */
  seen: number
  wrong: number
  updated: DayKey
}

export interface ProgressData {
  version: number
  phrases: Record<string, PhraseProgress>
  /** День занятия → сколько ответов в этот день. Из ключей считается серия. */
  days: Record<DayKey, number>
}

function emptyData(): ProgressData {
  return { version: DATA_VERSION, phrases: {}, days: {} }
}

function isProgress(value: unknown): value is PhraseProgress {
  if (!value || typeof value !== 'object') return false
  const p = value as Record<string, unknown>
  // Про главу намеренно не спрашиваем: она нужна только счётчикам по главам,
  // и запись без неё терять нельзя — это живой прогресс пользователя.
  return (
    typeof p.box === 'number' &&
    p.box >= FIRST_BOX &&
    p.box <= LAST_BOX &&
    isDayKey(p.due) &&
    typeof p.seen === 'number' &&
    typeof p.wrong === 'number'
  )
}

/**
 * Разбор сохранённого файла. Чужие и битые записи молча отбрасываем:
 * лучше потерять одну строку, чем уронить приложение на старте.
 */
export function parseProgress(raw: unknown): ProgressData | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  if (source.version !== DATA_VERSION) return null

  const data = emptyData()

  if (source.phrases && typeof source.phrases === 'object') {
    for (const [id, value] of Object.entries(source.phrases as Record<string, unknown>)) {
      if (isProgress(value)) {
        data.phrases[id] = {
          chapter: typeof value.chapter === 'string' ? value.chapter : '',
          box: value.box,
          due: value.due,
          seen: Math.max(0, Math.round(value.seen)),
          wrong: Math.max(0, Math.round(value.wrong)),
          updated: isDayKey(value.updated) ? value.updated : value.due,
        }
      }
    }
  }

  if (source.days && typeof source.days === 'object') {
    for (const [day, count] of Object.entries(source.days as Record<string, unknown>)) {
      if (isDayKey(day) && typeof count === 'number' && count > 0) data.days[day] = Math.round(count)
    }
  }

  return data
}

function read(): ProgressData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return emptyData()
    return parseProgress(JSON.parse(saved)) ?? emptyData()
  } catch {
    // Недоступное или испорченное хранилище не должно мешать заниматься.
    return emptyData()
  }
}

export interface SessionOutcome {
  phraseId: string
  chapterId: string
  /** Верны ли были все ответы по этой фразе за занятие. */
  correct: boolean
  /** Сколько ответов дали по фразе — идёт в счётчик дня. */
  answers: number
}

export const useProgressStore = defineStore('progress', () => {
  const data = ref<ProgressData>(read())

  watch(
    data,
    (value) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
      } catch {
        // Не сохранили — занятие всё равно продолжается.
      }
    },
    { deep: true },
  )

  function get(phraseId: string): PhraseProgress | null {
    return data.value.phrases[phraseId] ?? null
  }

  function boxOf(phraseId: string): number {
    return data.value.phrases[phraseId]?.box ?? 0
  }

  /** Итог занятия: коробка каждой фразы меняется один раз, а не после каждого ответа. */
  function commitSession(outcomes: SessionOutcome[]) {
    if (outcomes.length === 0) return
    const day = today()
    const phrases = { ...data.value.phrases }
    let answers = 0

    for (const outcome of outcomes) {
      const previous = phrases[outcome.phraseId]
      const box = nextBox(previous?.box ?? 0, outcome.correct)
      phrases[outcome.phraseId] = {
        chapter: outcome.chapterId,
        box,
        due: dueAfter(day, box),
        seen: (previous?.seen ?? 0) + 1,
        wrong: (previous?.wrong ?? 0) + (outcome.correct ? 0 : 1),
        updated: day,
      }
      answers += outcome.answers
    }

    const days = { ...data.value.days, [day]: (data.value.days[day] ?? 0) + answers }
    data.value = { ...data.value, phrases, days: trimDays(days) }
  }

  function trimDays(days: Record<DayKey, number>): Record<DayKey, number> {
    const keys = Object.keys(days).sort()
    if (keys.length <= MAX_DAYS) return days
    const kept: Record<DayKey, number> = {}
    for (const key of keys.slice(-MAX_DAYS)) kept[key] = days[key]!
    return kept
  }

  /** ID фраз, которым подошёл срок. Порядок — от самых просроченных. */
  function dueIds(on: DayKey = today()): string[] {
    return Object.entries(data.value.phrases)
      .filter(([, progress]) => progress.due <= on)
      .sort((a, b) => (a[1].due < b[1].due ? -1 : a[1].due > b[1].due ? 1 : a[1].box - b[1].box))
      .map(([id]) => id)
  }

  /** Ближайший день, когда появится что повторять. */
  const nextDueDay = computed<DayKey | null>(() => {
    const days = Object.values(data.value.phrases).map((p) => p.due)
    return days.length ? days.reduce((min, day) => (day < min ? day : min)) : null
  })

  const startedCount = computed(() => Object.keys(data.value.phrases).length)

  /** Сколько фраз начато и выучено в каждой главе. */
  const countsByChapter = computed(() => {
    const counts: Record<string, { started: number; learned: number }> = {}
    for (const entry of Object.values(data.value.phrases)) {
      // У записей из старых копий главы может не быть — счётчик её просто не учтёт.
      if (!entry.chapter) continue
      const row = (counts[entry.chapter] ??= { started: 0, learned: 0 })
      row.started += 1
      if (isLearned(entry.box)) row.learned += 1
    }
    return counts
  })
  const learnedCount = computed(() => Object.values(data.value.phrases).filter((p) => isLearned(p.box)).length)

  /**
   * Серия: сколько дней подряд были занятия, считая от сегодня.
   * Если сегодня ещё не занимались, серия со вчера жива — день не закончился.
   */
  const streak = computed(() => {
    const days = data.value.days
    const now = today()
    let day = days[now] ? now : addDays(now, -1)
    let count = 0
    while (days[day]) {
      count += 1
      day = addDays(day, -1)
    }
    return count
  })

  /** Самая длинная серия за всё время. */
  const bestStreak = computed(() => {
    const keys = Object.keys(data.value.days).sort()
    let best = 0
    let run = 0
    let previous: DayKey | null = null
    for (const day of keys) {
      run = previous && daysBetween(previous, day) === 1 ? run + 1 : 1
      best = Math.max(best, run)
      previous = day
    }
    return best
  })

  /** Сколько фраз лежит в каждой коробке: 1 — только начата, 5 — выучена. */
  const boxCounts = computed(() => {
    const counts = Array.from({ length: LAST_BOX }, () => 0)
    for (const entry of Object.values(data.value.phrases)) {
      const index = Math.min(Math.max(entry.box, FIRST_BOX), LAST_BOX) - 1
      counts[index] = (counts[index] ?? 0) + 1
    }
    return counts
  })

  const totalAnswers = computed(() => Object.values(data.value.days).reduce((sum, n) => sum + n, 0))

  const activeDays = computed(() => Object.keys(data.value.days).length)

  /** Ответов в конкретный день — для календаря занятий. */
  function answersOn(day: DayKey): number {
    return data.value.days[day] ?? 0
  }

  const activeToday = computed(() => Boolean(data.value.days[today()]))

  const answersToday = computed(() => data.value.days[today()] ?? 0)

  /** Сколько дней прошло с последнего занятия — чтобы не хвалить серию зря. */
  const daysSinceLast = computed(() => {
    const keys = Object.keys(data.value.days).sort()
    const last = keys.at(-1)
    return last ? daysBetween(last, today()) : null
  })

  function exportJson(): string {
    return JSON.stringify(data.value, null, 2)
  }

  /** Возвращает число восстановленных фраз или null, если файл не подошёл. */
  function importJson(text: string): number | null {
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      return null
    }
    const parsed = parseProgress(raw)
    if (!parsed) return null
    data.value = parsed
    return Object.keys(parsed.phrases).length
  }

  function reset() {
    data.value = emptyData()
  }

  return {
    data,
    get,
    boxOf,
    commitSession,
    dueIds,
    nextDueDay,
    startedCount,
    learnedCount,
    countsByChapter,
    streak,
    bestStreak,
    boxCounts,
    totalAnswers,
    activeDays,
    answersOn,
    activeToday,
    answersToday,
    daysSinceLast,
    exportJson,
    importJson,
    reset,
  }
})
