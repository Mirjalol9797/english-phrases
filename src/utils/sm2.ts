import { addDays, type DayKey } from './date'

/**
 * Интервальное повторение по SM-2 — тому же алгоритму, что в Anki.
 *
 * У каждой фразы свой перерыв и свой коэффициент лёгкости. Верный ответ
 * умножает перерыв на коэффициент, так что хорошо выученное уходит на месяцы.
 * У коробок Лейтнера, которые были раньше, потолок был 21 день: при 2566 фразах
 * это навсегда оставляло около 120 повторений в день.
 */

/**
 * Ничего не возвращается на следующий день — даже только что заваленное.
 * Повторять то, что видел вчера, бессмысленно: оно ещё не успело забыться.
 */
export const MIN_INTERVAL = 2

/** Второй успешный перерыв. Дальше включается умножение на коэффициент. */
export const SECOND_INTERVAL = 6

export const DEFAULT_EASE = 2.5
export const MIN_EASE = 1.3

/** Начиная с этого перерыва фраза считается выученной. */
export const LEARNED_INTERVAL = 21

/**
 * Насколько падает коэффициент после ошибки.
 *
 * В Anki ответ оценивают одной из четырёх кнопок, у нас же есть только
 * «все ответы верны» или «была ошибка». Это оценки 4 и 2 по шкале SM-2:
 * при четвёрке коэффициент по формуле не меняется, при двойке падает на 0,32.
 */
export const EASE_PENALTY = 0.32

export interface Schedule {
  /** Перерыв в днях до следующего показа. */
  interval: number
  /** Коэффициент лёгкости: во сколько раз растёт перерыв. */
  ease: number
  /** Сколько раз подряд ответили верно. Ошибка обнуляет. */
  reps: number
}

export function newSchedule(): Schedule {
  return { interval: 0, ease: DEFAULT_EASE, reps: 0 }
}

const clampEase = (ease: number) => Math.min(DEFAULT_EASE, Math.max(MIN_EASE, ease))

/**
 * Следующее расписание фразы по итогу занятия.
 * Коэффициент только падает: сигнала «было легко» у нас нет, а выдумывать его
 * из числа верных ответов — значит растить перерывы на пустом месте.
 */
export function nextSchedule(current: Schedule, correct: boolean): Schedule {
  if (!correct) {
    return {
      interval: MIN_INTERVAL,
      ease: clampEase(current.ease - EASE_PENALTY),
      reps: 0,
    }
  }

  const reps = current.reps + 1
  const interval =
    reps === 1
      ? MIN_INTERVAL
      : reps === 2
        ? SECOND_INTERVAL
        : Math.max(MIN_INTERVAL, Math.round(current.interval * current.ease))

  return { interval, ease: clampEase(current.ease), reps }
}

export function dueAfter(day: DayKey, interval: number): DayKey {
  return addDays(day, Math.max(MIN_INTERVAL, Math.round(interval)))
}

export function isLearned(schedule: Pick<Schedule, 'interval'>): boolean {
  return schedule.interval >= LEARNED_INTERVAL
}

/**
 * Насколько сложно спрашивать фразу: по числу верных ответов подряд.
 * Ноль — только познакомились, дальше способ проверки усложняется.
 * Ошибка обнуляет счёт, и фраза снова начинает с лёгкого.
 */
export function levelOf(schedule: Pick<Schedule, 'reps'>): number {
  return schedule.reps
}

/** Коэффициент после нескольких ошибок — нужен при переносе старого прогресса. */
export function easeAfterMistakes(wrong: number): number {
  return clampEase(DEFAULT_EASE - EASE_PENALTY * Math.max(0, wrong))
}
