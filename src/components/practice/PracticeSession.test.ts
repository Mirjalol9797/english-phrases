// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PracticeSession from './PracticeSession.vue'
import type { Phrase } from '@/types/content'
import type { PracticeStep, StepResult } from '@/types/practice'

enableAutoUnmount(afterEach)

const hi: Phrase = { id: 'EE001', en: 'Hi!', ru: 'Привет!' }
const bye: Phrase = { id: 'EE002', en: 'Bye!', ru: 'Пока!' }

const card = (phrase: Phrase): PracticeStep => ({ kind: 'card', phrase })
const choice = (phrase: Phrase, kind: 'choice-ru' | 'choice-en' = 'choice-ru'): PracticeStep => ({
  kind,
  phrase,
  answer: kind === 'choice-ru' ? phrase.ru : phrase.en,
  options: [phrase.ru, phrase.en],
})

/** Занятие как в жизни: карточки, потом этапы подряд по всем фразам. */
const steps: PracticeStep[] = [
  card(hi), card(bye),
  choice(hi), choice(bye),
  choice(hi, 'choice-en'), choice(bye, 'choice-en'),
]

/**
 * События ловим обработчиками, а не через emitted(): после снятия компонента
 * его записи уже недоступны, а проверять надо именно то, что он отдаёт при уходе.
 */
const onPhraseDone = vi.fn<(results: StepResult[]) => void>()
const onFinish = vi.fn<(results: StepResult[]) => void>()

function render(custom: PracticeStep[] = steps) {
  return mount(PracticeSession, {
    props: { steps: custom, exitTo: '/lessons/EE-L01', onPhraseDone, onFinish },
    global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    attachTo: document.body,
  })
}

type Wrapper = ReturnType<typeof render>

const button = (wrapper: Wrapper, label: string) =>
  wrapper.findAll('button').find((b) => b.text() === label)

const position = (wrapper: Wrapper) => wrapper.findAll('p')[0]?.text() ?? ''

/** Ответить на текущем шаге: верно или нет. */
async function answer(wrapper: Wrapper, correct: boolean) {
  const options = wrapper.findAll('.option')
  await options[correct ? 0 : 1]!.trigger('click')
}

const next = async (wrapper: Wrapper) => {
  const btn = button(wrapper, 'Дальше') ?? button(wrapper, 'Завершить')
  await btn!.trigger('click')
}

/** Какие фразы отданы наверх как завершённые. */
const doneIds = () => onPhraseDone.mock.calls.map((call) => call[0]![0]!.phrase.id)

beforeEach(() => {
  onPhraseDone.mockClear()
  onFinish.mockClear()
  setActivePinia(createPinia())
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
})

describe('PracticeSession', () => {
  it('начинает с первой карточки и показывает, где мы', () => {
    const wrapper = render()
    expect(position(wrapper)).toBe('Знакомство · 1 из 2')
    expect(wrapper.text()).toContain('Hi!')
  })

  it('на карточке «Дальше» доступно сразу', () => {
    const wrapper = render()
    expect(button(render(), 'Дальше')!.attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).not.toContain('Ответьте, чтобы продолжить')
  })

  it('в упражнении «Дальше» ждёт ответа', async () => {
    const wrapper = render()
    await next(wrapper)
    await next(wrapper)
    expect(button(wrapper, 'Дальше')!.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Ответьте, чтобы продолжить')

    await answer(wrapper, true)
    expect(button(wrapper, 'Дальше')!.attributes('disabled')).toBeUndefined()
  })

  it('подписывает этапы по порядку и пересчитывает их число', async () => {
    const wrapper = render()
    await next(wrapper)
    await next(wrapper)
    expect(position(wrapper)).toBe('Этап 1 из 2 · Выбор перевода · 1 из 2')
    await answer(wrapper, true)
    await next(wrapper)
    await answer(wrapper, true)
    await next(wrapper)
    expect(position(wrapper)).toBe('Этап 2 из 2 · Выбор фразы · 1 из 2')
  })

  it('на последнем шаге кнопка называется «Завершить»', async () => {
    const wrapper = render([choice(hi)])
    await answer(wrapper, true)
    expect(button(wrapper, 'Завершить')).toBeDefined()
  })

  it('отдаёт фразу наверх, когда она прошла все свои упражнения', async () => {
    const wrapper = render()
    await next(wrapper)
    await next(wrapper)

    // Первый этап: фразы ещё не закончены.
    await answer(wrapper, true)
    await next(wrapper)
    await answer(wrapper, true)
    await next(wrapper)
    expect(doneIds()).toEqual([])

    // Второй, последний этап: каждая фраза закрывается сразу после ответа.
    await answer(wrapper, true)
    expect(doneIds()).toEqual(['EE001'])
    await next(wrapper)
    await answer(wrapper, true)
    expect(doneIds()).toEqual(['EE001', 'EE002'])
  })

  it('при уходе с экрана отдаёт то, что успели ответить', async () => {
    const wrapper = render()
    await next(wrapper)
    await next(wrapper)
    await answer(wrapper, true)
    expect(doneIds()).toEqual([])

    wrapper.unmount()
    expect(doneIds()).toEqual(['EE001'])
  })

  it('не отдаёт одну фразу дважды', async () => {
    const wrapper = render([choice(hi)])
    await answer(wrapper, true)
    expect(doneIds()).toEqual(['EE001'])
    wrapper.unmount()
    expect(doneIds()).toEqual(['EE001'])
  })

  it('сообщает об окончании со всеми ответами', async () => {
    const wrapper = render([choice(hi), choice(bye)])
    await answer(wrapper, true)
    await next(wrapper)
    await answer(wrapper, false)
    await next(wrapper)

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0]![0]!.map((r) => [r.phrase.id, r.correct])).toEqual([
      ['EE001', true],
      ['EE002', false],
    ])
  })

  it('ничего не рисует на пустом наборе', () => {
    expect(render([]).find('button').exists()).toBe(false)
  })
})
