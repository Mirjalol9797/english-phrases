import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { parseProgress, useProgressStore, type SessionOutcome } from './progress'
import { addDays, today } from '@/utils/date'
import { DEFAULT_EASE, MIN_INTERVAL, SECOND_INTERVAL } from '@/utils/sm2'

/** Простая замена localStorage: хранилище в памяти, тех же методов достаточно. */
function fakeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  } as Storage
}

const outcome = (phraseId: string, correct: boolean, answers = 1): SessionOutcome => ({
  phraseId,
  chapterId: 'everyday-english',
  correct,
  answers,
})

/** Запись прогресса целиком: в тестах меняем только то, что проверяем. */
const row = (extra: Record<string, unknown> = {}) => ({
  chapter: 'c',
  firstSeen: '2026-10-15',
  interval: 6,
  ease: DEFAULT_EASE,
  reps: 2,
  due: '2026-10-20',
  seen: 1,
  wrong: 0,
  updated: '2026-10-15',
  ...extra,
})

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage())
  setActivePinia(createPinia())
})

describe('parseProgress', () => {
  const valid = { version: 1, phrases: { EE001: row() }, days: { '2026-10-15': 37 } }

  it('читает свой файл', () => {
    const data = parseProgress(valid)
    expect(data!.phrases.EE001!.interval).toBe(6)
    expect(data!.phrases.EE001!.reps).toBe(2)
    expect(data!.days['2026-10-15']).toBe(37)
  })

  it('не теряет запись без главы', () => {
    // Глава нужна только счётчикам по главам. Из-за неё прогресс терять нельзя.
    const { chapter: _chapter, ...withoutChapter } = row()
    const data = parseProgress({ ...valid, phrases: { EE001: withoutChapter } })
    expect(data!.phrases.EE001).toBeDefined()
    expect(data!.phrases.EE001!.chapter).toBe('')
    expect(data!.phrases.EE001!.interval).toBe(6)
  })

  it('отбрасывает битые записи, но оставляет целые', () => {
    const data = parseProgress({
      ...valid,
      phrases: {
        EE001: row(),
        EE002: { chapter: 'x', due: '2026-10-17', seen: 1, wrong: 0 }, // расписания нет вовсе
        EE003: row({ due: 'вчера' }),
        EE004: 'не объект',
      },
    })
    expect(Object.keys(data!.phrases)).toEqual(['EE001'])
  })

  it('отбрасывает дни не того формата', () => {
    const data = parseProgress({ ...valid, days: { '2026-10-15': 5, 'позавчера': 3, '2026-10-16': 0 } })
    expect(Object.keys(data!.days)).toEqual(['2026-10-15'])
  })

  it('не берёт файл чужой версии и мусор', () => {
    expect(parseProgress({ ...valid, version: 2 })).toBeNull()
    expect(parseProgress({ hello: 1 })).toBeNull()
    expect(parseProgress(null)).toBeNull()
    expect(parseProgress('строка')).toBeNull()
  })
})

describe('перенос старого прогресса с коробок Лейтнера', () => {
  /** Старая запись: коробка вместо перерыва и счёт ошибок подряд вместо коэффициента. */
  const old = (extra: Record<string, unknown>) =>
    parseProgress({
      version: 1,
      phrases: {
        EE001: { chapter: 'c', due: '2026-10-17', seen: 4, wrong: 0, misses: 0, updated: '2026-10-15', ...extra },
      },
      days: {},
    })!.phrases.EE001!

  it('коробка становится соразмерным перерывом', () => {
    expect(old({ box: 1 }).interval).toBe(MIN_INTERVAL)
    expect(old({ box: 4 }).interval).toBe(10)
    expect(old({ box: 5 }).interval).toBe(21)
  })

  it('число верных ответов подряд берётся из коробки', () => {
    expect(old({ box: 4 }).reps).toBe(4)
  })

  it('накопленные ошибки роняют коэффициент, а не теряются', () => {
    expect(old({ box: 4, wrong: 0 }).ease).toBe(DEFAULT_EASE)
    expect(old({ box: 4, wrong: 1 }).ease).toBeCloseTo(2.18, 5)
    expect(old({ box: 4, wrong: 3 }).ease).toBeLessThan(old({ box: 4, wrong: 1 }).ease)
  })

  it('коробка вне диапазона не ломает перенос', () => {
    expect(old({ box: 99 }).interval).toBe(21)
    expect(old({ box: -3 }).interval).toBe(MIN_INTERVAL)
  })

  it('перенесённую запись второй раз не трогает', () => {
    // Иначе при каждом открытии приложения перерыв сбрасывался бы заново.
    const once = old({ box: 4, wrong: 1 })
    const twice = parseProgress({ version: 1, phrases: { EE001: once }, days: {} })!.phrases.EE001!
    expect(twice.interval).toBe(once.interval)
    expect(twice.ease).toBe(once.ease)
    expect(twice.reps).toBe(once.reps)
  })
})

