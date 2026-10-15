import type { Phrase } from './content'

/** Типы упражнений. Карточка — не упражнение, в ней нечего проверять. */
export type ExerciseKind = 'choice-ru' | 'listen' | 'choice-en' | 'assemble' | 'typing'

/** Знакомство с фразой: английский текст, озвучка, перевод по нажатию. */
export interface CardStep {
  kind: 'card'
  phrase: Phrase
}

/** Выбор из вариантов: показан английский и нужен перевод (choice-ru) или наоборот. */
export interface ChoiceStep {
  kind: 'choice-ru' | 'choice-en'
  phrase: Phrase
  /** Правильный ответ уже перемешан с неверными. */
  options: string[]
  answer: string
}

/**
 * Послушать фразу и выбрать перевод. Текста на экране нет — в этом и смысл.
 * Появляется, только если есть английский голос и звук не выключен.
 */
export interface ListenStep {
  kind: 'listen'
  phrase: Phrase
  options: string[]
  answer: string
}

/** Собрать английскую фразу из перемешанных слов. */
export interface AssembleStep {
  kind: 'assemble'
  phrase: Phrase
  words: string[]
}

/** Напечатать английскую фразу по переводу. */
export interface TypingStep {
  kind: 'typing'
  phrase: Phrase
  /** Все английские фразы урока с этим же переводом: любая из них — верный ответ. */
  accept: string[]
}

export type PracticeStep = CardStep | ChoiceStep | ListenStep | AssembleStep | TypingStep

export interface StepResult {
  phrase: Phrase
  /** На каком этапе ошиблись: повтор переспрашивает именно это упражнение. */
  kind: ExerciseKind
  correct: boolean
}
