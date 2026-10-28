import type { Noun } from './core'

/**
 * Узбекский не согласует существительное с числом: после числительного
 * слово стоит в единственном. Поэтому форма одна, а не три.
 */
export const UZ_NOUNS: Record<Noun, string> = {
  phrase: 'ibora',
  phraseAcc: 'ibora',
  expression: 'ibora',
  word: 'soʻz',
  verb: 'feʼl',
  entry: 'yozuv',
  lesson: 'dars',
  stage: 'bosqich',
  match: 'moslik',
  day: 'kun',
  answer: 'javob',
}

/**
 * Перевод интерфейса. Ключ — русская строка из шаблона, значение — узбекская.
 *
 * Заполняется по экранам; пока пусто — приложение работает по-русски,
 * а при выборе узбекского непереведённое остаётся русским.
 */
export const UZ_TEXT: Record<string, string> = {
  // Разделы
  'Главная': 'Bosh sahifa',
  'Главы': 'Boblar',
  'Повторение': 'Takrorlash',
  'Словарь': 'Lugʻat',
  'Настройки': 'Sozlamalar',
  'Статистика': 'Statistika',

  // 2.1 — переключатель языка
  'Язык': 'Til',
  'Язык интерфейса': 'Interfeys tili',
  'Переводы, которых ещё нет, остаются на русском.': 'Hali tarjima qilinmagani ruscha qoladi.',
}
