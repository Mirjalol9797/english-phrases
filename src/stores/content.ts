import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { fetchChapter, fetchContentIndex } from '@/services/dataService'
import type { Chapter, ContentIndex, LessonContext } from '@/types/content'

export class NotFoundError extends Error {}

/**
 * Контент приложения: список глав и сами главы.
 * Главы загружаются по требованию и кэшируются, повторный запрос не идёт в сеть.
 */
export const useContentStore = defineStore('content', () => {
  const index = shallowRef<ContentIndex | null>(null)
  const chapters = ref<Record<string, Chapter>>({})

  let indexRequest: Promise<ContentIndex> | null = null
  const chapterRequests = new Map<string, Promise<Chapter>>()

  function loadIndex(): Promise<ContentIndex> {
    if (index.value) return Promise.resolve(index.value)
    indexRequest ??= fetchContentIndex()
      .then((data) => {
        data.chapters.sort((a, b) => a.order - b.order)
        index.value = data
        return data
      })
      .catch((error: unknown) => {
        indexRequest = null
        throw error
      })
    return indexRequest
  }

  async function loadChapter(chapterId: string): Promise<Chapter> {
    const cached = chapters.value[chapterId]
    if (cached) return cached

    const { chapters: summaries } = await loadIndex()
    const summary = summaries.find((c) => c.id === chapterId)
    if (!summary) throw new NotFoundError(`Глава «${chapterId}» не найдена.`)

    let request = chapterRequests.get(chapterId)
    if (!request) {
      request = fetchChapter(summary.file)
        .then((chapter) => {
          chapters.value[chapterId] = chapter
          return chapter
        })
        .finally(() => chapterRequests.delete(chapterId))
      chapterRequests.set(chapterId, request)
    }
    return request
  }

  /** Все главы сразу — нужно словарю, который ищет по всему контенту. */
  async function loadAllChapters(): Promise<Chapter[]> {
    const { chapters: summaries } = await loadIndex()
    return Promise.all(summaries.map((summary) => loadChapter(summary.id)))
  }

  /** ID урока вида EE-L01: префикс указывает на главу. */
  async function loadLesson(lessonId: string): Promise<LessonContext> {
    const prefix = lessonId.split('-L')[0]
    const { chapters: summaries } = await loadIndex()
    const summary = summaries.find((c) => c.prefix === prefix)
    if (!summary) throw new NotFoundError(`Урок «${lessonId}» не найден.`)

    const chapter = await loadChapter(summary.id)
    const position = chapter.lessons.findIndex((l) => l.id === lessonId)
    const lesson = chapter.lessons[position]
    if (!lesson) throw new NotFoundError(`Урок «${lessonId}» не найден.`)

    return {
      chapter,
      lesson,
      previous: chapter.lessons[position - 1] ?? null,
      next: chapter.lessons[position + 1] ?? null,
    }
  }

  return { index, chapters, loadIndex, loadChapter, loadAllChapters, loadLesson }
})
