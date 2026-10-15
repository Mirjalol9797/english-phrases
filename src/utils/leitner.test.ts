import { describe, expect, it } from 'vitest'
import { BOX_INTERVALS, FIRST_BOX, LAST_BOX, dueAfter, intervalFor, isLearned, nextBox } from './leitner'

describe('nextBox', () => {
  it('поднимает коробку на одну за верный ответ', () => {
    expect(nextBox(1, true)).toBe(2)
    expect(nextBox(3, true)).toBe(4)
  })

  it('заводит новую фразу в первую коробку', () => {
    expect(nextBox(0, true)).toBe(FIRST_BOX)
  })

  it('не поднимает выше последней коробки', () => {
    expect(nextBox(LAST_BOX, true)).toBe(LAST_BOX)
  })

  it('роняет в первую коробку с любой высоты', () => {
    for (let box = 0; box <= LAST_BOX; box++) {
      expect(nextBox(box, false)).toBe(FIRST_BOX)
    }
  })
})

describe('intervalFor', () => {
  it('выдаёт перерыв по номеру коробки', () => {
    expect(BOX_INTERVALS.map((_, i) => intervalFor(i + 1))).toEqual([...BOX_INTERVALS])
  })

  it('перерывы растут от коробки к коробке', () => {
    for (let box = FIRST_BOX; box < LAST_BOX; box++) {
      expect(intervalFor(box + 1)).toBeGreaterThan(intervalFor(box))
    }
  })

  it('не падает на номере вне диапазона', () => {
    expect(intervalFor(0)).toBe(BOX_INTERVALS[0])
    expect(intervalFor(99)).toBe(BOX_INTERVALS[LAST_BOX - 1])
  })
})

describe('dueAfter', () => {
  it('откладывает срок на перерыв этой коробки', () => {
    expect(dueAfter('2026-10-15', 1)).toBe('2026-10-16')
    expect(dueAfter('2026-10-15', 2)).toBe('2026-10-17')
    expect(dueAfter('2026-10-15', 5)).toBe('2026-11-05')
  })

  it('ошибка возвращает фразу на завтра, а не на три недели', () => {
    const afterMistake = dueAfter('2026-10-15', nextBox(5, false))
    expect(afterMistake).toBe('2026-10-16')
  })
})

describe('isLearned', () => {
  it('выученной считается только последняя коробка', () => {
    expect(isLearned(LAST_BOX - 1)).toBe(false)
    expect(isLearned(LAST_BOX)).toBe(true)
  })
})
