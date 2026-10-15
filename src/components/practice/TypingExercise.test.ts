// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import TypingExercise from './TypingExercise.vue'
import type { TypingStep } from '@/types/practice'

enableAutoUnmount(afterEach)

const phrase = { id: 'EE010', en: 'It is nice to see you.', ru: 'Рад тебя видеть.' }

function render(step: Partial<TypingStep> = {}) {
  return mount(TypingExercise, {
    props: { step: { kind: 'typing', phrase, accept: [phrase.en], ...step } as TypingStep },
    attachTo: document.body,
  })
}

async function answer(wrapper: ReturnType<typeof render>, text: string) {
  await wrapper.find('input').setValue(text)
  await wrapper.find('form').trigger('submit')
}

/** Слова с пометкой: так видно, что именно подсвечено. */
function marked(wrapper: ReturnType<typeof render>, label: string) {
  const title = wrapper.findAll('p').find((p) => p.text().trim() === label)
  const block = title?.element.nextElementSibling
  if (!block) return null
  return [...block.querySelectorAll('span')]
    .map((s) => {
      const wrong = s.className.includes('line-through') || s.className.includes('marker')
      return wrong ? `[${s.textContent!.trim()}]` : s.textContent!.trim()
    })
    .join(' ')
}

describe('TypingExercise', () => {
  it('показывает перевод и не даёт отправить пустой ответ', () => {
    const wrapper = render()
    expect(wrapper.text()).toContain('Рад тебя видеть.')
    expect(wrapper.find('button[type=submit]').attributes('disabled')).toBeDefined()
  })

  it('принимает верный ответ', async () => {
    const wrapper = render()
    await answer(wrapper, 'It is nice to see you.')
    expect(wrapper.emitted('answer')).toEqual([[true]])
  })

  it('прощает регистр, апостроф и точку в конце', async () => {
    const wrapper = render({ phrase: { ...phrase, en: "I'm fine." }, accept: ["I'm fine."] })
    await answer(wrapper, '  i’M   FINE ')
    expect(wrapper.emitted('answer')).toEqual([[true]])
  })

  it('принимает любой из допустимых ответов', async () => {
    const wrapper = render({ accept: ['Hi!', 'Hey!'] })
    await answer(wrapper, 'Hey')
    expect(wrapper.emitted('answer')).toEqual([[true]])
  })

  it('считает ошибкой другое слово', async () => {
    const wrapper = render()
    await answer(wrapper, 'It is nice to meet you.')
    expect(wrapper.emitted('answer')).toEqual([[false]])
  })

  it('после ошибки показывает, где разошлось', async () => {
    const wrapper = render()
    await answer(wrapper, 'It is nice see you')
    expect(marked(wrapper, 'Вы написали')).toBe('It is nice see you')
    expect(marked(wrapper, 'Правильно')).toBe('It is nice [to] see you.')
  })

  it('помечает лишнее слово зачёркиванием', async () => {
    const wrapper = render({ phrase: { ...phrase, en: 'How are you?' }, accept: ['How are you?'] })
    await answer(wrapper, 'How are you my friend')
    expect(marked(wrapper, 'Вы написали')).toBe('How are you [my] [friend]')
  })

  it('второй раз ответ не принимается', async () => {
    const wrapper = render()
    await answer(wrapper, 'wrong')
    await answer(wrapper, 'It is nice to see you.')
    expect(wrapper.emitted('answer')).toHaveLength(1)
    expect(wrapper.find('input').attributes('readonly')).toBeDefined()
  })

  it('поле получает фокус сразу', () => {
    const wrapper = render()
    expect(document.activeElement).toBe(wrapper.find('input').element)
  })
})
