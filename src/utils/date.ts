/**
 * Дни хранятся строкой «2026-10-15» по местному времени, а не в UTC:
 * иначе занятие поздним вечером попадало бы в следующий день.
 */
export type DayKey = string

export function toDayKey(date: Date): DayKey {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function today(): DayKey {
  return toDayKey(new Date())
}

function fromDayKey(key: DayKey): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}

export function addDays(key: DayKey, days: number): DayKey {
  const date = fromDayKey(key)
  date.setDate(date.getDate() + days)
  return toDayKey(date)
}

/** Сколько дней от a до b. Отрицательное значение — b раньше a. */
export function daysBetween(a: DayKey, b: DayKey): number {
  const ms = fromDayKey(b).getTime() - fromDayKey(a).getTime()
  return Math.round(ms / 86_400_000)
}

/**
 * День недели, где 0 — понедельник.
 * Считаем своим разбором: new Date('2026-10-15') читается как полночь UTC
 * и в западных часовых поясах даёт предыдущий день.
 */
export function weekdayOf(key: DayKey): number {
  return (fromDayKey(key).getDay() + 6) % 7
}

export function isDayKey(value: unknown): value is DayKey {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** «15 октября» — для подписи, когда подойдёт следующее повторение. */
export function formatDay(key: DayKey, language: 'ru' | 'uz' = 'ru'): string {
  const date = fromDayKey(key)
  // Узбекская дата пишется числом и месяцем через дефис: «20-oktabr».
  if (language === 'uz') {
    return `${date.getDate()}-${UZ_MONTHS[date.getMonth()]}`
  }
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

/**
 * Месяцы по-узбекски. Берём своим списком, а не через toLocaleDateString:
 * локаль uz есть не во всех браузерах, и там, где её нет, вышла бы английская.
 */
const UZ_MONTHS = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
]
