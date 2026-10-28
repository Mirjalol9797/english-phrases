// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import ListenExercise from './ListenExercise.vue'
import type { ListenStep } from '@/types/practice'

enableAutoUnmount(afterEach)

// Упражнения спрашивают язык у настроек, значит нужно живое хранилище.
beforeEach(() => setActivePinia(createPinia()))

const phrase = { id: 'EE001', en: 'See you tomorrow.', ru: 'Увидимся завтра.' }

const step: ListenStep = {
  kind: 'listen',
  phrase,
  answer: 'Увидимся завтра.',
  options: ['До свидания!', 'Увидимся завтра.', 'Пока!', 'До скорой встречи.'],
}

function render() {
  const speak = vi.fn()
  const wrapper = mount(ListenExercise, {
    props: { step, speak, speaking: false },
    attachTo: document.body,
  })
  return { wrapper, speak }
}

const options = (wrapper: ReturnType<typeof render>['wrapper']) => wrapper.findAll('.option')

function press(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

describe('ListenExercise', () => {
  it('произносит фразу сразу при показе', () => {
    const { speak } = render()
    expect(speak).toHaveBeenCalledWith('See you tomorrow.')
  })

  it('до ответа английского текста на экране нет', () => {
    const { wrapper } = render()
    expect(wrapper.text()).not.toContain('See you tomorrow.')
    expect(wrapper.text()).toContain('Послушайте и выберите перевод')
  })

  it('кнопка повторяет фразу', async () => {
    const { wrapper, speak } = render()
    speak.mockClear()
    await wrapper.find('[aria-label="Послушать ещё раз"]').trigger('click')
    expect(speak).toHaveBeenCalledWith('See you tomorrow.')
  })

  it('пробел тоже повторяет фразу', async () => {
    const { wrapper, speak } = render()
    speak.mockClear()
    press(' ')
    await wrapper.vm.$nextTick()
    expect(speak).toHaveBeenCalledTimes(1)
  })

  it('сообщает о верном ответе и показывает написание', async () => {
    const { wrapper } = render()
    await options(wrapper)[1]!.trigger('click')
    expect(wrapper.emitted('answer')).toEqual([[true]])
    expect(wrapper.text()).toContain('See you tomorrow.')
  })

  it('сообщает об ошибке', async () => {
    const { wrapper } = render()
    await options(wrapper)[0]!.trigger('click')
    expect(wrapper.emitted('answer')).toEqual([[false]])
  })

  it('цифра выбирает вариант', async () => {
    const { wrapper } = render()
    press('2')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('answer')).toEqual([[true]])
  })

  it('после ответа повтор звука всё ещё работает, а выбор — нет', async () => {
    const { wrapper, speak } = render()
    await options(wrapper)[1]!.trigger('click')
    speak.mockClear()
    press(' ')
    press('1')
    await wrapper.vm.$nextTick()
    expect(speak).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('answer')).toHaveLength(1)
  })
})
