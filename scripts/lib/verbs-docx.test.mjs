import { describe, expect, it } from 'vitest'
import { splitStage, formVariants } from './verbs-docx.mjs'

const verbs = (n) => Array.from({ length: n }, (_, i) => ({ v1: `verb${i}`, v2: `v2-${i}`, v3: `v3-${i}`, ru: `перевод ${i}` }))

describe('splitStage', () => {
  it('режет этап на уроки по десять', () => {
    const lessons = splitStage(verbs(30))
    expect(lessons.map((lesson) => lesson.length)).toEqual([10, 10, 10])
  })

  it('выравнивает уроки, а не оставляет огрызок', () => {
    // 22 глагола — это 8, 7 и 7, а не 10, 10 и 2.
    expect(splitStage(verbs(22)).map((l) => l.length)).toEqual([8, 7, 7])
    expect(splitStage(verbs(25)).map((l) => l.length)).toEqual([9, 8, 8])
  })

  it('сохраняет порядок источника', () => {
    // В источнике глаголы идут по убыванию полезности: be, have, do…
    const source = verbs(25)
    const got = splitStage(source).flat()
    expect(got).toEqual(source)
  })

  it('не теряет ни одного глагола', () => {
    for (const size of [20, 21, 22, 25, 30]) {
      expect(splitStage(verbs(size)).flat()).toHaveLength(size)
    }
  })

  it('этап меньше урока остаётся одним уроком', () => {
    expect(splitStage(verbs(4)).map((l) => l.length)).toEqual([4])
  })

  it('на пустом этапе ничего не выдумывает', () => {
    expect(splitStage([])).toEqual([])
  })
})

describe('formVariants', () => {
  it('у обычной формы вариант один', () => {
    expect(formVariants('gone')).toEqual(['gone'])
  })

  it('слэш даёт и запись целиком, и каждую часть', () => {
    // Источник: «Слэш обозначает допустимые варианты форм».
    expect(formVariants('got/gotten')).toEqual(['got/gotten', 'got', 'gotten'])
    expect(formVariants('was/were')).toEqual(['was/were', 'was', 'were'])
  })

  it('лишние пробелы вокруг слэша не создают пустых вариантов', () => {
    expect(formVariants('knelt / kneeled')).toEqual(['knelt / kneeled', 'knelt', 'kneeled'])
  })
})
