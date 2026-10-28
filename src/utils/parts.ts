import type { Phrase } from '@/types/content'

/**
 * Размер занятия. 0 — не разбивать урок вовсе.
 * В главах с выражениями урок бывает на 20 записей, а это сотня шагов подряд.
 */
export const SESSION_SIZE_OPTIONS: { value: number; label: string }[] = [
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 15, label: '15' },
  { value: 0, label: 'Весь урок' },  // переводится на экране настроек
]

export const DEFAULT_SESSION_SIZE = 10

export function isSessionSize(value: unknown): value is number {
  return typeof value === 'number' && SESSION_SIZE_OPTIONS.some((option) => option.value === value)
}

/**
 * Делит урок на части не больше заданного размера.
 * Части выравниваются по длине: из 18 записей по 5 выйдет 5+5+4+4, а не 5+5+5+3 —
 * короткий хвост в конце выглядит как недоделка.
 */
export function splitIntoParts(phrases: Phrase[], size: number): Phrase[][] {
  if (size <= 0 || phrases.length <= size) return [phrases]

  const count = Math.ceil(phrases.length / size)
  const parts: Phrase[][] = []
  let start = 0
  for (let i = 0; i < count; i++) {
    const take = Math.ceil((phrases.length - start) / (count - i))
    parts.push(phrases.slice(start, start + take))
    start += take
  }
  return parts
}

/**
 * Часть, с которой продолжать: первая, где есть ещё не тронутые записи.
 * Отдельно нигде не хранится — «пройдено» видно по самому прогрессу фраз.
 * Если пройдено всё, начинаем сначала.
 */
export function nextPartIndex(parts: Phrase[][], isStarted: (phrase: Phrase) => boolean): number {
  const index = parts.findIndex((part) => part.some((phrase) => !isStarted(phrase)))
  return index === -1 ? 0 : index
}

export function isPartStarted(part: Phrase[], isStarted: (phrase: Phrase) => boolean): boolean {
  return part.every(isStarted)
}
