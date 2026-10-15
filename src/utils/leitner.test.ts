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

  it('первая ошибка — шаг назад, а не в начало', () => {
    // Описка после трёх недель не должна стирать всё выученное.
    expect(nextBox(LAST_BOX, false, 0)).toBe(LAST_BOX - 1)
    expect(nextBox(3, false, 0)).toBe(2)
    expect(nextBox(2, false, 0)).toBe(1)
  })

  it('вторая ошибка подряд роняет в первую коробку', () => {
    for (let box = FIRST_BOX; box <= LAST_BOX; box++) {
      expect(nextBox(box, false, 1)).toBe(FIRST_BOX)
      expect(nextBox(box, false, 5)).toBe(FIRST_BOX)
    }
  })

  it('ниже первой коробки не опускается', () => {
    expect(nextBox(FIRST_BOX, false, 0)).toBe(FIRST_BOX)
    expect(nextBox(0, false, 0)).toBe(FIRST_BOX)
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

  it('после первой ошибки срок короче, но не завтра', () => {
    // Коробка 5 -> 4, это десять дней вместо трёх недель.
    expect(dueAfter('2026-10-15', nextBox(5, false, 0))).toBe('2026-10-25')
  })

  it('после второй ошибки подряд фраза возвращается завтра', () => {
    expect(dueAfter('2026-10-15', nextBox(5, false, 1))).toBe('2026-10-16')
  })
})

describe('isLearned', () => {
  it('выученной считается только последняя коробка', () => {
    expect(isLearned(LAST_BOX - 1)).toBe(false)
    expect(isLearned(LAST_BOX)).toBe(true)
  })
})
