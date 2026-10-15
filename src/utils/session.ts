import type { StepResult } from '@/types/practice'
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
