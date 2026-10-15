import { addDays, type DayKey } from './date'

/**
 * Система Лейтнера: у каждой фразы есть коробка, от неё зависит, когда спросим снова.
 * Ответили верно — коробка выше и перерыв длиннее.
 *
 * Ошибка роняет не сразу в начало: первая — на шаг назад, вторая подряд — в первую
 * коробку. Описка после трёх недель не должна стирать всё выученное, но если фразу
 * не вспомнили дважды, она и правда забыта.
 */
export const BOX_INTERVALS = [1, 2, 5, 10, 21] as const

export const FIRST_BOX = 1
export const LAST_BOX = BOX_INTERVALS.length

/** Фраза считается выученной, когда дошла до последней коробки. */
export function isLearned(box: number): boolean {
  return box >= LAST_BOX
}

export function intervalFor(box: number): number {
  const index = Math.min(Math.max(box, FIRST_BOX), LAST_BOX) - 1
  return BOX_INTERVALS[index]!
}

/**
 * @param misses сколько занятий подряд фраза уже была провалена до этого ответа
 */
export function nextBox(box: number, correct: boolean, misses = 0): number {
  if (correct) return Math.min(box + 1, LAST_BOX)
  return misses >= 1 ? FIRST_BOX : Math.max(FIRST_BOX, box - 1)
}

export function dueAfter(day: DayKey, box: number): DayKey {
  return addDays(day, intervalFor(box))
}
