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
    phrases: { EE001: { chapter: 'everyday-english', box: 2, due: '2026-10-17', seen: 1, wrong: 0, updated: '2026-10-15' } },
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

  it('роняет в первую коробку за ошибку', () => {
    const progress = useProgressStore()
    for (let i = 0; i < 4; i++) progress.commitSession([outcome('EE001', true)])
    expect(progress.boxOf('EE001')).toBe(4)
    progress.commitSession([outcome('EE001', false)])
    expect(progress.boxOf('EE001')).toBe(1)
    expect(progress.get('EE001')!.wrong).toBe(1)
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
        EE001: { chapter: 'c', box: 2, due: '2026-10-14', seen: 1, wrong: 0, updated: '2026-10-13' },
        EE002: { chapter: 'c', box: 2, due: '2026-10-10', seen: 1, wrong: 0, updated: '2026-10-09' },
        EE003: { chapter: 'c', box: 2, due: '2026-10-12', seen: 1, wrong: 0, updated: '2026-10-11' },
      },
      days: {},
    }
    expect(progress.dueIds('2026-10-15')).toEqual(['EE002', 'EE003', 'EE001'])
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

describe('счётчики', () => {
  it('раскладывает фразы по коробкам', () => {
    const progress = useProgressStore()
    progress.data = {
      version: 1,
      phrases: {
        a: { chapter: 'c', box: 1, due: '2026-10-16', seen: 1, wrong: 0, updated: '2026-10-15' },
        b: { chapter: 'c', box: 1, due: '2026-10-16', seen: 1, wrong: 0, updated: '2026-10-15' },
        c: { chapter: 'c', box: LAST_BOX, due: '2026-11-05', seen: 5, wrong: 0, updated: '2026-10-15' },
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
        a: { chapter: 'everyday-english', box: LAST_BOX, due: '2026-11-05', seen: 5, wrong: 0, updated: '2026-10-15' },
        b: { chapter: 'everyday-english', box: 2, due: '2026-10-17', seen: 1, wrong: 0, updated: '2026-10-15' },
        c: { chapter: '', box: 2, due: '2026-10-17', seen: 1, wrong: 0, updated: '2026-10-15' },
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
