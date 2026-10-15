import { describe, expect, it } from 'vitest'
import type { Phrase } from '@/types/content'
import { isPartStarted, isSessionSize, nextPartIndex, splitIntoParts } from './parts'

const make = (count: number): Phrase[] =>
  Array.from({ length: count }, (_, i) => ({ id: `P${i + 1}`, en: `en ${i + 1}`, ru: `ру ${i + 1}` }))

const sizes = (parts: Phrase[][]) => parts.map((p) => p.length)

describe('splitIntoParts', () => {
  it('не делит урок, который и так помещается', () => {
    expect(sizes(splitIntoParts(make(10), 10))).toEqual([10])
    expect(sizes(splitIntoParts(make(7), 10))).toEqual([7])
  })

  it('не делит, когда выбран весь урок', () => {
    expect(sizes(splitIntoParts(make(20), 0))).toEqual([20])
  })

  it('делит длинный урок на части не больше размера', () => {
    for (const [total, size] of [[20, 10], [18, 5], [19, 10], [15, 5], [20, 15]] as const) {
      const parts = splitIntoParts(make(total), size)
      expect(Math.max(...sizes(parts))).toBeLessThanOrEqual(size)
      expect(sizes(parts).reduce((a, b) => a + b, 0)).toBe(total)
    }
  })

  it('выравнивает части, не оставляя короткий хвост', () => {
    // 18 по 5 — это 5+5+4+4, а не 5+5+5+3.
    expect(sizes(splitIntoParts(make(18), 5))).toEqual([5, 5, 4, 4])
    expect(sizes(splitIntoParts(make(20), 15))).toEqual([10, 10])
    expect(sizes(splitIntoParts(make(19), 10))).toEqual([10, 9])
  })

  it('сохраняет порядок и состав записей', () => {
    const phrases = make(18)
    const flat = splitIntoParts(phrases, 5).flat()
    expect(flat.map((p) => p.id)).toEqual(phrases.map((p) => p.id))
  })

  it('не падает на пустом уроке', () => {
    expect(splitIntoParts([], 10)).toEqual([[]])
  })
})

describe('nextPartIndex', () => {
  const parts = splitIntoParts(make(20), 10)

  it('первая часть, пока ничего не начато', () => {
    expect(nextPartIndex(parts, () => false)).toBe(0)
  })

  it('переходит ко второй, когда первая пройдена целиком', () => {
    const done = new Set(parts[0]!.map((p) => p.id))
    expect(nextPartIndex(parts, (p) => done.has(p.id))).toBe(1)
  })

  it('остаётся на части, где начато не всё', () => {
    const done = new Set(parts[0]!.slice(0, 5).map((p) => p.id))
    expect(nextPartIndex(parts, (p) => done.has(p.id))).toBe(0)
  })

  it('возвращается к первой, когда пройдено всё', () => {
    expect(nextPartIndex(parts, () => true)).toBe(0)
  })
})

describe('isPartStarted', () => {
  it('часть пройдена, только если тронуты все её записи', () => {
    const part = make(3)
    expect(isPartStarted(part, () => true)).toBe(true)
    expect(isPartStarted(part, (p) => p.id !== 'P2')).toBe(false)
  })
})

describe('isSessionSize', () => {
  it('принимает только размеры из списка', () => {
    expect(isSessionSize(5)).toBe(true)
    expect(isSessionSize(10)).toBe(true)
    expect(isSessionSize(0)).toBe(true)
    expect(isSessionSize(7)).toBe(false)
    expect(isSessionSize('10')).toBe(false)
    expect(isSessionSize(NaN)).toBe(false)
  })
})
