// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import ChapterFilter from './ChapterFilter.vue'

enableAutoUnmount(afterEach)

const options = [
  { id: '', title: 'Все главы', count: 17 },
  { id: 'irregular-verbs', title: 'Irregular Verbs', count: 12 },
  { id: 'oxford-a1', title: 'Oxford 3000 · A1', count: 5 },
]

const render = (props: { options?: typeof options; modelValue?: string } = {}) =>
  mount(ChapterFilter, {
    props: { options, modelValue: '', label: 'Глава', ...props },
  })

describe('ChapterFilter', () => {
  it('показывает каждую главу с её числом', () => {
    const wrapper = render()
    // Название и число — соседние элементы, и в тексте кнопки они идут подряд.
    const texts = wrapper.findAll('button').map((b) => b.text())
    expect(texts).toEqual(['Все главы17', 'Irregular Verbs12', 'Oxford 3000 · A15'])
  })

  it('вслух читается с разделителем, а не слипшимся', () => {
    const labels = render().findAll('button').map((b) => b.attributes('aria-label'))
    expect(labels).toEqual(['Все главы: 17', 'Irregular Verbs: 12', 'Oxford 3000 · A1: 5'])
  })

  it('помечает выбранную главу', () => {
    const wrapper = render({ modelValue: 'oxford-a1' })
    const pressed = wrapper.findAll('button').map((b) => b.attributes('aria-pressed'))
    expect(pressed).toEqual(['false', 'false', 'true'])
  })

  it('по нажатию отдаёт выбранную главу', async () => {
    const wrapper = render()
    await wrapper.findAll('button')[1]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['irregular-verbs']])
  })

  it('делить не на что — ряд не показывается', () => {
    // Одна глава плюс «все главы»: выбор между ними ничего не меняет.
    const wrapper = render({ options: options.slice(0, 2) })
    expect(wrapper.find('ul').exists()).toBe(false)
  })
})
