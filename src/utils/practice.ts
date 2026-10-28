import type { Phrase } from '@/types/content'
import type { ExerciseKind, PracticeStep } from '@/types/practice'
import { normalizeAnswer } from './answer'
import { translationOf, type Language } from '@/i18n/core'

/** Вариантов в упражнении с выбором: правильный плюс три неверных. */
const OPTION_COUNT = 4

/** Из одного слова фразу не собрать, поэтому для таких фраз этап сборки пропускается. */
const MIN_WORDS_TO_ASSEMBLE = 2

/**
 * Этапы в порядке возрастания сложности: узнать перевод, понять на слух,
 * вспомнить фразу, собрать её из слов, написать самому. Каждая фраза урока
 * проходит все этапы, поэтому порядок здесь — это порядок этапов занятия.
 */
export const EXERCISE_ORDER: ExerciseKind[] = [
  'choice-ru',
  'listen',
  'choice-en',
  'assemble',
  'typing',
  'forms',
]

export const EXERCISE_TITLES: Record<ExerciseKind, string> = {
  'choice-ru': 'Выбор перевода',
  listen: 'На слух',
  'choice-en': 'Выбор фразы',
  assemble: 'Сборка из слов',
  typing: 'Письмо',
  forms: 'Формы глагола',
}

/** Варианты формы: «got/gotten» принимаем целиком и по отдельности. */
function formVariants(form: string): string[] {
  const parts = form.split('/').map((part) => part.trim()).filter(Boolean)
  return parts.length > 1 ? [form, ...parts] : [form]
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

const toEn = (p: Phrase) => p.en

/** Возвращает null, если этап для этой фразы невозможен (нечего собирать из одного слова). */
function buildStep(
  phrase: Phrase,
  kind: ExerciseKind,
  near: Phrase[],
  far: Phrase[],
  language: Language,
): PracticeStep | null {
  // Спрашиваем и принимаем перевод на том языке, который выбран.
  const toTr = (p: Phrase) => translationOf(p, language)
  // «На слух» — тот же вопрос, что и в выборе перевода, только звучит, а не показан.
  if (kind === 'choice-ru' || kind === 'choice-en' || kind === 'listen') {
    const answerOf = kind === 'choice-en' ? toEn : toTr
    const promptOf = kind === 'choice-en' ? toTr : toEn
    const answer = answerOf(phrase)
    return {
      kind,
      phrase,
      answer,
      options: shuffle([answer, ...wrongOptions(phrase, answerOf, promptOf, near, far)]),
    }
  }

  // Формы есть только у неправильных глаголов: для всех остальных этап невозможен.
  if (kind === 'forms') {
    if (!phrase.forms) return null
    return {
      kind,
      phrase,
      accept: { v2: formVariants(phrase.forms.v2), v3: formVariants(phrase.forms.v3) },
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
  // Плюс варианты, записанные у самой фразы: «a» и «an» для статьи «a, an».
  const prompt = normalizeAnswer(toTr(phrase))
  const accept = [
    ...new Set([
      phrase.en,
      ...(phrase.accept ?? []),
      ...near.filter((p) => normalizeAnswer(toTr(p)) === prompt).map(toEn),
    ]),
  ]
  return { kind: 'typing', phrase, accept }
}

interface BuildOptions {
  /** Фразы урока: из них в первую очередь берутся неверные варианты. */
  near: Phrase[]
  /** Остальные фразы главы: добираются, когда в уроке вариантов не хватило. */
  far: Phrase[]
  /**
   * Какие этапы разрешены. Пользователь выключает ненужные в настройках,
   * а «На слух» отпадает сам, если английского голоса нет или звук выключен.
   */
  stages?: ExerciseKind[]
  /**
   * На каком языке спрашивать перевод. Сборщик сам про настройки не знает:
   * он чистый, и его тесты обходятся без хранилища.
   */
  language?: Language
}

/** Разрешённые этапы в их обычном порядке. Пустой список означает «все». */
function allowedStages(stages: ExerciseKind[] | undefined): ExerciseKind[] {
  if (!stages || stages.length === 0) return [...EXERCISE_ORDER]
  return EXERCISE_ORDER.filter((kind) => stages.includes(kind))
}

/**
 * Какие этапы достанутся этому уроку. Этап отпадает, если он невозможен
 * для всех фраз урока: из одного слова нечего собирать, а форм нет ни у чего,
 * кроме неправильных глаголов.
 */
export function availableStages(phrases: Phrase[], stages?: ExerciseKind[]): ExerciseKind[] {
  // Язык здесь ни на что не влияет: проверяется только возможность этапа.
  return allowedStages(stages).filter((kind) =>
    phrases.some((phrase) => buildStep(phrase, kind, [], [], 'ru') !== null),
  )
}

/**
 * Занятие: карточки со всеми фразами, затем этапы тестирования.
 * Внутри этапа фразы идут вперемешку, сами этапы — всегда по порядку.
 */
export function buildPractice(
  phrases: Phrase[],
  options: BuildOptions & { withCards?: boolean },
): PracticeStep[] {
  const { near, far, withCards = true, language = 'ru' } = options
  const steps: PracticeStep[] = withCards ? phrases.map((phrase) => ({ kind: 'card', phrase })) : []

  for (const kind of allowedStages(options.stages)) {
    for (const phrase of shuffle(phrases)) {
      const step = buildStep(phrase, kind, near, far, language)
      if (step) steps.push(step)
    }
  }
  return steps
}

/**
 * Повторение: одно упражнение на фразу, способ проверки — по уровню фразы.
 * Чем дольше фраза держится в памяти, тем сложнее способ её вспомнить:
 * сначала узнать перевод, в конце написать самому.
 */
export function buildReview(
  phrases: Phrase[],
  /** Насколько сложно спрашивать фразу: 0 — только познакомились. */
  levelOf: (phrase: Phrase) => number,
  options: BuildOptions,
): PracticeStep[] {
  const { near, far, language = 'ru' } = options
  const allowed = allowedStages(options.stages)
  const steps: PracticeStep[] = []

  for (const phrase of phrases) {
    // Уровень выбирает способ проверки: чем увереннее отвечают, тем сложнее
    // спрашиваем. Если этапов осталось меньше, шкала просто короче.
    const index = Math.min(Math.max(levelOf(phrase), 0), allowed.length - 1)

    // Сборка невозможна для однословных фраз. Тогда берём соседний этап —
    // сначала на ступень легче, потом сложнее: он ближе по трудности,
    // чем откат к самому началу шкалы.
    let step = buildStep(phrase, allowed[index]!, near, far, language)
    for (let i = index - 1; !step && i >= 0; i--) step = buildStep(phrase, allowed[i]!, near, far, language)
    for (let i = index + 1; !step && i < allowed.length; i++) step = buildStep(phrase, allowed[i]!, near, far, language)

    steps.push(step ?? buildStep(phrase, 'choice-ru', near, far, language)!)
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
  const { near, far, language = 'ru' } = options
  const seen = new Set<string>()
  const steps: PracticeStep[] = []

  for (const kind of allowedStages(options.stages)) {
    for (const mistake of mistakes) {
      if (mistake.kind !== kind) continue
      const key = `${mistake.phrase.id}:${kind}`
      if (seen.has(key)) continue
      seen.add(key)
      const step = buildStep(mistake.phrase, kind, near, far, language)
      if (step) steps.push(step)
    }
  }
  return steps
}
