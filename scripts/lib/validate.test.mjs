import { describe, expect, it } from 'vitest'
import { PHRASE_ID, normalizeEnglish, prefixOf, validateChapters } from './validate.mjs'

/** Правильная глава с фразами: 20 уроков по 10, ID подряд. */
function phrasesChapter(overrides = {}) {
  let n = 0
  return {
    id: 'everyday-english',
    order: 1,
    prefix: 'EE',
    kind: 'phrases',
    title: { en: 'Everyday English', ru: 'Повседневное общение' },
    lessons: Array.from({ length: 20 }, (_, l) => ({
      id: `EE-L${String(l + 1).padStart(2, '0')}`,
      order: l + 1,
      title: { en: `Lesson ${l + 1}`, ru: `Урок ${l + 1}` },
      phrases: Array.from({ length: 10 }, () => {
        n += 1
        return { id: `EE${String(n).padStart(3, '0')}`, en: `phrase ${n}`, ru: `фраза ${n}` }
      }),
    })),
    ...overrides,
  }
}

/** Глава с выражениями: уроки разного размера, нумерация своя внутри урока. */
function expressionsChapter(overrides = {}) {
  const groups = [
    ['GET', 20],
    ['TAKE', 19],
    ['HAVE', 15],
  ]
  return {
    id: 'core-verbs',
    order: 2,
    prefix: 'CV',
    kind: 'expressions',
    title: { en: 'English Core Verbs', ru: 'Основные глаголы' },
    lessons: groups.map(([prefix, count], l) => ({
      id: `CV-L${String(l + 1).padStart(2, '0')}`,
      order: l + 1,
      title: { en: prefix, ru: `Выражения с «${prefix.toLowerCase()}»` },
      phrases: Array.from({ length: count }, (_, i) => ({
        id: `${prefix}${String(i + 1).padStart(3, '0')}`,
        en: `${prefix.toLowerCase()} ${i + 1}`,
        ru: `${prefix.toLowerCase()} ${i + 1} по-русски`,
        example: { en: `I ${prefix.toLowerCase()} ${i + 1}.`, ru: `Я ${prefix.toLowerCase()} ${i + 1}.` },
      })),
    })),
    ...overrides,
  }
}

const check = (chapters, planned = 11) => validateChapters(chapters, { plannedChapters: planned })

describe('глава с фразами', () => {
  it('правильная глава проходит без ошибок', () => {
    expect(check([phrasesChapter()]).errors).toEqual([])
  })

  it('ловит не 20 уроков', () => {
    const chapter = phrasesChapter()
    chapter.lessons.pop()
    expect(check([chapter]).errors.join(' ')).toContain('уроков 19')
  })

  it('ловит не 10 фраз в уроке', () => {
    const chapter = phrasesChapter()
    chapter.lessons[0].phrases.pop()
    expect(check([chapter]).errors.join(' ')).toContain('фраз 9')
  })

  it('ловит разрыв в нумерации ID', () => {
    const chapter = phrasesChapter()
    chapter.lessons[0].phrases[3].id = 'EE099'
    expect(check([chapter]).errors.join(' ')).toContain('ожидается EE004')
  })

  it('ловит пустую фразу и пустой перевод', () => {
    const chapter = phrasesChapter()
    chapter.lessons[0].phrases[0].en = ''
    chapter.lessons[0].phrases[1].ru = ''
    const errors = check([chapter]).errors.join(' ')
    expect(errors).toContain('пустая английская фраза')
    expect(errors).toContain('пустой перевод')
  })

  it('ловит сбитый номер урока', () => {
    const chapter = phrasesChapter()
    chapter.lessons[5].order = 99
    expect(check([chapter]).errors.join(' ')).toContain('номер темы 99')
  })
})

