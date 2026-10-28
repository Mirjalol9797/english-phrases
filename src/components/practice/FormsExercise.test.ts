// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import FormsExercise from './FormsExercise.vue'
import type { FormsStep } from '@/types/practice'

enableAutoUnmount(afterEach)

// Упражнения спрашивают язык у настроек, значит нужно живое хранилище.
beforeEach(() => setActivePinia(createPinia()))

const phrase = { id: 'IRV004', en: 'go', ru: 'идти; ехать', forms: { v2: 'went', v3: 'gone' } }

function render(step: Partial<FormsStep> = {}) {
  return mount(FormsExercise, {
    props: {
      step: { kind: 'forms', phrase, accept: { v2: ['went'], v3: ['gone'] }, ...step } as FormsStep,
    },
    attachTo: document.body,
  })
}

async function answer(wrapper: ReturnType<typeof render>, past: string, participle: string) {
  const fields = wrapper.findAll('input')
  await fields[0]!.setValue(past)
  await fields[1]!.setValue(participle)
  await wrapper.find('form').trigger('submit')
}

describe('FormsExercise', () => {
  it('показывает глагол и перевод, но не формы', () => {
    const wrapper = render()
    expect(wrapper.text()).toContain('go')
    expect(wrapper.text()).toContain('идти; ехать')
    // Формы — это и есть вопрос, показывать их до ответа нельзя.
    expect(wrapper.text()).not.toContain('went')
    expect(wrapper.text()).not.toContain('gone')
  })

  it('не даёт отправить, пока заполнено не всё', async () => {
    const wrapper = render()
    expect(wrapper.find('button[type=submit]').attributes('disabled')).toBeDefined()
    await wrapper.findAll('input')[0]!.setValue('went')
    expect(wrapper.find('button[type=submit]').attributes('disabled')).toBeDefined()
    await wrapper.findAll('input')[1]!.setValue('gone')
    expect(wrapper.find('button[type=submit]').attributes('disabled')).toBeUndefined()
  })

  it('принимает обе верные формы', async () => {
    const wrapper = render()
    await answer(wrapper, 'went', 'gone')
    expect(wrapper.emitted('answer')).toEqual([[true]])
  })

  it('прощает регистр и пробелы', async () => {
    const wrapper = render()
    await answer(wrapper, '  WENT ', 'Gone')
    expect(wrapper.emitted('answer')).toEqual([[true]])
  })

  it('одной верной формы мало', async () => {
    const wrapper = render()
    await answer(wrapper, 'went', 'went')
    expect(wrapper.emitted('answer')).toEqual([[false]])
  })

  it('принимает любой вариант формы через слэш', async () => {
    // got/gotten: обе формы верны, и по вопросу не угадать, какую ждут.
    const get = { id: 'IRV005', en: 'get', ru: 'получать', forms: { v2: 'got', v3: 'got/gotten' } }
    const wrapper = render({ phrase: get, accept: { v2: ['got'], v3: ['got/gotten', 'got', 'gotten'] } })
    await answer(wrapper, 'got', 'gotten')
    expect(wrapper.emitted('answer')).toEqual([[true]])
  })

  it('после ошибки показывает обе формы целиком', async () => {
    const wrapper = render()
    await answer(wrapper, 'goed', 'goed')
    expect(wrapper.text()).toContain('Правильно')
    expect(wrapper.text()).toContain('went')
    expect(wrapper.text()).toContain('gone')
  })

  it('верный, но иначе записанный ответ показывает запись из главы', async () => {
    const get = { id: 'IRV005', en: 'get', ru: 'получать', forms: { v2: 'got', v3: 'got/gotten' } }
    const wrapper = render({ phrase: get, accept: { v2: ['got'], v3: ['got/gotten', 'got', 'gotten'] } })
    await answer(wrapper, 'got', 'gotten')
    expect(wrapper.text()).toContain('В главе записано так')
    expect(wrapper.text()).toContain('got/gotten')
  })

  it('второй раз ответ не принимается', async () => {
    const wrapper = render()
    await answer(wrapper, 'goed', 'goed')
    await answer(wrapper, 'went', 'gone')
    expect(wrapper.emitted('answer')).toHaveLength(1)
    expect(wrapper.findAll('input')[0]!.attributes('readonly')).toBeDefined()
  })

  it('первое поле получает фокус сразу', () => {
    const wrapper = render()
    expect(document.activeElement).toBe(wrapper.findAll('input')[0]!.element)
  })
})
