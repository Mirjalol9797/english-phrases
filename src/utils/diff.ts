import { normalizeAnswer } from './answer'

export interface WordPart {
  text: string
  /** Нашлось ли это слово в другом ответе. */
  same: boolean
}

export interface AnswerDiff {
  /** Что написали: несовпавшие слова лишние или с ошибкой. */
  typed: WordPart[]
  /** Как правильно: несовпавшие слова — те, что пропустили или исказили. */
  expected: WordPart[]
}

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

/** Слова сравниваем по тем же правилам, что и ответ целиком. */
function key(word: string): string {
  return normalizeAnswer(word)
}

/**
 * Сравнение по словам через наибольшую общую подпоследовательность.
 *
 * Простое сравнение по позициям не годится: пропущенное слово сдвигает
 * остальные, и весь хвост фразы подсветился бы как неверный, хотя ошибка
 * одна. Фразы короткие, поэтому таблица обходится дёшево.
 */
export function diffWords(typed: string, expected: string): AnswerDiff {
  const left = words(typed)
  const right = words(expected)
  const a = left.map(key)
  const b = right.map(key)

  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i]![j] = a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!)
    }
  }

  const result: AnswerDiff = { typed: [], expected: [] }
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      result.typed.push({ text: left[i]!, same: true })
      result.expected.push({ text: right[j]!, same: true })
      i++
      j++
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      result.typed.push({ text: left[i]!, same: false })
      i++
    } else {
      result.expected.push({ text: right[j]!, same: false })
      j++
    }
  }
  while (i < a.length) result.typed.push({ text: left[i++]!, same: false })
  while (j < b.length) result.expected.push({ text: right[j++]!, same: false })

  return result
}

/** Сколько слов совпало — по этому числу выбирается ближайший из допустимых ответов. */
export function matchedWords(diff: AnswerDiff): number {
  return diff.expected.filter((part) => part.same).length
}

/**
 * Из нескольких допустимых ответов берём тот, что ближе к написанному:
 * сравнивать с чужим вариантом бессмысленно, подсветится вся фраза.
 */
export function closestAnswer(typed: string, variants: string[]): string {
  let best = variants[0] ?? ''
  let bestScore = -1
  for (const variant of variants) {
    const score = matchedWords(diffWords(typed, variant))
    if (score > bestScore) {
      best = variant
      bestScore = score
    }
  }
  return best
}
