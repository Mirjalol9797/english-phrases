import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EASE,
  LEARNED_INTERVAL,
  MIN_EASE,
  MIN_INTERVAL,
  SECOND_INTERVAL,
  dueAfter,
  easeAfterMistakes,
  isLearned,
  levelOf,
  newSchedule,
  nextSchedule,
} from './sm2'

/** Прогнать несколько верных ответов подряд и вернуть цепочку перерывов. */
function intervals(count: number, from = newSchedule()) {
  const result: number[] = []
  let schedule = from
  for (let i = 0; i < count; i++) {
    schedule = nextSchedule(schedule, true)
    result.push(schedule.interval)
  }
  return result
}

describe('перерывы растут', () => {
  it('ничего не возвращается на следующий день', () => {
    expect(nextSchedule(newSchedule(), true).interval).toBe(MIN_INTERVAL)
    expect(MIN_INTERVAL).toBeGreaterThan(1)
  })

  it('первые два перерыва заданы, дальше умножение на коэффициент', () => {
    // Округление на каждом шаге: 15 x 2.5 = 37.5 -> 38, и дальше от него.
    expect(intervals(6)).toEqual([2, 6, 15, 38, 95, 238])
  })

  it('выученное уходит на месяцы, а не возвращается каждые три недели', () => {
    const далеко = intervals(8).at(-1)!
    expect(далеко).toBeGreaterThan(300)
  })

  it('счёт верных ответов подряд растёт', () => {
    let schedule = newSchedule()
    for (let i = 1; i <= 3; i++) {
      schedule = nextSchedule(schedule, true)
      expect(schedule.reps).toBe(i)
    }
  })

  it('верный ответ не меняет коэффициент', () => {
    expect(nextSchedule(newSchedule(), true).ease).toBe(DEFAULT_EASE)
  })
})

describe('ошибка', () => {
  it('возвращает фразу через два дня, а не завтра', () => {
    const зрелая = { interval: 93, ease: DEFAULT_EASE, reps: 5 }
    expect(nextSchedule(зрелая, false).interval).toBe(MIN_INTERVAL)
  })

  it('обнуляет счёт верных ответов', () => {
    expect(nextSchedule({ interval: 93, ease: 2.5, reps: 5 }, false).reps).toBe(0)
  })

  it('снижает коэффициент', () => {
    expect(nextSchedule(newSchedule(), false).ease).toBeCloseTo(2.18, 5)
  })

  it('коэффициент не падает ниже предела', () => {
    let schedule = newSchedule()
    for (let i = 0; i < 10; i++) schedule = nextSchedule(schedule, false)
    expect(schedule.ease).toBe(MIN_EASE)
  })

  it('у трудной фразы перерывы растут медленнее', () => {
    const трудная = { interval: 0, ease: MIN_EASE, reps: 0 }
    const лёгкая = newSchedule()
    expect(intervals(5, трудная).at(-1)!).toBeLessThan(intervals(5, лёгкая).at(-1)!)
  })

  it('после ошибки лестница начинается заново', () => {
    const после = nextSchedule({ interval: 93, ease: 2.5, reps: 5 }, false)
    expect(intervals(2, после)).toEqual([MIN_INTERVAL, SECOND_INTERVAL])
  })
})

describe('dueAfter', () => {
  it('откладывает на заданный перерыв', () => {
    expect(dueAfter('2026-10-15', 6)).toBe('2026-10-21')
    expect(dueAfter('2026-10-15', 21)).toBe('2026-11-05')
  })

  it('никогда не ставит срок на завтра', () => {
    expect(dueAfter('2026-10-15', 0)).toBe('2026-10-17')
    expect(dueAfter('2026-10-15', 1)).toBe('2026-10-17')
  })
})

describe('isLearned', () => {
  it('выученной считается фраза с перерывом от трёх недель', () => {
    expect(isLearned({ interval: LEARNED_INTERVAL - 1 })).toBe(false)
    expect(isLearned({ interval: LEARNED_INTERVAL })).toBe(true)
    expect(isLearned({ interval: 200 })).toBe(true)
  })
})

describe('levelOf', () => {
  it('сложность проверки растёт с числом верных ответов подряд', () => {
    expect(levelOf({ reps: 0 })).toBe(0)
    expect(levelOf({ reps: 3 })).toBe(3)
  })
})

describe('easeAfterMistakes', () => {
  it('переносит накопленную трудность из старого прогресса', () => {
    expect(easeAfterMistakes(0)).toBe(DEFAULT_EASE)
    expect(easeAfterMistakes(1)).toBeCloseTo(2.18, 5)
    expect(easeAfterMistakes(99)).toBe(MIN_EASE)
  })
})