describe('commitSession', () => {
  it('заводит новую фразу с самым коротким перерывом', () => {
    const progress = useProgressStore()
    progress.commitSession([outcome('EE001', true)])
    expect(progress.get('EE001')!.interval).toBe(MIN_INTERVAL)
    expect(progress.levelOf('EE001')).toBe(1)
    expect(progress.get('EE001')!.chapter).toBe('everyday-english')
  })

  it('изученное сегодня не возвращается завтра', () => {
    const progress = useProgressStore()
    progress.commitSession([outcome('EE001', true), outcome('EE002', false)])
    expect(progress.dueIds(today())).toEqual([])
    expect(progress.dueIds(addDays(today(), 1))).toEqual([])
    expect(progress.dueIds(addDays(today(), 2)).sort()).toEqual(['EE001', 'EE002'])
  })

  it('перерыв растёт с каждым занятием без ошибок', () => {
    const progress = useProgressStore()
    const intervals: number[] = []
    for (let i = 0; i < 3; i++) {
      progress.commitSession([outcome('EE001', true)])
      intervals.push(progress.get('EE001')!.interval)
    }
    expect(intervals).toEqual([MIN_INTERVAL, SECOND_INTERVAL, 15])
  })

  it('ошибка возвращает фразу в начало лестницы и роняет коэффициент', () => {
    const progress = useProgressStore()
    for (let i = 0; i < 4; i++) progress.commitSession([outcome('EE001', true)])
    expect(progress.get('EE001')!.interval).toBe(38)

    progress.commitSession([outcome('EE001', false)])
    expect(progress.get('EE001')!.interval).toBe(MIN_INTERVAL)
    expect(progress.levelOf('EE001')).toBe(0)
    expect(progress.get('EE001')!.wrong).toBe(1)
    expect(progress.get('EE001')!.ease).toBeCloseTo(2.18, 5)
  })

  it('у фразы с ошибками перерывы растут медленнее, чем у лёгкой', () => {
    const progress = useProgressStore()
    progress.commitSession([outcome('трудная', false)])
    for (let i = 0; i < 3; i++) {
      progress.commitSession([outcome('трудная', true), outcome('лёгкая', true)])
    }
    expect(progress.get('трудная')!.interval).toBeLessThan(progress.get('лёгкая')!.interval)
  })

  it('копит ответы дня и не теряет прежние', () => {
    const progress = useProgressStore()
    progress.commitSession([outcome('EE001', true, 4)])
    progress.commitSession([outcome('EE002', true, 3)])
    expect(progress.answersToday).toBe(7)
    expect(progress.startedCount).toBe(2)
  })

  it('на пустом списке ничего не делает', () => {
    const progress = useProgressStore()
    progress.commitSession([])
    expect(progress.startedCount).toBe(0)
    expect(progress.answersToday).toBe(0)
  })

  it('сохраняет результат в хранилище', async () => {
    const progress = useProgressStore()
    progress.commitSession([outcome('EE001', true)])
    // Запись идёт через watcher, то есть на следующем тике, а не сразу.
    await nextTick()
    const saved = JSON.parse(localStorage.getItem('english-phrases:progress')!)
    expect(saved.phrases.EE001.interval).toBe(MIN_INTERVAL)
  })
})

describe('isStarted', () => {
  it('различает начатую и незнакомую фразу', () => {
    const progress = useProgressStore()
    expect(progress.isStarted('EE001')).toBe(false)
    progress.commitSession([outcome('EE001', true)])
    expect(progress.isStarted('EE001')).toBe(true)
  })
})

describe('dueIds', () => {
  it('отдаёт только те фразы, чей срок подошёл', () => {
    const progress = useProgressStore()
    progress.commitSession([outcome('EE001', true)])
    expect(progress.dueIds(today())).toEqual([])
    expect(progress.dueIds('2026-12-31')).toEqual(['EE001'])
  })

  it('ставит вперёд самые просроченные', () => {
    const progress = useProgressStore()
    progress.data = {
      version: 1,
      phrases: {
        EE001: row({ due: '2026-10-14', updated: '2026-10-13' }),
        EE002: row({ due: '2026-10-10', updated: '2026-10-09' }),
        EE003: row({ due: '2026-10-12', updated: '2026-10-11' }),
      },
      days: {},
    }
    expect(progress.dueIds('2026-10-15')).toEqual(['EE002', 'EE003', 'EE001'])
  })
})

