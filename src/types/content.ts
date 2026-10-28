export interface LocalizedText {
  en: string
  ru: string
  /** Узбекский перевод. Его может не быть: главы переводятся по одной. */
  uz?: string
}

/** Одна фраза. ID стабильный (например EE001), по нему хранится прогресс. */
export interface Phrase {
  id: string
  en: string
  ru: string
  /** Узбекский перевод. Его может не быть: главы переводятся по одной. */
  uz?: string
  /**
    * Примеры употребления, от простого к сложному. Есть у выражений и слов,
    * у обычных фраз их нет. У слов Oxford второй пример — ступенью выше
    * первого: там, где в первом простое настоящее, во втором уже время
    * посложнее, придаточное или устойчивое сочетание.
    */
  examples?: LocalizedText[]
  /** Часть речи: «n.», «v.», «prep., adv.». Есть только у слов. */
  pos?: string
  /**
   * Вторая и третья формы неправильного глагола: go — went — gone.
   * Слэш означает допустимые варианты: got/gotten.
   */
  forms?: { v2: string; v3: string }
  /**
   * Что ещё принимать на этапе письма, кроме en. Нужно словарным статьям
   * вида «a, an»: по переводу «неопределённый артикль» угадать, что ждут
   * оба артикля через запятую, невозможно.
   */
  accept?: string[]
}

/**
 * Чем наполнена глава.
 * phrases — готовые фразы, 20 уроков по 10.
 * expressions — выражения вокруг одного глагола, в уроке их столько, сколько набралось.
 * words — словарный уровень Oxford 3000: слово с частью речи и примером, уроки по 10.
 * verbs — неправильные глаголы: у каждого вторая и третья формы, уроки идут по этапам.
 */
export type ChapterKind = 'phrases' | 'expressions' | 'words' | 'verbs'

/** Урок — тема из 10 фраз. ID вида EE-L01. */
export interface Lesson {
  id: string
  order: number
  title: LocalizedText
  phrases: Phrase[]
}

/** Глава — категория из 20 уроков (200 фраз). Хранится в public/data/chapters/<id>.json */
export interface Chapter {
  id: string
  order: number
  prefix: string
  kind: ChapterKind
  /** Раздел на главной, если глава входит в набор: например «Oxford 3000». */
  group?: string
  title: LocalizedText
  lessons: Lesson[]
}

/** Краткое описание главы из public/data/chapters.json */
export interface ChapterSummary {
  id: string
  order: number
  prefix: string
  kind: ChapterKind
  group?: string
  title: LocalizedText
  file: string
  lessonCount: number
  phraseCount: number
}

export interface ContentIndex {
  version: number
  plannedChapters: number
  totalPhrases: number
  chapters: ChapterSummary[]
}

/** Урок вместе с главой и соседними уроками — то, что нужно экрану урока. */
export interface LessonContext {
  chapter: Chapter
  lesson: Lesson
  previous: Lesson | null
  next: Lesson | null
}
