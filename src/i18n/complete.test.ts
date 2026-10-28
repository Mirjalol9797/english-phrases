import { describe, expect, it } from 'vitest'
import { UZ_TEXT } from './uz'
import { EXERCISE_TITLES } from '@/utils/practice'

/**
 * Исходники читаем через import.meta.glob, а не через node:fs: так проверка
 * типов не требует типов Node в папке приложения, а vitest всё равно собирает
 * файлы через Vite. Сам словарь исключаем — в нём строки лежат по определению.
 */
const sources = import.meta.glob('@/**/*.{vue,ts}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const appFiles = Object.entries(sources).filter(
  ([path]) => !path.includes('/i18n/') && !path.includes('.test.'),
)

/**
 * Строки, переданные в t('…') прямо в коде. Вызовы с переменной внутри
 * (t(EXERCISE_TITLES[kind])) так не найти — они проверяются отдельно ниже.
 */
function literalCalls(): Map<string, string> {
  const found = new Map<string, string>()
  for (const [path, code] of appFiles) {
    for (const m of code.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) {
      found.set(m[1]!.replace(/\\'/g, "'"), path)
    }
  }
  return found
}

describe('полнота узбекского словаря', () => {
  it('файлы исходников вообще нашлись', () => {
    // Иначе пустой список молча «проходил» бы все проверки ниже.
    expect(appFiles.length).toBeGreaterThan(20)
  })

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