describe('глава с выражениями', () => {
  it('правильная глава проходит без ошибок', () => {
    expect(check([expressionsChapter()]).errors).toEqual([])
  })

  it('разрешает уроки разного размера', () => {
    const report = check([expressionsChapter()])
    expect(report.errors).toEqual([])
    // Уроков не 20 — это лишь предупреждение, такую главу собирает сам источник.
    expect(report.warnings.join(' ')).toContain('уроков 3')
  })

  it('ждёт, что нумерация начинается заново в каждом уроке', () => {
    const chapter = expressionsChapter()
    chapter.lessons[1].phrases[0].id = 'TAKE005'
    expect(check([chapter]).errors.join(' ')).toContain('ожидается TAKE001')
  })

  it('ловит повтор префикса между уроками', () => {
    const chapter = expressionsChapter()
    chapter.lessons[1].phrases.forEach((p, i) => (p.id = `GET${String(i + 1).padStart(3, '0')}`))
    expect(check([chapter]).errors.join(' ')).toContain('уже у урока 1')
  })

  it('ловит пример только на одном языке', () => {
    const chapter = expressionsChapter()
    chapter.lessons[0].phrases[2].example.ru = ''
    expect(check([chapter]).errors.join(' ')).toContain('только на одном языке')
  })

  it('предупреждает, если примера нет совсем', () => {
    const chapter = expressionsChapter()
    delete chapter.lessons[0].phrases[2].example
    const report = check([chapter])
    expect(report.errors).toEqual([])
    expect(report.warnings.join(' ')).toContain('нет примера употребления')
  })

  it('не ворчит на урок из пяти выражений: столько их и бывает', () => {
    const chapter = expressionsChapter()
    chapter.lessons[2].phrases = chapter.lessons[2].phrases.slice(0, 5)
    const report = check([chapter])
    expect(report.errors).toEqual([])
    expect(report.warnings.join(' ')).not.toContain('подозрительно мало')
  })

  it('предупреждает про подозрительно короткий урок', () => {
    const chapter = expressionsChapter()
    chapter.lessons[2].phrases = chapter.lessons[2].phrases.slice(0, 3)
    const report = check([chapter])
    expect(report.errors).toEqual([])
    expect(report.warnings.join(' ')).toContain('подозрительно мало')
  })

  it('принимает составной префикс с подчёркиванием', () => {
    // Категория «in front of» даёт ID вида PRE_IN_FRONT_OF001.
    const chapter = expressionsChapter()
    chapter.lessons[0].phrases.forEach((p, i) => (p.id = `PRE_IN_FRONT_OF${String(i + 1).padStart(3, '0')}`))
    expect(check([chapter]).errors).toEqual([])
  })

  it('ловит разрыв нумерации и в составном префиксе', () => {
    const chapter = expressionsChapter()
    chapter.lessons[0].phrases.forEach((p, i) => (p.id = `PRE_OUT_OF${String(i + 1).padStart(3, '0')}`))
    chapter.lessons[0].phrases[4].id = 'PRE_OUT_OF009'
    expect(check([chapter]).errors.join(' ')).toContain('ожидается PRE_OUT_OF005')
  })

  it('ловит пустой урок', () => {
    const chapter = expressionsChapter()
    chapter.lessons[1].phrases = []
    expect(check([chapter]).errors.join(' ')).toContain('нет ни одной фразы')
  })
})

describe('между главами', () => {
  it('ловит повтор ID в разных главах', () => {
    const a = phrasesChapter()
    const b = expressionsChapter()
    b.lessons[0].phrases[0].id = 'EE001'
    const errors = check([a, b]).errors.join(' ')
    expect(errors).toContain('уже есть в главе')
  })

  it('ловит повтор префикса, id и порядкового номера главы', () => {
    const a = phrasesChapter()
    const b = phrasesChapter()
    const errors = check([a, b]).errors.join(' ')
    expect(errors).toContain('префикс ID «EE» уже используется')
    expect(errors).toContain('повторяется')
  })

  it('ловит глав больше запланированного', () => {
    expect(check([phrasesChapter()], 0).errors.join(' ')).toContain('запланировано 0')
  })

  it('ловит неизвестный вид главы', () => {
    expect(check([phrasesChapter({ kind: 'что-то' })]).errors.join(' ')).toContain('неизвестный вид главы')
  })

  it('предупреждает про повтор английской фразы между главами', () => {
    const a = phrasesChapter()
    const b = expressionsChapter()
    b.lessons[0].phrases[0].en = 'phrase 1'
    expect(check([a, b]).warnings.join(' ')).toContain('встречается несколько раз')
  })
})

describe('PHRASE_ID и prefixOf', () => {
  it('принимает оба вида ID', () => {
    expect(PHRASE_ID.test('EE001')).toBe(true)
    expect(PHRASE_ID.test('GET020')).toBe(true)
    expect(PHRASE_ID.test('PRE_IN001')).toBe(true)
    expect(PHRASE_ID.test('PRE_IN_FRONT_OF005')).toBe(true)
  })

  it('не принимает неверный формат', () => {
    expect(PHRASE_ID.test('ee001')).toBe(false)
    expect(PHRASE_ID.test('EE1')).toBe(false)
    expect(PHRASE_ID.test('EE0001')).toBe(false)
    expect(PHRASE_ID.test('_EE001')).toBe(false)
    expect(PHRASE_ID.test('EE001a')).toBe(false)
  })

  it('достаёт префикс', () => {
    expect(prefixOf('EE001')).toBe('EE')
    expect(prefixOf('PRE_IN_FRONT_OF005')).toBe('PRE_IN_FRONT_OF')
    expect(prefixOf('плохой')).toBe('')
    expect(prefixOf(undefined)).toBe('')
  })
})

describe('normalizeEnglish', () => {
  it('сводит написание к одному виду', () => {
    expect(normalizeEnglish('I’m  Fine.')).toBe("i'm fine")
    expect(normalizeEnglish("I'm fine!")).toBe("i'm fine")
  })
})
