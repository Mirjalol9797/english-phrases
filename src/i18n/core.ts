import { RU_NOUNS } from './ru'
import { UZ_NOUNS, UZ_TEXT } from './uz'
import type { ChapterKind } from '@/types/content'

export type Language = 'ru' | 'uz'

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'ru', label: 'Русский' },
  { value: 'uz', label: "O'zbekcha" },
]

/**
 * Существительные, которые приходится ставить в число: «5 фраз», «2 урока».
 *
 * phraseAcc — винительный падеж: «повторить фразу», а не «повторить фраза».
 * В узбекском падежом слово не меняется, но русскому без этого никак.
 */
export type Noun =
  | 'phrase'
  | 'phraseAcc'
  | 'expression'
  | 'word'
  | 'verb'
  | 'entry'
  | 'lesson'
  | 'stage'
  | 'match'
  | 'day'
  | 'answer'

/**
 * Перевод по самому русскому тексту: ключ словаря — русская строка.
 *
 * Выдумывать ключи вроде review.title не пришлось, и в шаблоне видно, что
 * там будет написано. Если перевода нет, остаётся русский — экран не ломается,
 * а пропуск находит проверка (см. i18n.test.ts).
 */
export function translate(text: string, language: Language): string {
  if (language === 'ru') return text
  return UZ_TEXT[text] ?? text
}

/**
 * Число со словом. В русском три формы, в узбекском одна: согласования
 * по числу там нет, «5 ta ibora» и «1 ta ibora» отличаются только числом.
 */
export function pluralize(count: number, noun: Noun, language: Language): string {
  if (language === 'uz') return `${count} ta ${UZ_NOUNS[noun]}`

  const forms = RU_NOUNS[noun]
  const mod10 = count % 10
  const mod100 = count % 100
  let form = forms[2]
  if (mod10 === 1 && mod100 !== 11) form = forms[0]
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) form = forms[1]
  return `${count} ${form}`
}

/** Чем наполнена глава: «200 фраз», «330 выражений», «900 слов», «230 глаголов». */
export function nounOf(kind: ChapterKind): Noun {
  if (kind === 'expressions') return 'expression'
  if (kind === 'words') return 'word'
  if (kind === 'verbs') return 'verb'
  return 'phrase'
}

