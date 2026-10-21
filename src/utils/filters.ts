import type { ChapterFilterOption } from '@/components/ChapterFilter.vue'

/**
 * Опции для ряда чипсов: сколько записей приходится на каждую главу,
 * и «все главы» первым пунктом.
 *
 * Какие главы показывать и в каком порядке — решает вызывающий: словарю нужны
 * все, включая пустые, а повторению только те, где сегодня есть что делать.
 */
export function chapterFilters(
  entries: readonly { chapterId: string }[],
  chapters: readonly { id: string; title: string }[],
): ChapterFilterOption[] {
  const counts = new Map<string, number>()
  for (const entry of entries) counts.set(entry.chapterId, (counts.get(entry.chapterId) ?? 0) + 1)

  return [
    { id: '', title: 'Все главы', count: entries.length },
    ...chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      count: counts.get(chapter.id) ?? 0,
    })),
  ]
}

/** Только непустые главы, самые нагруженные впереди. «Все главы» остаётся первым. */
export function byLoad(options: ChapterFilterOption[]): ChapterFilterOption[] {
  const [everything, ...rest] = options
  if (!everything) return []
  return [
    everything,
    ...rest.filter((option) => option.count > 0).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title)),
  ]
}
