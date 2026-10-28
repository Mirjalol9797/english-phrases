// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import PhraseItem from './PhraseItem.vue'
import type { Phrase } from '@/types/content'

enableAutoUnmount(afterEach)

// Строка словаря спрашивает язык у настроек, значит нужно живое хранилище.
beforeEach(() => setActivePinia(createPinia()))

const phrase: Phrase = { id: 'EE008', en: "How's it going?", ru: 'Как дела? / Как оно?' }

const withExample: Phrase = {
  id: 'GET001',
  en: 'get up',
  ru: 'вставать',
  examples: [{ en: 'I get up at seven.', ru: 'Я встаю в семь.' }],
}

function render(props: { phrase: Phrase; query?: string }) {
  return mount(PhraseItem, { props })
}

/** Что именно подсвечено маркером. */
const highlighted = (wrapper: ReturnType<typeof render>) =>
  wrapper.findAll('.marker').map((el) => el.text())

describe('PhraseItem', () => {
  it('показывает фразу и перевод', () => {
    const wrapper = render({ phrase })
    expect(wrapper.text()).toContain("How's it going?")
    expect(wrapper.text()).toContain('Как дела?')
  })

  it('без запроса ничего не подсвечивает', () => {
    expect(highlighted(render({ phrase }))).toEqual([])
    expect(highlighted(render({ phrase, query: '  ' }))).toEqual([])
  })

  it('подсвечивает совпадение в английском тексте', () => {
    expect(highlighted(render({ phrase, query: 'going' }))).toEqual(['going'])
  })

  it('подсвечивает совпадение в переводе', () => {
    expect(highlighted(render({ phrase, query: 'дела' }))).toEqual(['дела'])
  })

  it('не различает регистр и вид апострофа', () => {
    expect(highlighted(render({ phrase, query: 'HOW’S' }))).toEqual(["How's"])
  })

  it('подсвечивает все вхождения', () => {
    expect(highlighted(render({ phrase, query: 'как' }))).toEqual(['Как', 'Как'])
  })

  it('не теряет исходный текст при подсветке', () => {
    const wrapper = render({ phrase, query: 'going' })
    expect(wrapper.findAll('p')[0]!.text()).toBe("How's it going?")
  })

  it('пример употребления показывает, только если он есть', () => {
    expect(render({ phrase }).text()).not.toContain('Я встаю')
    const wrapper = render({ phrase: withExample })
    expect(wrapper.text()).toContain('I get up at seven.')
    expect(wrapper.text()).toContain('Я встаю в семь.')
  })
})
