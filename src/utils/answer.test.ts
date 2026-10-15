import { describe, expect, it } from 'vitest'
import { isSameAnswer, normalizeAnswer } from './answer'

describe('normalizeAnswer', () => {
  it('приводит к нижнему регистру', () => {
    expect(normalizeAnswer('Good Morning')).toBe('good morning')
  })

  it('считает разные апострофы одинаковыми', () => {
    expect(normalizeAnswer('I’m')).toBe("i'm")
    expect(normalizeAnswer("I'm")).toBe("i'm")
  })

  it('отбрасывает знак в конце', () => {
    expect(normalizeAnswer('Hi!')).toBe('hi')
    expect(normalizeAnswer('How are you?')).toBe('how are you')
    expect(normalizeAnswer('Take care.')).toBe('take care')
  })

  it('сжимает лишние пробелы', () => {
    expect(normalizeAnswer('  see   you  later ')).toBe('see you later')
  })
})

describe('isSameAnswer', () => {
  it('прощает регистр, апостроф, пробелы и точку', () => {
    expect(isSameAnswer("I'm fine.", '  i’M   FINE ')).toBe(true)
  })

  it('не прощает пропущенный апостроф', () => {
    // «Im» и «I'm» — разное написание, это настоящая ошибка.
    expect(isSameAnswer('Im good', "I'm good")).toBe(false)
  })

  it('не прощает другое слово', () => {
    expect(isSameAnswer('Good morning', 'Good evening')).toBe(false)
  })

  it('не прощает знак в середине', () => {
    expect(isSameAnswer('Hi, there', 'Hi there')).toBe(false)
  })
})
