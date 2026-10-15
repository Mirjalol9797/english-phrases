import type { Chapter, ContentIndex } from '@/types/content'

const DATA_URL = `${import.meta.env.BASE_URL}data/`

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${DATA_URL}${path}`)
  if (!response.ok) {
    throw new Error(`Файл ${path} не загрузился (код ${response.status}).`)
  }
  return (await response.json()) as T
}

export function fetchContentIndex(): Promise<ContentIndex> {
  return fetchJson<ContentIndex>('chapters.json')
}

export function fetchChapter(file: string): Promise<Chapter> {
  return fetchJson<Chapter>(file)
}
