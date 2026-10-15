import { addDays, type DayKey } from './date'

/**
 * Система Лейтнера: у каждой фразы есть коробка, от неё зависит, когда спросим снова.
 * Ответили верно — коробка выше и перерыв длиннее, ошиблись — обратно в первую.
 * Сброс именно в первую, а не на шаг назад: фразу, которую забыли, честнее учить заново.
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

export function nextBox(box: number, correct: boolean): number {
  if (!correct) return FIRST_BOX
  return Math.min(box + 1, LAST_BOX)
}

export function dueAfter(day: DayKey, box: number): DayKey {
  return addDays(day, intervalFor(box))
}
