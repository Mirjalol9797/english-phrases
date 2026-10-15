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

/** «200 фраз» для обычной главы и «330 выражений» для главы с выражениями. */
export function itemForms(kind: 'phrases' | 'expressions'): [string, string, string] {
  return kind === 'expressions' ? EXPRESSION_FORMS : PHRASE_FORMS
}
