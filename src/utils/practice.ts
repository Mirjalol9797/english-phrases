import type { Phrase } from '@/types/content'
import type { ExerciseKind, PracticeStep } from '@/types/practice'
import { normalizeAnswer } from './answer'

/** Вариантов в упражнении с выбором: правильный плюс три неверных. */
const OPTION_COUNT = 4

/** Из одного слова фразу не собрать, поэтому для таких фраз этап сборки пропускается. */
const MIN_WORDS_TO_ASSEMBLE = 2

/**
 * Этапы в порядке возрастания сложности: узнать перевод, понять на слух,
 * вспомнить фразу, собрать её из слов, написать самому. Каждая фраза урока
 * проходит все этапы, поэтому порядок здесь — это порядок этапов занятия.
 */
export const EXERCISE_ORDER: ExerciseKind[] = ['choice-ru', 'listen', 'choice-en', 'assemble', 'typing']

export const EXERCISE_TITLES: Record<ExerciseKind, string> = {
  'choice-ru': 'Выбор перевода',
  listen: 'На слух',
  'choice-en': 'Выбор фразы',
  assemble: 'Сборка из слов',
  typing: 'Письмо',
}

export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

/**
 * Неверные варианты. Берём сначала из того же урока, при нехватке добираем из главы.
 *
 * Пропускаем не только совпадающий ответ, но и фразы с таким же вопросом: в уроке
 * «Приветствия» и Hi!, и Hey! переводятся как «Привет!», поэтому Hey! нельзя
 * предлагать как неверный вариант к вопросу «Привет!» — он тоже правильный.
 */
function wrongOptions(
  phrase: Phrase,
  answerOf: (p: Phrase) => string,
  promptOf: (p: Phrase) => string,
  near: Phrase[],
  far: Phrase[],
): string[] {
  const usedAnswers = new Set([normalizeAnswer(answerOf(phrase))])
  const prompt = normalizeAnswer(promptOf(phrase))
  const result: string[] = []

  for (const pool of [near, far]) {
    for (const other of shuffle(pool)) {
      if (result.length >= OPTION_COUNT - 1) return result
      if (other.id === phrase.id) continue
      if (normalizeAnswer(promptOf(other)) === prompt) continue

      const value = answerOf(other)
      const key = normalizeAnswer(value)
      if (!value || usedAnswers.has(key)) continue
      usedAnswers.add(key)
      result.push(value)
    }
  }
  return result
}

const toRu = (p: Phrase) => p.ru
const toEn = (p: Phrase) => p.en

/** Возвращает null, если этап для этой фразы невозможен (нечего собирать из одного слова). */
function buildStep(phrase: Phrase, kind: ExerciseKind, near: Phrase[], far: Phrase[]): PracticeStep | null {
  // «На слух» — тот же вопрос, что и в выборе перевода, только звучит, а не показан.
  if (kind === 'choice-ru' || kind === 'choice-en' || kind === 'listen') {
    const answerOf = kind === 'choice-en' ? toEn : toRu
    const promptOf = kind === 'choice-en' ? toRu : toEn
    const answer = answerOf(phrase)
    return {
      kind,
      phrase,
      answer,
      options: shuffle([answer, ...wrongOptions(phrase, answerOf, promptOf, near, far)]),
    }
  }

  if (kind === 'assemble') {
    const original = words(phrase.en)
    if (original.length < MIN_WORDS_TO_ASSEMBLE) return null
    let mixed = shuffle(original)
    // Перемешали «в тот же порядок» — задание потеряло бы смысл.
    if (mixed.join(' ') === original.join(' ')) mixed = [...original].reverse()
    return { kind, phrase, words: mixed }
  }

  // У одного перевода может быть несколько английских фраз: по вопросу «Привет!»
  // нельзя угадать, ждут Hi! или Hey!, поэтому принимаем любую из них.
  const prompt = normalizeAnswer(phrase.ru)
  const accept = [...new Set([phrase.en, ...near.filter((p) => normalizeAnswer(p.ru) === prompt).map(toEn)])]
  return { kind: 'typing', phrase, accept }
}

interface BuildOptions {
  /** Фразы урока: из них в первую очередь берутся неверные варианты. */
  near: Phrase[]
  /** Остальные фразы главы: добираются, когда в уроке вариантов не хватило. */
  far: Phrase[]
  /**
   * Можно ли давать задания на слух. Без английского голоса в системе
   * или с выключенным звуком отвечать на них нечем.
   */
  listening?: boolean
}

/**
 * Занятие: карточки со всеми фразами, затем четыре этапа тестирования.
 * Внутри этапа фразы идут вперемешку, сами этапы — всегда по порядку.
 */
export function buildPractice(
  phrases: Phrase[],
  options: BuildOptions & { withCards?: boolean },
): PracticeStep[] {
  const { near, far, withCards = true, listening = false } = options
  const steps: PracticeStep[] = withCards ? phrases.map((phrase) => ({ kind: 'card', phrase })) : []

  for (const kind of EXERCISE_ORDER) {
    if (kind === 'listen' && !listening) continue
    for (const phrase of shuffle(phrases)) {
      const step = buildStep(phrase, kind, near, far)
      if (step) steps.push(step)
    }
  }
  return steps
}

/**
 * Повторение по Лейтнеру: одно упражнение на фразу, тип — по коробке.
 * Чем дольше фраза держится в памяти, тем сложнее способ её вспомнить:
 * сначала узнать перевод, в конце написать самому.
 */
export function buildReview(
  phrases: Phrase[],
  boxOf: (phrase: Phrase) => number,
  options: BuildOptions,
): PracticeStep[] {
  const { near, far, listening = false } = options
  const steps: PracticeStep[] = []

  for (const phrase of phrases) {
    const box = boxOf(phrase)
    let wanted: ExerciseKind =
      box >= 5 ? 'typing' : box >= 4 ? 'assemble' : box >= 3 ? 'choice-en' : box >= 2 ? 'listen' : 'choice-ru'
    // Без звука на слух не ответить.
    if (wanted === 'listen' && !listening) wanted = 'choice-ru'
    // Сборка невозможна для однословных фраз — тогда спрашиваем выбором.
    steps.push(buildStep(phrase, wanted, near, far) ?? buildStep(phrase, 'choice-en', near, far)!)
  }
  return steps
}

/**
 * Повтор ошибок: переспрашиваем ровно те упражнения, где ответ был неверным,
 * а не весь урок заново. Порядок этапов сохраняется.
 */
export function buildRepeat(
  mistakes: { phrase: Phrase; kind: ExerciseKind }[],
  options: BuildOptions,
): PracticeStep[] {
  const { near, far, listening = false } = options
  const seen = new Set<string>()
  const steps: PracticeStep[] = []

  for (const kind of EXERCISE_ORDER) {
    if (kind === 'listen' && !listening) continue
    for (const mistake of mistakes) {
      if (mistake.kind !== kind) continue
      const key = `${mistake.phrase.id}:${kind}`
      if (seen.has(key)) continue
      seen.add(key)
      const step = buildStep(mistake.phrase, kind, near, far)
      if (step) steps.push(step)
    }
  }
  return steps
}
