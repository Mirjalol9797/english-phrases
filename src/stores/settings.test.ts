import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { DEFAULT_SESSION_SIZE } from '@/utils/parts'

/** Хранилище в памяти: настоящего localStorage в node нет. */
function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  } as Storage
}

/**
 * Настройки трогают window и document, а в node их нет. Полноценное окружение
 * ради одного файла тянуть не стали — хватает того немногого, что store реально зовёт.
 */
function fakeDom() {
  vi.stubGlobal('window', {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  })
  vi.stubGlobal('document', {
    addEventListener() {},
    documentElement: { setAttribute() {}, removeAttribute() {} },
    // Мета-тега с цветом здесь нет, и store это переживает.
    querySelector: () => null,
  })
}

/**
 * Хранилище читается при создании store, поэтому модуль подключаем заново
 * под каждый набор данных: заглушки должны встать до импорта.
 */
async function loadStore(stored: Record<string, string> = {}) {
  vi.resetModules()
  fakeDom()
  vi.stubGlobal('localStorage', fakeStorage(stored))
  setActivePinia(createPinia())
  const { useSettingsStore } = await import('./settings')
  return useSettingsStore()
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('размер занятия', () => {
  it('без сохранённого значения берёт значение по умолчанию', async () => {
    // Ноль — допустимый размер («весь урок»), поэтому пустое хранилище
    // нельзя просто прогнать через Number: получился бы как раз ноль.
    const settings = await loadStore()
    expect(settings.sessionSize).toBe(DEFAULT_SESSION_SIZE)
  })

  it('читает сохранённый размер', async () => {
    expect((await loadStore({ 'english-phrases:session-size': '5' })).sessionSize).toBe(5)
    expect((await loadStore({ 'english-phrases:session-size': '0' })).sessionSize).toBe(0)
  })

  it('не берёт размер не из списка', async () => {
    expect((await loadStore({ 'english-phrases:session-size': '7' })).sessionSize).toBe(DEFAULT_SESSION_SIZE)
    expect((await loadStore({ 'english-phrases:session-size': 'много' })).sessionSize).toBe(DEFAULT_SESSION_SIZE)
  })
})

describe('дневной предел новых фраз', () => {
  it('без сохранённого значения берёт значение по умолчанию', async () => {
    expect((await loadStore()).dailyNewLimit).toBe(20)
  })

  it('читает сохранённый предел, включая «без ограничения»', async () => {
    expect((await loadStore({ 'english-phrases:daily-new': '10' })).dailyNewLimit).toBe(10)
    expect((await loadStore({ 'english-phrases:daily-new': '0' })).dailyNewLimit).toBe(0)
  })

  it('не берёт значение не из списка', async () => {
    expect((await loadStore({ 'english-phrases:daily-new': '13' })).dailyNewLimit).toBe(20)
  })
})

describe('выбор этапов', () => {
  it('по умолчанию включены все пять', async () => {
    const settings = await loadStore()
    expect(settings.enabledStages).toEqual(['choice-ru', 'listen', 'choice-en', 'assemble', 'typing'])
  })

  it('читает сохранённый выбор', async () => {
    const settings = await loadStore({ 'english-phrases:stages': 'choice-ru,typing' })
    expect(settings.enabledStages).toEqual(['choice-ru', 'typing'])
    expect(settings.isStageEnabled('typing')).toBe(true)
    expect(settings.isStageEnabled('assemble')).toBe(false)
  })

  it('отбрасывает незнакомые названия, пустой список заменяет полным', async () => {
    expect((await loadStore({ 'english-phrases:stages': 'typing,выдумка' })).enabledStages).toEqual(['typing'])
    expect((await loadStore({ 'english-phrases:stages': 'ерунда' })).enabledStages).toHaveLength(5)
    expect((await loadStore({ 'english-phrases:stages': '' })).enabledStages).toHaveLength(5)
  })

  it('включённый обратно этап встаёт на своё место в порядке', async () => {
    const settings = await loadStore({ 'english-phrases:stages': 'typing' })
    settings.toggleStage('choice-ru')
    expect(settings.enabledStages).toEqual(['choice-ru', 'typing'])
  })

  it('последний включённый этап выключить нельзя', async () => {
    const settings = await loadStore({ 'english-phrases:stages': 'typing' })
    settings.toggleStage('typing')
    expect(settings.enabledStages).toEqual(['typing'])
  })
})

describe('тема', () => {
  it('по умолчанию следует за системой', async () => {
    expect((await loadStore()).theme).toBe('system')
  })

  it('читает сохранённый выбор и отбрасывает посторонний', async () => {
    expect((await loadStore({ 'english-phrases:theme': 'dark' })).theme).toBe('dark')
    expect((await loadStore({ 'english-phrases:theme': 'розовая' })).theme).toBe('system')
  })
})

describe('озвучка', () => {
  it('включена, пока явно не выключили', async () => {
    expect((await loadStore()).speechEnabled).toBe(true)
    expect((await loadStore({ 'english-phrases:speech': 'off' })).speechEnabled).toBe(false)
  })

  it('скорость вне допустимого диапазона заменяется обычной', async () => {
    expect((await loadStore({ 'english-phrases:rate': '0.7' })).speechRate).toBe(0.7)
    expect((await loadStore({ 'english-phrases:rate': '5' })).speechRate).toBe(0.9)
    expect((await loadStore({ 'english-phrases:rate': 'быстро' })).speechRate).toBe(0.9)
  })
})
