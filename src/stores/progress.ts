import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { addDays, daysBetween, isDayKey, today, type DayKey } from '@/utils/date'
import {
  DEFAULT_EASE,
  dueAfter,
  easeAfterMistakes,
  isLearned,
  LEARNED_INTERVAL,
  levelOf,
  MIN_INTERVAL,
  newSchedule,
  nextSchedule,
  type Schedule,
} from '@/utils/sm2'

const STORAGE_KEY = 'english-phrases:progress'
const DATA_VERSION = 1

/** Сколько дней занятий храним: года календаря хватает, дальше файл только растёт. */
const MAX_DAYS = 400

export interface PhraseProgress {
  /** Глава фразы. Храним здесь, чтобы считать прогресс по главам, не загружая их. */
  chapter: string
  /** Перерыв в днях, коэффициент лёгкости и число верных ответов подряд — см. sm2.ts. */
  interval: number
  ease: number
  reps: number
  /** День, с которого фразу пора повторить. */
  due: DayKey
  /**
   * День, когда фраза впервые попала в обучение. Нужен дневному пределу
   * новых фраз. У записей из старых копий его нет — там пустая строка.
   */
  firstSeen: DayKey
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
  // Старые копии хранили коробку Лейтнера вместо перерыва — их переносим ниже.
  const hasSchedule = typeof p.interval === 'number' || typeof p.box === 'number'
  return hasSchedule && isDayKey(p.due) && typeof p.seen === 'number' && typeof p.wrong === 'number'
}

/**
 * Расписание записи. Старые копии хранили коробку Лейтнера — переводим её
 * в перерыв, а накопленные ошибки переносим в коэффициент лёгкости, чтобы
 * трудная фраза не начала вдруг расти как лёгкая.
 */
const BOX_TO_INTERVAL = [MIN_INTERVAL, MIN_INTERVAL, 5, 10, 21]