describe('трудные фразы', () => {
  /** Коротко собрать прогресс с нужными числами ошибок. */
  function withCounts(rows: Record<string, { seen: number; wrong: number; interval?: number; due?: string }>) {
    const progress = useProgressStore()
    progress.data = {
      version: 1,
      phrases: Object.fromEntries(
        Object.entries(rows).map(([id, r]) => [id, row({ ...r, firstSeen: '2026-10-01' })]),
      ),
      days: {},
    }
    return progress
  }

  it('считает только те, где были ошибки', () => {
    const progress = withCounts({ a: { seen: 3, wrong: 2 }, b: { seen: 3, wrong: 0 }, c: { seen: 1, wrong: 1 } })
    expect(progress.hardCount).toBe(2)
    expect(progress.hardestIds()).toEqual(['a', 'c'])
  })

  it('вперёд ставит ту, где ошибок больше', () => {
    const progress = withCounts({ редкая: { seen: 10, wrong: 1 }, частая: { seen: 10, wrong: 5 } })
    expect(progress.hardestIds()).toEqual(['частая', 'редкая'])
  })

  it('при равном числе ошибок вперёд идёт та, где доля выше', () => {
    // Две ошибки из трёх занятий тяжелее, чем две из десяти.
    const progress = withCounts({ изДесяти: { seen: 10, wrong: 2 }, изТрёх: { seen: 3, wrong: 2 } })
    expect(progress.hardestIds()).toEqual(['изТрёх', 'изДесяти'])
  })

  it('полный список трудных не обрезается двадцаткой', () => {
    // Экран повторения считает по нему главы: верхней двадцатки не хватает,
    // в ней может не быть глав, где трудные есть.
    const counts = Object.fromEntries(
      Array.from({ length: 25 }, (_, i) => [`ф${i}`, { seen: 5, wrong: 1 }]),
    )
    const progress = withCounts(counts)
    expect(progress.hardIds()).toHaveLength(25)
    expect(progress.hardestIds()).toHaveLength(20)
  })

  it('полный список и верхняя двадцатка идут в одном порядке', () => {
    const progress = withCounts({ лёгкая: { seen: 10, wrong: 1 }, трудная: { seen: 3, wrong: 3 } })
    expect(progress.hardIds()).toEqual(['трудная', 'лёгкая'])
    expect(progress.hardestIds(1)).toEqual(['трудная'])
  })

  it('отдаёт не больше запрошенного', () => {
    const progress = withCounts({ a: { seen: 2, wrong: 1 }, b: { seen: 2, wrong: 1 }, c: { seen: 2, wrong: 1 } })
    expect(progress.hardestIds(2)).toHaveLength(2)
  })

  it('без ошибок список пуст', () => {
    const progress = withCounts({ a: { seen: 5, wrong: 0 } })
    expect(progress.hardestIds()).toEqual([])
    expect(progress.hardCount).toBe(0)
  })

  it('среди однодневок к повторению вперёд идут трудные', () => {
    const progress = withCounts({
      лёгкая: { seen: 5, wrong: 0, due: '2026-10-10' },
      трудная: { seen: 5, wrong: 3, due: '2026-10-10' },
      просроченная: { seen: 5, wrong: 0, due: '2026-10-05' },
    })
    // Самая просроченная всё равно первая: срок важнее.
    expect(progress.dueIds('2026-10-15')).toEqual(['просроченная', 'трудная', 'лёгкая'])
  })
})

describe('серия дней', () => {
  it('считает дни подряд, упираясь в пропуск', () => {
    const progress = useProgressStore()
    progress.data = {
      version: 1,
      phrases: {},
      days: { '2026-10-15': 1, '2026-10-14': 1, '2026-10-13': 1, '2026-10-11': 1 },
    }
    vi.setSystemTime(new Date(2026, 9, 15))
    expect(progress.streak).toBe(3)
    vi.useRealTimers()
  })

  it('не обнуляет серию, пока сегодняшний день не закончился', () => {
    const progress = useProgressStore()
    progress.data = { version: 1, phrases: {}, days: { '2026-10-14': 1, '2026-10-13': 1 } }
    vi.setSystemTime(new Date(2026, 9, 15))
    expect(progress.streak).toBe(2)
    vi.useRealTimers()
  })

  it('обнуляет серию после пропущенного дня', () => {
    const progress = useProgressStore()
    progress.data = { version: 1, phrases: {}, days: { '2026-10-13': 1 } }
    vi.setSystemTime(new Date(2026, 9, 15))
    expect(progress.streak).toBe(0)
    vi.useRealTimers()
  })

  it('находит самую длинную серию за всё время', () => {
    const progress = useProgressStore()
    progress.data = {
      version: 1,
      phrases: {},
      days: {
        '2026-09-01': 1, '2026-09-02': 1, '2026-09-03': 1, '2026-09-04': 1,
        '2026-10-14': 1, '2026-10-15': 1,
      },
    }
    vi.setSystemTime(new Date(2026, 9, 15))
    expect(progress.bestStreak).toBe(4)
    vi.useRealTimers()
  })
})

