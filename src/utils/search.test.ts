import { describe, expect, it } from 'vitest'
import { highlight, normalizeSearch } from './search'
import { plural, itemForms, PHRASE_FORMS, LESSON_FORMS, EXPRESSION_FORMS } from './plural'

describe('normalizeSearch', () => {
  it('не различает регистр', () => {
    expect(normalizeSearch('Good MORNING')).toBe('good morning')
    expect(normalizeSearch('СПАСИБО')).toBe('спасибо')
  })

  it('сводит все виды апострофов к прямому', () => {
    expect(normalizeSearch('I’m')).toBe("i'm")
    expect(normalizeSearch('I‘m')).toBe("i'm")
    expect(normalizeSearch('I`m')).toBe("i'm")
    expect(normalizeSearch('Iʼm')).toBe("i'm")
  })
})

describe('highlight', () => {
  const join = (parts: { text: string }[]) => parts.map((p) => p.text).join('')
  const marked = (parts: { text: string; match: boolean }[]) =>
    parts.filter((p) => p.match).map((p) => p.text)

  it('находит фигурный апостроф по прямому и наоборот', () => {
    expect(marked(highlight("I'm fine, thanks!", 'i’m'))).toEqual(["I'm"])
    expect(marked(highlight('I’m fine', "i'm"))).toEqual(['I’m'])
  })

  it('подсвечивает все вхождения', () => {
    expect(marked(highlight('Hi! Hi again', 'hi'))).toEqual(['Hi', 'Hi'])
  })

  it('сохраняет исходное написание в подсвеченном куске', () => {
    expect(marked(highlight('Good MORNING!', 'morning'))).toEqual(['MORNING'])
  })

  it('без совпадения отдаёт текст одним куском', () => {
    const parts = highlight('Nothing here', 'zzz')
    expect(parts).toHaveLength(1)
    expect(parts[0]!.match).toBe(false)
  })

  it('на пустом запросе ничего не подсвечивает', () => {
    expect(marked(highlight("Don't worry", ''))).toEqual([])
    expect(marked(highlight("Don't worry", '   '))).toEqual([])
  })

  it('никогда не теряет и не добавляет текст', () => {
    const cases: [string, string][] = [
      ["I'm fine, thanks!", 'i’m'],
      ['Hi! Hi again', 'hi'],
      ['Доброе утро!', 'УТРО'],
      ['Nothing here', 'zzz'],
      ["Don't worry", ''],
      ['Hi!', 'Hi!'],
    ]
    for (const [text, query] of cases) {
      expect(join(highlight(text, query))).toBe(text)
    }
  })
})

describe('plural', () => {
  it('склоняет по-русски', () => {
    expect(plural(1, PHRASE_FORMS)).toBe('1 фраза')
    expect(plural(2, PHRASE_FORMS)).toBe('2 фразы')
    expect(plural(5, PHRASE_FORMS)).toBe('5 фраз')
    expect(plural(21, PHRASE_FORMS)).toBe('21 фраза')
    expect(plural(0, PHRASE_FORMS)).toBe('0 фраз')
  })

  it('знает про исключения второго десятка', () => {
    expect(plural(11, PHRASE_FORMS)).toBe('11 фраз')
    expect(plural(12, PHRASE_FORMS)).toBe('12 фраз')
    expect(plural(14, PHRASE_FORMS)).toBe('14 фраз')
    expect(plural(111, PHRASE_FORMS)).toBe('111 фраз')
    expect(plural(101, LESSON_FORMS)).toBe('101 урок')
  })

  it('выбирает слово по виду главы', () => {
    expect(itemForms('phrases')).toBe(PHRASE_FORMS)
    expect(itemForms('expressions')).toBe(EXPRESSION_FORMS)
    expect(plural(330, itemForms('expressions'))).toBe('330 выражений')
  })
})
