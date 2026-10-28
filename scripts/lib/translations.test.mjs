import { describe, expect, it } from 'vitest'
import { applyTranslation, translationKey } from './translations.mjs'

/** Глава из двух записей — хватает, чтобы отличить полный перевод от половины. */
function chapter() {
  return {
    title: { en: 'Everyday English', ru: 'Повседневное общение' },
    lessons: [
      {
        title: { en: 'Greetings', ru: 'Приветствия' },
        phrases: [
          { id: 'EE001', en: 'Hi!', ru: 'Привет!' },
          { id: 'EE002', en: 'Bye!', ru: 'Пока!' },
        ],
      },
    ],
  }
}

const translation = (entries, extra = {}) => ({ chapterId: 'everyday-english', entries, ...extra })

describe('перевод главы', () => {
  it('кладёт узбекский рядом с русским, не трогая русский', () => {
    const c = chapter()
    applyTranslation(
      c,
      translation([
        { en: 'Hi!', ru: 'Привет!', uz: 'Salom!' },
        { en: 'Bye!', ru: 'Пока!', uz: 'Xayr!' },
      ]),
    )
    expect(c.lessons[0].phrases[0]).toMatchObject({ ru: 'Привет!', uz: 'Salom!' })
    expect(c.lessons[0].phrases[1].uz).toBe('Xayr!')
  })

  it('переводит названия главы и урока', () => {
    const c = chapter()
    applyTranslation(
      c,
      translation(
        [
          { en: 'Hi!', ru: 'Привет!', uz: 'Salom!' },
          { en: 'Bye!', ru: 'Пока!', uz: 'Xayr!' },
        ],
        { title: 'Kundalik muloqot', lessons: { Приветствия: 'Salomlashish' } },
      ),
    )
    expect(c.title.uz).toBe('Kundalik muloqot')
    expect(c.lessons[0].title.uz).toBe('Salomlashish')
  })

  it('половину главы не берёт вовсе и предупреждает', () => {
    // Иначе в упражнении ответ был бы по-узбекски, а неверные варианты по-русски.
    const c = chapter()
    const { problems, warnings } = applyTranslation(c, translation([{ en: 'Hi!', ru: 'Привет!', uz: 'Salom!' }]))
    expect(c.lessons[0].phrases[0].uz).toBeUndefined()
    expect(problems).toEqual([])
    expect(warnings.join(' ')).toContain('переведено 1 записей из 2')
  })

  it('половина главы не оставляет и переведённого названия', () => {
    const c = chapter()
    applyTranslation(c, translation([{ en: 'Hi!', ru: 'Привет!', uz: 'Salom!' }], { title: 'Kundalik muloqot' }))
    expect(c.title.uz).toBeUndefined()
  })

  it('запись, не нашедшая своей фразы, — ошибка: это опечатка в ключе', () => {
    const c = chapter()
    const { problems } = applyTranslation(
      c,
      translation([
        { en: 'Hi!', ru: 'Привет!', uz: 'Salom!' },
        { en: 'Bye!', ru: 'Пока!', uz: 'Xayr!' },
        { en: 'Hiya!', ru: 'Привет!', uz: 'Salom!' },
      ]),
    )
    expect(problems.join(' ')).toContain('«Hiya!» не нашлось')
  })

  it('ловит одну и ту же запись дважды', () => {
    const c = chapter()
    const { problems } = applyTranslation(
      c,
      translation([
        { en: 'Hi!', ru: 'Привет!', uz: 'Salom!' },
        { en: 'Hi!', ru: 'Привет!', uz: 'Assalom!' },
        { en: 'Bye!', ru: 'Пока!', uz: 'Xayr!' },
      ]),
    )
    expect(problems.join(' ')).toContain('встречается дважды')
  })

  it('переводит примеры по их английскому тексту', () => {
    const c = chapter()
    c.lessons[0].phrases[0].examples = [{ en: 'Hi, how are you?', ru: 'Привет, как дела?' }]
    applyTranslation(
      c,
      translation([
        {
          en: 'Hi!',
          ru: 'Привет!',
          uz: 'Salom!',
          examples: [{ en: 'Hi, how are you?', uz: 'Salom, qalaysiz?' }],
        },
        { en: 'Bye!', ru: 'Пока!', uz: 'Xayr!' },
      ]),
    )
    expect(c.lessons[0].phrases[0].examples[0]).toMatchObject({ ru: 'Привет, как дела?', uz: 'Salom, qalaysiz?' })
  })

  it('без файла перевода ничего не делает', () => {
    const c = chapter()
    const { problems, warnings } = applyTranslation(c, null)
    expect([problems, warnings]).toEqual([[], []])
    expect(c.lessons[0].phrases[0].uz).toBeUndefined()
  })

  it('ключ учитывает часть речи: «rock» камень и «rock» музыка — разные записи', () => {
    expect(translationKey('rock', 'n.', 'камень')).not.toBe(translationKey('rock', 'n.', 'рок'))
  })
})
