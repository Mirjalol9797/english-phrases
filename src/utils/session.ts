import type { PracticeStep, StepResult } from '@/types/practice'
import type { SessionOutcome } from '@/stores/progress'

/**
 * Сводит ответы занятия к итогу по каждой фразе.
 * Коробка Лейтнера должна меняться один раз за занятие, а не после каждого
 * ответа: иначе фраза, проваленная на первом этапе и угаданная на остальных,
 * поднялась бы вверх вместо того, чтобы вернуться в начало.
 */
export function toOutcomes(results: StepResult[], chapterOf: (phraseId: string) => string): SessionOutcome[] {
  const byPhrase = new Map<string, SessionOutcome>()

  for (const result of results) {
    const existing = byPhrase.get(result.phrase.id)
    if (existing) {
      existing.correct = existing.correct && result.correct
      existing.answers += 1
    } else {
      byPhrase.set(result.phrase.id, {
        phraseId: result.phrase.id,
        chapterId: chapterOf(result.phrase.id),
        correct: result.correct,
        answers: 1,
      })
    }
  }

  return [...byPhrase.values()]
}

/**
 * Прошла ли фраза все свои упражнения в этом занятии к указанному шагу.
 *
 * Этапы идут подряд по всему набору: сначала выбор перевода для всех фраз,
 * потом выбор фразы и так далее. Поэтому фраза заканчивает свой путь только
 * в последнем этапе — и записывать её раньше нечестно, итог ещё не сложился.
 * Карточки не в счёт: ответа в них нет.
 */
export function isPhraseDone(steps: PracticeStep[], index: number): boolean {
  const current = steps[index]
  if (!current || current.kind === 'card') return false
  for (let i = index + 1; i < steps.length; i++) {
    const step = steps[i]!
    if (step.kind !== 'card' && step.phrase.id === current.phrase.id) return false
  }
  return true
}
