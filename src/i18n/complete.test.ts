import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'
import { UZ_TEXT } from './uz'
import { EXERCISE_TITLES } from '@/utils/practice'

/** Все файлы исходников, кроме тестов и самого словаря. */
function sourceFiles(dir = 'src'): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'i18n' ? [] : sourceFiles(path)
    if (!/\.(vue|ts)$/.test(entry.name) || entry.name.includes('.test.')) return []
    return [path.split(sep).join('/')]
  })
}

/**
 * Строки, переданные в t('…') прямо в коде. Вызовы с переменной внутри
 * (t(EXERCISE_TITLES[kind])) так не найти — они проверяются отдельно ниже.
 */
function literalCalls(): Map<string, string> {
  const found = new Map<string, string>()
  for (const path of sourceFiles()) {
    const code = readFileSync(path, 'utf8')
    for (const m of code.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) {
      found.set(m[1]!.replace(/\\'/g, "'"), path)
    }
  }
  return found
}

describe('полнота узбекского словаря', () => {
  it('у каждой строки из t() есть перевод', () => {
    const missing = [...literalCalls()]
      .filter(([text]) => !(text in UZ_TEXT))
      .map(([text, path]) => `${text}  — ${path}`)
    expect(missing, 'нет перевода').toEqual([])
  })

  it('названия упражнений переведены: они подставляются переменной, не литералом', () => {
    const missing = Object.values(EXERCISE_TITLES).filter((title) => !(title in UZ_TEXT))
    expect(missing).toEqual([])
  })

  it('в словаре нет записей, которых больше нет в коде', () => {
    // Иначе словарь обрастает мусором, и непонятно, что ещё живо.
    const used = new Set([...literalCalls().keys(), ...Object.values(EXERCISE_TITLES)])
    const stale = Object.keys(UZ_TEXT).filter((text) => !used.has(text))
    expect(stale, 'лишнее в словаре').toEqual([])
  })
})