function scheduleFrom(value: Partial<PhraseProgress> & { box?: unknown }, wrong: number): Schedule {
  if (typeof value.interval === 'number') {
    return {
      interval: Math.max(MIN_INTERVAL, Math.round(value.interval)),
      ease: typeof value.ease === 'number' ? value.ease : DEFAULT_EASE,
      reps: typeof value.reps === 'number' ? Math.max(0, Math.round(value.reps)) : 0,
    }
  }

  const box = typeof value.box === 'number' ? Math.min(Math.max(Math.round(value.box), 1), 5) : 1
  return {
    interval: BOX_TO_INTERVAL[box - 1]!,
    ease: easeAfterMistakes(wrong),
    reps: box,
  }
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
        const wrong = Math.max(0, Math.round(value.wrong))
        data.phrases[id] = {
          chapter: typeof value.chapter === 'string' ? value.chapter : '',
          firstSeen: isDayKey(value.firstSeen) ? value.firstSeen : '',
          ...scheduleFrom(value, wrong),
          due: value.due,
          seen: Math.max(0, Math.round(value.seen)),
          wrong,
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

/** Подписи столбиков прочности. Снаружи — чтобы проверка словаря их видела. */
export const INTERVAL_BUCKET_LABELS = ['До недели', 'До трёх недель', 'Три недели и дольше'] as const

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

  /** Насколько сложно спрашивать фразу. Ноль — ещё не начинали. */
  function levelOfPhrase(phraseId: string): number {
    const entry = data.value.phrases[phraseId]
    return entry ? levelOf(entry) : 0
  }

  /** Начата ли фраза: запись о ней уже есть. */
  function isStarted(phraseId: string): boolean {
    return Boolean(data.value.phrases[phraseId])
  }

  /** Итог занятия: расписание каждой фразы меняется один раз, а не после каждого ответа. */
  function commitSession(outcomes: SessionOutcome[]) {
    if (outcomes.length === 0) return
    const day = today()
    const phrases = { ...data.value.phrases }
    let answers = 0

    for (const outcome of outcomes) {
      const previous = phrases[outcome.phraseId]
      const schedule = nextSchedule(previous ?? newSchedule(), outcome.correct)
      phrases[outcome.phraseId] = {
        chapter: outcome.chapterId,
        // Фраза новая, только если записи о ней ещё не было.
        // У старой записи без дня так и оставляем пусто: задним числом не выдумываем.
        firstSeen: previous ? previous.firstSeen : day,
        ...schedule,
        due: dueAfter(day, schedule.interval),
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

  /**
   * Насколько фраза даётся тяжело. Считаем по числу ошибок, а доля ошибок
   * идёт вторым признаком: у фразы, которую видели один раз и ошиблись,
   * доля стопроцентная, но доказательств этому мало.
   */
  /**
   * Сколько верных ответов подряд снимают пометку «трудная».
   * Один мог быть угадан, а после двух запись честно вернулась в строй.
   */
  const FORGIVE_AFTER = 2

  function hardnessOf(entry: PhraseProgress): number {
    return entry.wrong + (entry.seen > 0 ? entry.wrong / entry.seen : 0)
  }

  /**
   * ID фраз, которым подошёл срок. Сначала самые просроченные, среди
   * однодневок — те, на которых чаще ошибались.
   */
  function dueIds(on: DayKey = today()): string[] {
    return Object.entries(data.value.phrases)
      .filter(([, progress]) => progress.due <= on)
      .sort((a, b) => {
        if (a[1].due !== b[1].due) return a[1].due < b[1].due ? -1 : 1
        const hardness = hardnessOf(b[1]) - hardnessOf(a[1])
        return hardness !== 0 ? hardness : a[1].interval - b[1].interval
      })
      .map(([id]) => id)
  }

  /**
   * ID фраз, на которых ошибались чаще всего. Срок не смотрим:
   * такие стоит освежить, даже если система ещё не просит.
   */
  /**
   * Трудная ли запись сейчас.
   *
   * Одной ошибки за всё время мало: иначе запись оставалась бы в списке
   * навсегда, сколько её потом ни повторяй. Пометку снимают два верных ответа
   * подряд — reps в SM-2 считает именно их и обнуляется на ошибке, так что
   * одна осечка возвращает запись обратно.
   */
  const isHard = (entry: PhraseProgress) => entry.wrong > 0 && entry.reps < FORGIVE_AFTER

  /** Все трудные записи, от самых трудных к менее трудным. */
  function hardIds(): string[] {
    return Object.entries(data.value.phrases)
      .filter(([, progress]) => isHard(progress))
      .sort((a, b) => hardnessOf(b[1]) - hardnessOf(a[1]) || a[1].interval - b[1].interval)
      .map(([id]) => id)
  }

  function hardestIds(limit = 20): string[] {
    return hardIds().slice(0, limit)
  }

  /** Сколько записей даётся тяжело сейчас. */
  const hardCount = computed(() => Object.values(data.value.phrases).filter(isHard).length)

  /** Ближайший день, когда появится что повторять. */
  const nextDueDay = computed<DayKey | null>(() => {
    const days = Object.values(data.value.phrases).map((p) => p.due)
    return days.length ? days.reduce((min, day) => (day < min ? day : min)) : null
  })

  const startedCount = computed(() => Object.keys(data.value.phrases).length)

  /** Сколько новых фраз взяли сегодня — по этому числу работает дневной предел. */
  const newToday = computed(() => {
    const day = today()
    return Object.values(data.value.phrases).filter((entry) => entry.firstSeen === day).length
  })

  /** Сколько новых фраз ещё можно взять. Предел 0 — без ограничения. */
  function newLeftToday(limit: number): number {
    if (limit <= 0) return Number.POSITIVE_INFINITY
    return Math.max(0, limit - newToday.value)
  }

  /** Новая ли фраза: записи о ней ещё нет. */
  function isNew(phraseId: string): boolean {
    return !data.value.phrases[phraseId]
  }

  /** Сколько фраз начато и выучено в каждой главе. */
  const countsByChapter = computed(() => {
    const counts: Record<string, { started: number; learned: number }> = {}
    for (const entry of Object.values(data.value.phrases)) {
      // У записей из старых копий главы может не быть — счётчик её просто не учтёт.
      if (!entry.chapter) continue
      const row = (counts[entry.chapter] ??= { started: 0, learned: 0 })
      row.started += 1
      if (isLearned(entry)) row.learned += 1
    }
    return counts
  })
  const learnedCount = computed(() => Object.values(data.value.phrases).filter((p) => isLearned(p)).length)

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

  /**
   * Границы разбивки по срокам. Верхняя не входит в столбик, и последняя
   * граница — ровно порог выученной фразы: иначе выученные попадали бы
   * в середину, где они закрашены как ещё не выученные.
   */
  const INTERVAL_BUCKETS = [
    { label: INTERVAL_BUCKET_LABELS[0], upto: 7 },
    { label: INTERVAL_BUCKET_LABELS[1], upto: LEARNED_INTERVAL },
    { label: INTERVAL_BUCKET_LABELS[2], upto: Infinity },
  ]

  /** Сколько фраз на каком перерыве — вместо прежней разбивки по коробкам. */
  const intervalBuckets = computed(() =>
    INTERVAL_BUCKETS.map((bucket, i) => {
      const from = i === 0 ? 0 : INTERVAL_BUCKETS[i - 1]!.upto
      return {
        label: bucket.label,
        from,
        upto: bucket.upto,
        count: Object.values(data.value.phrases).filter(
          (entry) => entry.interval >= from && entry.interval < bucket.upto,
        ).length,
      }
    }),
  )

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
    levelOf: levelOfPhrase,
    isStarted,
    commitSession,
    dueIds,
    hardIds,
    hardestIds,
    hardCount,
    nextDueDay,
    startedCount,
    newToday,
    newLeftToday,
    isNew,
    learnedCount,
    countsByChapter,
    streak,
    bestStreak,
    intervalBuckets,
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
