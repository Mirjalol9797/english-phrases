// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import ChoiceExercise from './ChoiceExercise.vue'
import type { ChoiceStep } from '@/types/practice'

// Компоненты слушают клавиши на окне. Без снятия предыдущий перехватил бы
// нажатие и погасил его, и следующий тест ничего бы не увидел.
enableAutoUnmount(afterEach)

// Упражнения спрашивают язык у настроек, значит нужно живое хранилище.
beforeEach(() => setActivePinia(createPinia()))

const phrase = { id: 'EE001', en: 'Hi!', ru: 'Привет!' }

const step: ChoiceStep = {
  kind: 'choice-ru',
  phrase,
  answer: 'Привет!',
  options: ['Доброе утро!', 'Привет!', 'Пока!', 'Спасибо.'],
}

function render(overrides: Partial<ChoiceStep> = {}) {
  return mount(ChoiceExercise, {
    props: { step: { ...step, ...overrides } as ChoiceStep, speak: vi.fn(), speechSupported: false },
    attachTo: document.body,
  })
}

const options = (wrapper: ReturnType<typeof render>) => wrapper.findAll('.option')

/** Нажатие клавиши в окне — так же, как это делает настоящий пользователь. */
function press(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

describe('ChoiceExercise', () => {
  it('показывает вопрос и все варианты', () => {
    const wrapper = render()
    expect(wrapper.text()).toContain('Hi!')
    expect(options(wrapper)).toHaveLength(4)
    for (const option of step.options) expect(wrapper.text()).toContain(option)
  })

  it('сообщает о верном ответе', async () => {
    const wrapper = render()
    await options(wrapper)[1]!.trigger('click')
    expect(wrapper.emitted('answer')).toEqual([[true]])
  })

  it('сообщает об ошибке', async () => {
    const wrapper = render()
    await options(wrapper)[0]!.trigger('click')
    expect(wrapper.emitted('answer')).toEqual([[false]])
  })

  it('после ответа подсвечивает верный и выбранный неверный', async () => {
    const wrapper = render()
    await options(wrapper)[0]!.trigger('click')
    expect(options(wrapper)[0]!.classes()).toContain('option-wrong')
    expect(options(wrapper)[1]!.classes()).toContain('option-correct')
  })

  it('второй ответ уже не принимается', async () => {
    const wrapper = render()
    await options(wrapper)[0]!.trigger('click')
    await options(wrapper)[1]!.trigger('click')
    expect(wrapper.emitted('answer')).toHaveLength(1)
    expect(options(wrapper).every((o) => o.attributes('disabled') !== undefined)).toBe(true)
  })

  it('цифра выбирает вариант по порядку', async () => {
    const wrapper = render()
    press('2')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('answer')).toEqual([[true]])
  })

  it('цифра вне списка ничего не выбирает', async () => {
    const wrapper = render()
    press('9')
    press('0')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('answer')).toBeUndefined()
  })

  it('перестаёт слушать клавиши после ухода с экрана', async () => {
    const wrapper = render()
    wrapper.unmount()
    press('1')
    expect(wrapper.emitted('answer')).toBeUndefined()
  })

  it('в выборе английской фразы спрашивает перевод', () => {
    const wrapper = render({
      kind: 'choice-en',
      answer: 'Hi!',
      options: ['Hi!', 'Bye!', 'Thanks.', 'Good morning!'],
    })
    expect(wrapper.text()).toContain('Выберите английскую фразу')
    expect(wrapper.text()).toContain('Привет!')
  })

  it('кнопку озвучки показывает только при наличии голоса', () => {
    expect(render().find('[aria-label="Произнести фразу"]').exists()).toBe(false)
    const speaking = mount(ChoiceExercise, {
      props: { step, speak: vi.fn(), speechSupported: true },
    })
    expect(speaking.find('[aria-label="Произнести фразу"]').exists()).toBe(true)
  })
})
