import { normalizeSearch } from './search'

/**
 * Ответ сравниваем мягко: регистр, вид апострофа, лишние пробелы и знак в конце
 * не должны считаться ошибкой. «Im good» от «I'm good.» это уже не спасёт — и правильно.
 */
export function normalizeAnswer(text: string): string {
  return normalizeSearch(text)
    .replace(/[.!?,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isSameAnswer(a: string, b: string): boolean {
  return normalizeAnswer(a) === normalizeAnswer(b)
}
