import type { Phrase } from '@/types/content'

/**
 * Поиск по фразам. Текст сравнивается в нижнем регистре, а разные апострофы
 * (’ ‘ ʼ ʻ ` ´) приводятся к обычному ', иначе «I’m» не найдётся по запросу «I'm»,
 * а узбекское «lugʻat» — по «lug'at».
 */
const APOSTROPHES = /[’‘‛ʼʻ`´]/g

export function normalizeSearch(text: string): string {
  return text.replace(APOSTROPHES, "'").toLowerCase()
}

/**
 * Английская часть записи для поиска. У неправильного глагола это все три формы:
 * «went» встречают в тексте чаще, чем «go», и искать будут именно его.
 */
export function englishSearchText(phrase: Pick<Phrase, 'en' | 'forms'>): string {
  if (!phrase.forms) return phrase.en
  return `${phrase.en} ${phrase.forms.v2} ${phrase.forms.v3}`
}

export interface TextPart {
  text: string
  match: boolean
}

/**
 * Делит текст на куски «совпало с запросом / нет», чтобы подсветить совпадения
 * без v-html. Возвращает исходный текст одним куском, если подсвечивать нечего.
 */
export function highlight(text: string, query: string): TextPart[] {
  const needle = normalizeSearch(query.trim())
  const haystack = normalizeSearch(text)
  // Нижний регистр у отдельных символов может менять длину строки (например İ),
  // тогда позиции в оригинале и в нормализованном тексте разойдутся.
  if (!needle || haystack.length !== text.length) return [{ text, match: false }]

  const parts: TextPart[] = []
  let from = 0
  let at = haystack.indexOf(needle)

  while (at !== -1) {
    if (at > from) parts.push({ text: text.slice(from, at), match: false })
    parts.push({ text: text.slice(at, at + needle.length), match: true })
    from = at + needle.length
    at = haystack.indexOf(needle, from)
  }

  if (from === 0) return [{ text, match: false }]
  if (from < text.length) parts.push({ text: text.slice(from), match: false })
  return parts
}
