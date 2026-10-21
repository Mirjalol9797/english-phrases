import { describe, expect, it } from 'vitest'
import { byLoad, chapterFilters } from './filters'

const chapters = [
  { id: 'everyday-english', title: 'Everyday English' },
  { id: 'irregular-verbs', title: 'Irregular Verbs' },
  { id: 'oxford-a1', title: 'Oxford 3000 · A1' },
]

const entries = (counts: Record<string, number>) =>
  Object.entries(counts).flatMap(([chapterId, n]) => Array.from({ length: n }, () => ({ chapterId })))

describe('chapterFilters', () => {
  it('первым идут все главы, и в них общее число', () => {
    const options = chapterFilters(entries({ 'everyday-english': 2, 'oxford-a1': 3 }), chapters)
    expect(options[0]).toEqual({ id: '', title: 'Все главы', count: 5 })
  })

  it('считает записи по главам', () => {
    const options = chapterFilters(entries({ 'everyday-english': 2, 'oxford-a1': 3 }), chapters)
    expect(options.slice(1)).toEqual([
      { id: 'everyday-english', title: 'Everyday English', count: 2 },
      { id: 'irregular-verbs', title: 'Irregular Verbs', count: 0 },
      { id: 'oxford-a1', title: 'Oxford 3000 · A1', count: 3 },
    ])
  })

  it('сохраняет порядок глав, как их передали', () => {
    const options = chapterFilters([], [...chapters].reverse())
    expect(options.slice(1).map((o) => o.id)).toEqual(['oxford-a1', 'irregular-verbs', 'everyday-english'])
  })

  it('на пустом списке записей все счётчики нулевые', () => {
    const options = chapterFilters([], chapters)
    expect(options.every((option) => option.count === 0)).toBe(true)
  })

  it('записи неизвестной главы попадают в общее число, но своего чипса не получают', () => {
    // Глава могла быть удалена из данных, а прогресс по ней остался.
    const options = chapterFilters(entries({ 'выдумка': 4 }), chapters)
    expect(options[0]!.count).toBe(4)
    expect(options.slice(1).every((option) => option.count === 0)).toBe(true)
  })
})

describe('byLoad', () => {
  it('убирает пустые главы', () => {
    const options = byLoad(chapterFilters(entries({ 'oxford-a1': 3 }), chapters))
    expect(options.map((o) => o.id)).toEqual(['', 'oxford-a1'])
  })

  it('впереди та глава, где записей больше', () => {
    const options = byLoad(
      chapterFilters(entries({ 'everyday-english': 2, 'irregular-verbs': 9, 'oxford-a1': 5 }), chapters),
    )
    expect(options.map((o) => o.count)).toEqual([16, 9, 5, 2])
  })

  it('при равном числе порядок по названию, а не случайный', () => {
    const options = byLoad(chapterFilters(entries({ 'oxford-a1': 2, 'everyday-english': 2 }), chapters))
    expect(options.slice(1).map((o) => o.title)).toEqual(['Everyday English', 'Oxford 3000 · A1'])
  })

  it('«все главы» остаются первыми и со своим числом', () => {
    const options = byLoad(chapterFilters(entries({ 'irregular-verbs': 7 }), chapters))
    expect(options[0]).toEqual({ id: '', title: 'Все главы', count: 7 })
  })

  it('на пустом списке не падает', () => {
    expect(byLoad([])).toEqual([])
  })
})
