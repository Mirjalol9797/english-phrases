import type { ChapterKind } from '@/types/content'

/**
 * Русское склонение по числу: plural(5, ['фраза', 'фразы', 'фраз']) → «5 фраз».
 */
export function plural(count: number, forms: [one: string, few: string, many: string]): string {
  const mod10 = count % 10
  const mod100 = count % 100
  let form = forms[2]
  if (mod10 === 1 && mod100 !== 11) form = forms[0]
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) form = forms[1]
  return `${count} ${form}`
}

export const PHRASE_FORMS: [string, string, string] = ['фраза', 'фразы', 'фраз']
export const LESSON_FORMS: [string, string, string] = ['урок', 'урока', 'уроков']

export const EXPRESSION_FORMS: [string, string, string] = ['выражение', 'выражения', 'выражений']

export const WORD_FORMS: [string, string, string] = ['слово', 'слова', 'слов']

/** Для словаря: там вперемешку фразы, выражения и слова, общее слово им — «совпадение». */
export const MATCH_FORMS: [string, string, string] = ['совпадение', 'совпадения', 'совпадений']

/** «200 фраз», «330 выражений» или «900 слов» — смотря чем наполнена глава. */
export function itemForms(kind: ChapterKind): [string, string, string] {
  if (kind === 'expressions') return EXPRESSION_FORMS
  if (kind === 'words') return WORD_FORMS
  return PHRASE_FORMS
}
