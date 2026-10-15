import { ref, shallowRef, watch, type WatchSource } from 'vue'
import { NotFoundError } from '@/stores/content'

/**
 * Загружает данные и перезагружает их при изменении source (например, параметра маршрута).
 * Ответ на устаревший запрос игнорируется, если пользователь успел перейти дальше.
 */
export function useAsyncData<T>(source: WatchSource, loader: () => Promise<T>) {
  const data = shallowRef<T | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  const notFound = ref(false)
  let requestId = 0

  async function run() {
    const current = ++requestId
    loading.value = true
    error.value = null
    notFound.value = false
    try {
      const result = await loader()
      if (current === requestId) data.value = result
    } catch (e) {
      if (current !== requestId) return
      data.value = null
      notFound.value = e instanceof NotFoundError
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      if (current === requestId) loading.value = false
    }
  }

  watch(source, run, { immediate: true })

  return { data, loading, error, notFound, reload: run }
}
