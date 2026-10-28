// @vitest-environment happy-dom
// Стор берёт тексты ошибок из i18n, а тот — язык из настроек, которые читают matchMedia.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { NotFoundError, useContentStore } from './content'

const index = {
  version: 1,
  plannedChapters: 2,
  totalPhrases: 2,
  chapters: [
    { id: 'first', order: 1, prefix: 'FF', kind: 'phrases', title: { en: 'First', ru: 'Первая' }, file: 'chapters/first.json', lessonCount: 1, phraseCount: 1 },
    { id: 'second', order: 2, prefix: 'SS', kind: 'phrases', title: { en: 'Second', ru: 'Вторая' }, file: 'chapters/second.json', lessonCount: 1, phraseCount: 1 },
  ],
}

const chapter = (id: string, prefix: string) => ({
  id,
  order: 1,
  prefix,
  kind: 'phrases',
  title: { en: id, ru: id },
  lessons: [
    {
      id: `${prefix}-L01`,
      order: 1,
      title: { en: 'Lesson', ru: 'Урок' },
      phrases: [{ id: `${prefix}001`, en: 'hi', ru: 'привет' }],
    },
  ],
})

/** Какие файлы были запрошены — по ним и видно, лишнего не тянем или тянем. */
let requested: string[] = []

beforeEach(() => {
  requested = []
  setActivePinia(createPinia())
  vi.stubGlobal('fetch', async (url: string) => {
    requested.push(url)
    const body = url.endsWith('chapters.json')
      ? index
      : url.includes('first')
        ? chapter('first', 'FF')
        : chapter('second', 'SS')
    return { ok: true, status: 200, json: async () => body } as Response
  })
})

const files = () => requested.filter((url) => url.includes('chapters/')).map((url) => url.split('/').pop())

describe('loadChapters', () => {
  it('грузит только названные главы', async () => {
    const content = useContentStore()
    const loaded = await content.loadChapters(['second'])
    expect(loaded.map((c) => c.id)).toEqual(['second'])
    expect(files()).toEqual(['second.json'])
  })

  it('на пустом списке не ходит никуда, даже за оглавлением', async () => {
    const content = useContentStore()
    expect(await content.loadChapters([])).toEqual([])
    expect(requested).toEqual([])
  })

  it('повторы в списке не приводят к повторным запросам', async () => {
    const content = useContentStore()
    const loaded = await content.loadChapters(['first', 'first', 'first'])
    expect(loaded).toHaveLength(1)
    expect(files()).toEqual(['first.json'])
  })

  it('уже загруженную главу второй раз не запрашивает', async () => {
    const content = useContentStore()
    await content.loadChapters(['first'])
    await content.loadChapters(['first', 'second'])
    expect(files()).toEqual(['first.json', 'second.json'])
  })

  it('о неизвестной главе сообщает понятно', async () => {
    const content = useContentStore()
    await expect(content.loadChapters(['выдумка'])).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('loadAllChapters', () => {
  it('грузит все главы из оглавления', async () => {
    const content = useContentStore()
    const loaded = await content.loadAllChapters()
    expect(loaded.map((c) => c.id).sort()).toEqual(['first', 'second'])
    expect(files().sort()).toEqual(['first.json', 'second.json'])
  })
})

describe('loadLesson', () => {
  it('находит урок по префиксу в его номере', async () => {
    const content = useContentStore()
    const ctx = await content.loadLesson('SS-L01')
    expect(ctx.chapter.id).toBe('second')
    expect(ctx.lesson.id).toBe('SS-L01')
    expect(ctx.previous).toBeNull()
    expect(ctx.next).toBeNull()
  })

  it('о неизвестном уроке сообщает понятно', async () => {
    const content = useContentStore()
    await expect(content.loadLesson('XX-L01')).rejects.toBeInstanceOf(NotFoundError)
  })
})
