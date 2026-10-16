import { describe, expect, it } from 'vitest'
import { buildWordLessons } from './words-pdf.mjs'

/**
 * Словарь из n слов: часть речи идёт по кругу, а начала у слов разные —
 * иначе развести «похожие» было бы нечего и некуда.
 */
function words(n, { pos = ['n.', 'v.', 'adj.', 'adv.'] } = {}) {
  const letter = (code) => String.fromCharCode(97 + (code % 26))
  return Array.from({ length: n }, (_, i) => ({
    word: `${letter(i)}${letter(Math.floor(i / 26))}${letter(Math.floor(i / 676))}word`,
    pos: pos[i % pos.length],
    ru: `перевод ${i}`,
    example: { en: `Example ${i}.`, ru: `Пример ${i}.` },
  }))
}

const flat = (lessons) => lessons.flat()

describe('buildWordLessons', () => {
  it('режет на уроки по десять и не теряет слов', () => {
    const lessons = buildWordLessons(words(90))
    expect(lessons).toHaveLength(9)
    expect(lessons.every((lesson) => lesson.length === 10)).toBe(true)
    expect(flat(lessons)).toHaveLength(90)
  })

  it('остаток размазывает по урокам, а не оставляет огрызок в конце', () => {
    // 872 слова — это 88 уроков. Последним не должно остаться два слова.
    const lessons = buildWordLessons(words(872))
    expect(lessons).toHaveLength(88)
    expect(flat(lessons)).toHaveLength(872)
    const sizes = [...new Set(lessons.map((lesson) => lesson.length))].sort((a, b) => a - b)
    expect(sizes).toEqual([9, 10])
    expect(Math.min(...lessons.map((lesson) => lesson.length))).toBe(9)
  })

  it('не теряет и не повторяет ни одного слова', () => {
    const source = words(90)
    const got = flat(buildWordLessons(source)).map((entry) => entry.word)
    expect(new Set(got).size).toBe(90)
    expect([...got].sort()).toEqual(source.map((entry) => entry.word).sort())
  })

  it('не оставляет порядок источника: соседи по алфавиту расходятся', () => {
    // В исходнике слова идут подряд, и учить подряд идущие тяжелее всего.
    const source = words(200)
    const first = buildWordLessons(source)[0].map((entry) => entry.word)
    expect(first).not.toEqual(source.slice(0, 10).map((entry) => entry.word))
  })

  it('в уроке слова разных частей речи', () => {
    const lessons = buildWordLessons(words(200))
    for (const lesson of lessons) {
      const kinds = new Set(lesson.map((entry) => entry.pos))
      expect(kinds.size).toBeGreaterThan(1)
    }
  })

  it('похожие слова разводит по разным урокам', () => {
    // actor и actress в одном уроке мешают друг другу запоминаться.
    const source = [
      ...words(60),
      { word: 'actor', pos: 'n.', ru: 'актёр', example: { en: 'A.', ru: 'А.' } },
      { word: 'actress', pos: 'n.', ru: 'актриса', example: { en: 'B.', ru: 'Б.' } },
      { word: 'action', pos: 'n.', ru: 'действие', example: { en: 'C.', ru: 'В.' } },
    ]
    const lessons = buildWordLessons(source)
    for (const lesson of lessons) {
      const starts = lesson.map((entry) => entry.word.slice(0, 3))
      expect(new Set(starts).size).toBe(starts.length)
    }
  })

  it('раскладка повторяется от запуска к запуску', () => {
    // Иначе пересборка данных перемешала бы ID и прогресс поехал бы.
    const source = words(120)
    const once = buildWordLessons(source).map((lesson) => lesson.map((e) => e.word))
    const twice = buildWordLessons(source).map((lesson) => lesson.map((e) => e.word))
    expect(twice).toEqual(once)
  })

  it('другое зерно даёт другую раскладку', () => {
    const source = words(120)
    const a = buildWordLessons(source, { seed: 1 }).map((lesson) => lesson.map((e) => e.word))
    const b = buildWordLessons(source, { seed: 2 }).map((lesson) => lesson.map((e) => e.word))
    expect(b).not.toEqual(a)
  })

  it('на пустом словаре не падает', () => {
    expect(buildWordLessons([])).toEqual([])
  })

  it('слов меньше урока — получается один неполный', () => {
    const lessons = buildWordLessons(words(3))
    expect(lessons).toHaveLength(1)
    expect(lessons[0]).toHaveLength(3)
  })
})
