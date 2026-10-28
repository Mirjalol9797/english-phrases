// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import AssembleExercise from './AssembleExercise.vue'
import type { AssembleStep } from '@/types/practice'

enableAutoUnmount(afterEach)

// Упражнения спрашивают язык у настроек, значит нужно живое хранилище.
beforeEach(() => setActivePinia(createPinia()))

const phrase = { id: 'EE007', en: 'How are you?', ru: 'Как дела?' }

/** Слова нарочно перемешаны — собирать придётся не по порядку. */
const step: AssembleStep = { kind: 'assemble', phrase, words: ['you?', 'How', 'are'] }

function render() {
  return mount(AssembleExercise, { props: { step }, attachTo: document.body })
}

type Wrapper = ReturnType<typeof render>

/** Доступные для выбора слова — те, что в нижнем списке. */
const bank = (wrapper: Wrapper) => wrapper.findAll('ul .word-chip')

/** Собранная строка — чипы в верхней рамке. */
const collected = (wrapper: Wrapper) =>
  wrapper.findAll('.word-chip').filter((c) => !c.element.closest('ul')).map((c) => c.text())

async function build(wrapper: Wrapper, order: string[]) {
  for (const word of order) {
    const chip = bank(wrapper).find((c) => c.text() === word && c.attributes('disabled') === undefined)
    await chip!.trigger('click')
  }
}

const check = (wrapper: Wrapper) =>
  wrapper.findAll('button').find((b) => b.text() === 'Проверить')

function press(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

describe('AssembleExercise', () => {
  it('показывает перевод и все слова', () => {
    const wrapper = render()
    expect(wrapper.text()).toContain('Как дела?')
    expect(bank(wrapper)).toHaveLength(3)
  })

  it('не даёт проверить, пока ничего не собрано', () => {
    expect(check(render())!.attributes('disabled')).toBeDefined()
  })

  it('принимает верно собранную фразу', async () => {
    const wrapper = render()
    await build(wrapper, ['How', 'are', 'you?'])
    expect(collected(wrapper)).toEqual(['How', 'are', 'you?'])
    await check(wrapper)!.trigger('click')
    expect(wrapper.emitted('answer')).toEqual([[true]])
  })

  it('считает ошибкой неверный порядок', async () => {
    const wrapper = render()
    await build(wrapper, ['are', 'How', 'you?'])
    await check(wrapper)!.trigger('click')
    expect(wrapper.emitted('answer')).toEqual([[false]])
    expect(wrapper.text()).toContain('How are you?')
  })

  it('выбранное слово больше не предлагается', async () => {
    const wrapper = render()
    await build(wrapper, ['How'])
    const used = bank(wrapper).find((c) => c.text() === 'How')
    expect(used!.attributes('disabled')).toBeDefined()
  })

  it('нажатие на собранное слово возвращает его', async () => {
    const wrapper = render()
    await build(wrapper, ['How', 'are'])
    await wrapper.findAll('.word-chip').filter((c) => !c.element.closest('ul'))[1]!.trigger('click')
    expect(collected(wrapper)).toEqual(['How'])
  })

  it('Backspace снимает последнее слово', async () => {
    const wrapper = render()
    await build(wrapper, ['How', 'are'])
    press('Backspace')
    await wrapper.vm.$nextTick()
    expect(collected(wrapper)).toEqual(['How'])
  })

  it('Enter проверяет собранное', async () => {
    const wrapper = render()
    await build(wrapper, ['How', 'are', 'you?'])
    press('Enter')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('answer')).toEqual([[true]])
  })

  it('после проверки ничего не меняется', async () => {
    const wrapper = render()
    await build(wrapper, ['How', 'are', 'you?'])
    await check(wrapper)!.trigger('click')
    press('Backspace')
    await wrapper.vm.$nextTick()
    expect(collected(wrapper)).toEqual(['How', 'are', 'you?'])
    expect(wrapper.emitted('answer')).toHaveLength(1)
  })
})
