import { describe, expect, it } from 'vitest'
import type { Phrase } from '@/types/content'
import type { ExerciseKind, StepResult } from '@/types/practice'
import { toOutcomes } from './session'

const hi: Phrase = { id: 'EE001', en: 'Hi!', ru: 'Привет!' }
const morning: Phrase = { id: 'EE004', en: 'Good morning!', ru: 'Доброе утро!' }

const result = (phrase: Phrase, kind: ExerciseKind, correct: boolean): StepResult => ({ phrase, kind, correct })

const chapterOf = () => 'everyday-english'

describe('toOutcomes', () => {
  it('сводит ответы к одной записи на фразу', () => {
    const outcomes = toOutcomes(
      [
        result(hi, 'choice-ru', true),
        result(hi, 'choice-en', true),
        result(morning, 'choice-ru', true),
      ],
      chapterOf,
    )
    expect(outcomes).toHaveLength(2)
    expect(outcomes.find((o) => o.phraseId === 'EE001')!.answers).toBe(2)
  })

  it('одна ошибка на любом этапе роняет фразу целиком', () => {
    // Иначе фраза, проваленная на первом этапе и угаданная на остальных, пошла бы вверх.
    const outcomes = toOutcomes(
      [
        result(hi, 'choice-ru', false),
        result(hi, 'choice-en', true),
        result(hi, 'typing', true),
      ],
      chapterOf,
    )
    expect(outcomes).toHaveLength(1)
    expect(outcomes[0]!.correct).toBe(false)
    expect(outcomes[0]!.answers).toBe(3)
  })

  it('считает фразу верной, только если верны все ответы', () => {
    const outcomes = toOutcomes([result(hi, 'choice-ru', true), result(hi, 'typing', true)], chapterOf)
    expect(outcomes[0]!.correct).toBe(true)
  })

  it('проставляет главу каждой фразе', () => {
    const outcomes = toOutcomes([result(hi, 'typing', true)], (id) =>
      id.startsWith('EE') ? 'everyday-english' : 'other',
    )
    expect(outcomes[0]!.chapterId).toBe('everyday-english')
  })

  it('на пустом занятии не выдаёт ничего', () => {
    expect(toOutcomes([], chapterOf)).toEqual([])
  })
})