describe('дневной предел новых фраз', () => {
  it('новой считается фраза, которой ещё не было', () => {
    const progress = useProgressStore()
    expect(progress.isNew('EE001')).toBe(true)
    progress.commitSession([outcome('EE001', true)])
    expect(progress.isNew('EE001')).toBe(false)
  })

  it('считает только взятые сегодня', () => {
    const progress = useProgressStore()
    progress.commitSession([outcome('EE001', true), outcome('EE002', true)])
    expect(progress.newToday).toBe(2)

    // Повторное занятие по тем же фразам новых не добавляет.
    progress.commitSession([outcome('EE001', true)])
    expect(progress.newToday).toBe(2)
  })

  it('не считает новыми фразы из прошлых дней', () => {
    const progress = useProgressStore()
    progress.data = { version: 1, phrases: { старая: row({ firstSeen: '2026-10-01' }) }, days: {} }
    vi.setSystemTime(new Date(2026, 9, 15))
    expect(progress.newToday).toBe(0)
    vi.useRealTimers()
  })

  it('записи из старых копий без дня новыми не становятся', () => {
    // Иначе при первом же обновлении весь прежний прогресс засчитался бы за сегодня.
    const { firstSeen: _firstSeen, ...withoutDay } = row()
    const data = parseProgress({ version: 1, phrases: { EE001: withoutDay }, days: {} })
    expect(data!.phrases.EE001!.firstSeen).toBe('')
  })

  it('остаток считается от предела, ноль — без ограничения', () => {
    const progress = useProgressStore()
    progress.commitSession([outcome('EE001', true), outcome('EE002', true)])
    expect(progress.newLeftToday(10)).toBe(8)
    expect(progress.newLeftToday(2)).toBe(0)
    expect(progress.newLeftToday(1)).toBe(0)
    expect(progress.newLeftToday(0)).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('счётчики', () => {
  it('раскладывает фразы по длине перерыва', () => {
    const progress = useProgressStore()
    progress.data = {
      version: 1,
      phrases: {
        a: row({ interval: 2 }),
        b: row({ interval: 7 }),
        c: row({ interval: 10 }),
        d: row({ interval: 90 }),
      },
      days: {},
    }
    expect(progress.intervalBuckets.map((b) => b.count)).toEqual([1, 2, 1])
    // Последний столбик — ровно выученные: порог у них общий.
    expect(progress.learnedCount).toBe(1)
    expect(progress.intervalBuckets.at(-1)!.count).toBe(progress.learnedCount)
  })

  it('считает прогресс по главам и пропускает записи без главы', () => {
    const progress = useProgressStore()
    progress.data = {
      version: 1,
      phrases: {
        a: row({ chapter: 'everyday-english', interval: 40 }),
        b: row({ chapter: 'everyday-english', interval: 6 }),
        c: row({ chapter: '', interval: 6 }),
      },
      days: {},
    }
    expect(progress.countsByChapter['everyday-english']).toEqual({ started: 2, learned: 1 })
    expect(progress.countsByChapter['']).toBeUndefined()
  })
})

describe('копия и сброс', () => {
  it('переживает выгрузку и загрузку', () => {
    const progress = useProgressStore()
    progress.commitSession([outcome('EE001', true), outcome('EE002', false)])
    const dump = progress.exportJson()

    progress.reset()
    expect(progress.startedCount).toBe(0)

    expect(progress.importJson(dump)).toBe(2)
    expect(progress.startedCount).toBe(2)
    expect(progress.levelOf('EE001')).toBe(1)
  })

  it('не трогает прогресс, если файл чужой', () => {
    const progress = useProgressStore()
    progress.commitSession([outcome('EE001', true)])
    expect(progress.importJson('{"hello":1}')).toBeNull()
    expect(progress.importJson('не json')).toBeNull()
    expect(progress.startedCount).toBe(1)
  })
})
