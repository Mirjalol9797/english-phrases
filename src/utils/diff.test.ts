import { describe, expect, it } from 'vitest'
import { closestAnswer, diffWords, matchedWords } from './diff'

const typed = (text: string, expected: string) =>
  diffWords(text, expected).typed.map((p) => (p.same ? p.text : `[${p.text}]`)).join(' ')

const expected = (text: string, right: string) =>
  diffWords(text, right).expected.map((p) => (p.same ? p.text : `[${p.text}]`)).join(' ')

describe('diffWords', () => {
  it('у верного ответа всё совпадает', () => {
    expect(typed('How are you?', 'How are you?')).toBe('How are you?')
    expect(expected('How are you?', 'How are you?')).toBe('How are you?')
  })

  it('не считает ошибкой регистр, апостроф и знак в конце', () => {
    expect(typed('how ARE you', 'How are you?')).toBe('how ARE you')
    expect(typed('I’m fine', "I'm fine")).toBe('I’m fine')
  })

  it('отмечает одно неверное слово, не трогая остальные', () => {
    expect(typed('How are we?', 'How are you?')).toBe('How are [we?]')
    expect(expected('How are we?', 'How are you?')).toBe('How are [you?]')
  })

  it('пропущенное слово не сдвигает весь хвост', () => {
    // Ради этого и нужна общая подпоследовательность: позиционное сравнение
    // пометило бы здесь неверными три слова вместо одного.
    expect(typed('It is nice see you', 'It is nice to see you')).toBe('It is nice see you')
    expect(expected('It is nice see you', 'It is nice to see you')).toBe('It is nice [to] see you')
  })

  it('отмечает лишнее слово', () => {
    expect(typed('How are you my friend', 'How are you')).toBe('How are you [my] [friend]')
    expect(expected('How are you my friend', 'How are you')).toBe('How are you')
  })

  it('на совсем другом ответе помечает всё', () => {
    expect(typed('Good morning', 'See you later')).toBe('[Good] [morning]')
    expect(expected('Good morning', 'See you later')).toBe('[See] [you] [later]')
  })

  it('пустой ответ оставляет всю фразу неотвеченной', () => {
    expect(expected('', 'How are you?')).toBe('[How] [are] [you?]')
    expect(diffWords('', 'How are you?').typed).toEqual([])
  })

  it('не теряет и не добавляет слов', () => {
    const diff = diffWords('It is nice see you now', 'It is nice to see you')
    expect(diff.typed.map((p) => p.text).join(' ')).toBe('It is nice see you now')
    expect(diff.expected.map((p) => p.text).join(' ')).toBe('It is nice to see you')
  })
})

describe('matchedWords', () => {
  it('считает совпавшие слова', () => {
    expect(matchedWords(diffWords('How are you', 'How are you'))).toBe(3)
    expect(matchedWords(diffWords('How are we', 'How are you'))).toBe(2)
    expect(matchedWords(diffWords('zzz', 'How are you'))).toBe(0)
  })
})

describe('closestAnswer', () => {
  it('берёт вариант, который ближе к написанному', () => {
    // По вопросу «Привет!» подходят и Hi!, и Hey! — сравнивать надо с тем, что писали.
    expect(closestAnswer('Hey', ['Hi!', 'Hey!'])).toBe('Hey!')
    expect(closestAnswer('Hi', ['Hi!', 'Hey!'])).toBe('Hi!')
  })

  it('на единственном варианте возвращает его', () => {
    expect(closestAnswer('что угодно', ['Good morning!'])).toBe('Good morning!')
  })

  it('без вариантов не падает', () => {
    expect(closestAnswer('что-то', [])).toBe('')
  })
})
