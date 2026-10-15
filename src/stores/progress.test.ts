import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { parseProgress, useProgressStore, type SessionOutcome } from './progress'
import { today } from '@/utils/date'
import { LAST_BOX } from '@/utils/leitner'

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

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage())
  setActivePinia(createPinia())
})

describe('parseProgress', () => {
  const valid = {
    version: 1,
    phrases: { EE001: { chapter: 'everyday-english', box: 2, due: '2026-10-17', seen: 1, misses: 0, wrong: 0, updated: '2026-10-15' } },
    days: { '2026-10-15': 37 },
  }

  it('читает свой файл', () => {
    const data = parseProgress(valid)
    expect(data!.phrases.EE001!.box).toBe(2)
    expect(data!.days['2026-10-15']).toBe(37)
  })

  it('не теряет запись без главы', () => {
    // Глава нужна только счётчикам по главам. Из-за неё прогресс терять нельзя.
    const { chapter: _chapter, ...withoutChapter } = valid.phrases.EE001
    const data = parseProgress({ ...valid, phrases: { EE001: withoutChapter } })
    expect(data!.phrases.EE001).toBeDefined()
    expect(data!.phrases.EE001!.chapter).toBe('')
    expect(data!.phrases.EE001!.box).toBe(2)
  })

  it('отбрасывает битые записи, но оставляет целые', () => {
    const data = parseProgress({
      ...valid,
      phrases: {
        EE001: valid.phrases.EE001,
        EE002: { chapter: 'x', box: 99, due: '2026-10-17', seen: 1, wrong: 0 },
        EE003: { chapter: 'x', box: 2, due: 'вчера', seen: 1, wrong: 0 },
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

describe('commitSession', () => {
  it('заводит новую фразу в первую коробку', () => {
    const progress = useProgressStore()
    progress.commitSession([outcome('EE001', true)])
    expect(progress.boxOf('EE001')).toBe(1)
    expect(progress.get('EE001')!.chapter).toBe('everyday-english')
  })

  it('поднимает коробку за занятие без ошибок', () => {
    const progress = useProgressStore()
    progress.commitSession([outcome('EE001', true)])
    progress.commitSession([outcome('EE001', true)])
    progress.commitSession([outcome('EE001', true)])
    expect(progress.boxOf('EE001')).toBe(3)
  })

  it('первая ошибка опускает на коробку, а не в начало', () => {
    const progress = useProgressStore()
    for (let i = 0; i < 4; i++) progress.commitSession([outcome('EE001', true)])
    expect(progress.boxOf('EE001')).toBe(4)

    progress.commitSession([outcome('EE001', false)])
    expect(progress.boxOf('EE001')).toBe(3)
    expect(progress.get('EE001')!.wrong).toBe(1)
    expect(progress.get('EE001')!.misses).toBe(1)
  })

  it('вторая ошибка подряд роняет в первую коробку', () => {
    const progress = useProgressStore()
    for (let i = 0; i < 4; i++) progress.commitSession([outcome('EE001', true)])
    progress.commitSession([outcome('EE001', false)])
    progress.commitSession([outcome('EE001', false)])
    expect(progress.boxOf('EE001')).toBe(1)
    expect(progress.get('EE001')!.misses).toBe(2)
  })

  it('верный ответ обнуляет счёт ошибок подряд', () => {
    const progress = useProgressStore()
    for (let i = 0; i < 4; i++) progress.commitSession([outcome('EE001', true)])
    progress.commitSession([outcome('EE001', false)]) // 4 -> 3
    progress.commitSession([outcome('EE001', true)]) // 3 -> 4, счёт сброшен
    expect(progress.get('EE001')!.misses).toBe(0)

    // Значит следующая одиночная ошибка снова только на шаг назад.
    progress.commitSession([outcome('EE001', false)])
    expect(progress.boxOf('EE001')).toBe(3)
  })

  it('в старых копиях счёта ошибок нет — начинаем с нуля', () => {
    const data = parseProgress({
      version: 1,
      phrases: { EE001: { chapter: 'c', box: 4, due: '2026-10-17', seen: 4, wrong: 1, updated: '2026-10-15' } },
      days: {},
    })
    expect(data!.phrases.EE001!.misses).toBe(0)
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
    expect(saved.phrases.EE001.box).toBe(1)
  })
})

describe('dueIds', () => {
  it('отдаёт только те фразы, чей срок подошёл', () => {
    const progress = useProgressStore()
    progress.commitSession([outcome('EE001', true)]) // срок завтра
    expect(progress.dueIds(today())).toEqual([])
    expect(progress.dueIds('2026-12-31')).toEqual(['EE001'])
  })

  it('ставит вперёд самые просроченные', () => {
    const progress = useProgressStore()
    progress.data = {
      version: 1,
      phrases: {
        EE001: { chapter: 'c', firstSeen: '2026-10-15', box: 2, due: '2026-10-14', seen: 1, misses: 0, wrong: 0, updated: '2026-10-13' },
        EE002: { chapter: 'c', firstSeen: '2026-10-15', box: 2, due: '2026-10-10', seen: 1, misses: 0, wrong: 0, updated: '2026-10-09' },
        EE003: { chapter: 'c', firstSeen: '2026-10-15', box: 2, due: '2026-10-12', seen: 1, misses: 0, wrong: 0, updated: '2026-10-11' },
      },
      days: {},
    }
    expect(progress.dueIds('2026-10-15')).toEqual(['EE002', 'EE003', 'EE001'])
  })
})

describe('трудные фразы', () => {
  /** Коротко собрать прогресс с нужными числами ошибок. */
  function withCounts(rows: Record<string, { seen: number; wrong: number; box?: number; due?: string }>) {
    const progress = useProgressStore()
    progress.data = {
      version: 1,
      phrases: Object.fromEntries(
        Object.entries(rows).map(([id, r]) => [
          id,
          {
            chapter: 'c',
            firstSeen: '2026-10-01',
            box: r.box ?? 2,
            due: r.due ?? '2026-10-20',
            seen: r.seen,
            wrong: r.wrong,
            misses: 0,
            updated: '2026-10-15',
          },
        ]),
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
    progress.data = {
      version: 1,
      phrases: {
        старая: { chapter: 'c', firstSeen: '2026-10-01', box: 2, due: '2026-10-17', seen: 1, misses: 0, wrong: 0, updated: '2026-10-01' },
      },
      days: {},
    }
    vi.setSystemTime(new Date(2026, 9, 15))
    expect(progress.newToday).toBe(0)
    vi.useRealTimers()
  })

  it('записи из старых копий без дня новыми не становятся', () => {
    // Иначе при первом же обновлении весь прежний прогресс засчитался бы за сегодня.
    const data = parseProgress({
      version: 1,
      phrases: { EE001: { chapter: 'c', box: 2, due: '2026-10-17', seen: 1, misses: 0, wrong: 0, updated: '2026-10-15' } },
      days: {},
    })
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
  it('раскладывает фразы по коробкам', () => {
    const progress = useProgressStore()
    progress.data = {
      version: 1,
      phrases: {
        a: { chapter: 'c', firstSeen: '2026-10-15', box: 1, due: '2026-10-16', seen: 1, misses: 0, wrong: 0, updated: '2026-10-15' },
        b: { chapter: 'c', firstSeen: '2026-10-15', box: 1, due: '2026-10-16', seen: 1, misses: 0, wrong: 0, updated: '2026-10-15' },
        c: { chapter: 'c', firstSeen: '2026-10-15', box: LAST_BOX, due: '2026-11-05', seen: 5, misses: 0, wrong: 0, updated: '2026-10-15' },
      },
      days: {},
    }
    expect(progress.boxCounts[0]).toBe(2)
    expect(progress.boxCounts[LAST_BOX - 1]).toBe(1)
    expect(progress.learnedCount).toBe(1)
  })

  it('считает прогресс по главам и пропускает записи без главы', () => {
    const progress = useProgressStore()
    progress.data = {
      version: 1,
      phrases: {
        a: { chapter: 'everyday-english', firstSeen: '2026-10-15', box: LAST_BOX, due: '2026-11-05', seen: 5, misses: 0, wrong: 0, updated: '2026-10-15' },
        b: { chapter: 'everyday-english', firstSeen: '2026-10-15', box: 2, due: '2026-10-17', seen: 1, misses: 0, wrong: 0, updated: '2026-10-15' },
        c: { chapter: '', firstSeen: '2026-10-15', box: 2, due: '2026-10-17', seen: 1, misses: 0, wrong: 0, updated: '2026-10-15' },
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
    expect(progress.boxOf('EE001')).toBe(1)
  })

  it('не трогает прогресс, если файл чужой', () => {
    const progress = useProgressStore()
    progress.commitSession([outcome('EE001', true)])
    expect(progress.importJson('{"hello":1}')).toBeNull()
    expect(progress.importJson('не json')).toBeNull()
    expect(progress.startedCount).toBe(1)
  })
})
