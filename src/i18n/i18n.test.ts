import { describe, expect, it } from 'vitest'
import { nounOf, pluralize, translate } from './core'
import { UZ_NOUNS, UZ_TEXT } from './uz'
import { RU_NOUNS } from './ru'

describe('склонение', () => {
  const ru = (n: number, noun: Parameters<typeof pluralize>[1]) => pluralize(n, noun, 'ru')
  const uz = (n: number, noun: Parameters<typeof pluralize>[1]) => pluralize(n, noun, 'uz')

  it('по-русски выбирает одну из трёх форм', () => {
    expect(ru(1, 'phrase')).toBe('1 фраза')
    expect(ru(2, 'phrase')).toBe('2 фразы')
    expect(ru(5, 'phrase')).toBe('5 фраз')
    expect(ru(21, 'phrase')).toBe('21 фраза')
    expect(ru(0, 'phrase')).toBe('0 фраз')
  })

  it('знает про исключения второго десятка', () => {
    expect(ru(11, 'phrase')).toBe('11 фраз')
    expect(ru(12, 'phrase')).toBe('12 фраз')
    expect(ru(14, 'phrase')).toBe('14 фраз')
    expect(ru(111, 'phrase')).toBe('111 фраз')
    expect(ru(101, 'lesson')).toBe('101 урок')
  })

  it('винительный падеж — отдельное слово: «повторить фразу», а не «фраза»', () => {
    expect(ru(1, 'phraseAcc')).toBe('1 фразу')
    expect(ru(2, 'phraseAcc')).toBe('2 фразы')
  })

  it('по-узбекски слово не меняется, меняется только число', () => {
    // Согласования по числу в узбекском нет: после числительного единственное.
    expect(uz(1, 'phrase')).toBe('1 ta ibora')
    expect(uz(2, 'phrase')).toBe('2 ta ibora')
    expect(uz(5, 'phrase')).toBe('5 ta ibora')
    expect(uz(111, 'phrase')).toBe('111 ta ibora')
  })

  it('выбирает слово по виду главы', () => {
    expect(nounOf('phrases')).toBe('phrase')
    expect(nounOf('expressions')).toBe('expression')
    expect(nounOf('words')).toBe('word')
    expect(nounOf('verbs')).toBe('verb')
    expect(ru(330, nounOf('expressions'))).toBe('330 выражений')
    expect(uz(900, nounOf('words'))).toBe('900 ta soʻz')
  })

  it('у каждого существительного есть обе таблицы', () => {
    // Иначе при переключении языка вылезет undefined вместо слова.
    expect(Object.keys(UZ_NOUNS).sort()).toEqual(Object.keys(RU_NOUNS).sort())
    expect(Object.values(UZ_NOUNS).every(Boolean)).toBe(true)
  })
})

describe('перевод', () => {
  it('по-русски отдаёт исходную строку, не заглядывая в словарь', () => {
    expect(translate('Повторение', 'ru')).toBe('Повторение')
  })

  it('по-узбекски берёт перевод из словаря', () => {
    expect(translate('Повторение', 'uz')).toBe('Takrorlash')
  })

  it('словарь отдаёт каждую свою запись', () => {
    for (const [ru, uz] of Object.entries(UZ_TEXT)) expect(translate(ru, 'uz')).toBe(uz)
  })

  it('в узбекских строках нет кириллицы — признак непереведённого', () => {
    const left = Object.entries(UZ_TEXT).filter(([, uz]) => /[А-Яа-яЁё]/.test(uz))
    expect(left).toEqual([])
  })

  it('без перевода остаётся русский: экран не ломается, пропуск виден', () => {
    expect(translate('Такой строки в словаре нет', 'uz')).toBe('Такой строки в словаре нет')
  })
})
