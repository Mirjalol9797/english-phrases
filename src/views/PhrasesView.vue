<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from '@/i18n'
import { useRoute, useRouter } from 'vue-router'
import { useContentStore } from '@/stores/content'
import { useAsyncData } from '@/composables/useAsyncData'
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import StatusMessage from '@/components/StatusMessage.vue'
import ChapterFilter from '@/components/ChapterFilter.vue'
import { chapterFilters } from '@/utils/filters'
import PhraseItem from '@/components/PhraseItem.vue'
import AppIcon from '@/components/AppIcon.vue'
import { englishSearchText, normalizeSearch } from '@/utils/search'
import type { Phrase } from '@/types/content'

const { plural } = useI18n()

/** Фраза вместе с главой и уроком и заранее нормализованным текстом для поиска. */
interface SearchEntry {
  phrase: Phrase
  chapterId: string
  chapterTitle: string
  lessonId: string
  lessonTitle: string
  en: string
  ru: string
}

/** Сколько фраз показываем сразу: всего их тысячи, разом в разметку не отдаём. */
const PAGE_SIZE = 50

const content = useContentStore()
const route = useRoute()
const router = useRouter()

useDocumentTitle(() => 'Словарь')

const queryParam = (name: string) => (typeof route.query[name] === 'string' ? route.query[name] : '')

const query = ref(queryParam('q'))
const chapterId = ref(queryParam('chapter'))
const visible = ref(PAGE_SIZE)

const { data: chapters, loading, error, reload } = useAsyncData(
  () => 'phrases',
  () => content.loadAllChapters(),
)

const entries = computed<SearchEntry[]>(() => {
  const list: SearchEntry[] = []
  for (const chapter of chapters.value ?? []) {
    for (const lesson of chapter.lessons) {
      for (const phrase of lesson.phrases) {
        list.push({
          phrase,
          chapterId: chapter.id,
          chapterTitle: chapter.title.en,
          lessonId: lesson.id,
          lessonTitle: lesson.title.ru,
          en: normalizeSearch(englishSearchText(phrase)),
          ru: normalizeSearch(phrase.ru),
        })
      }
    }
  }
  return list
})

/** Совпадения по запросу без учёта фильтра — из них считаем числа на чипсах глав. */
const matched = computed(() => {
  const needle = normalizeSearch(query.value.trim())
  if (!needle) return entries.value
  return entries.value.filter((e) => e.en.includes(needle) || e.ru.includes(needle))
})

const results = computed(() =>
  chapterId.value ? matched.value.filter((e) => e.chapterId === chapterId.value) : matched.value,
)

const shown = computed(() => results.value.slice(0, visible.value))

// В словаре показываем все главы, даже пустые: по ним видно, где искать нечего.
const filters = computed(() =>
  chapterFilters(
    matched.value,
    (chapters.value ?? []).map((chapter) => ({ id: chapter.id, title: chapter.title.en })),
  ),
)

// Глава из адреса может быть удалена или переименована — тогда фильтр снимаем.
watch(chapters, (loaded) => {
  if (loaded && chapterId.value && !loaded.some((chapter) => chapter.id === chapterId.value)) {
    chapterId.value = ''
  }
})

watch([query, chapterId], ([q, chapter]) => {
  visible.value = PAGE_SIZE
  // Адрес хранит поиск, чтобы он не терялся при переходе к уроку и возврате назад.
  router.replace({
    query: { ...(q ? { q } : {}), ...(chapter ? { chapter } : {}) },
  })
})

// Обратная сторона: по ссылке с ?q=... экран показывает именно то, что в адресе,
// даже если словарь уже открыт и компонент не пересоздавался.
watch(
  () => route.query,
  () => {
    const q = queryParam('q')
    const chapter = queryParam('chapter')
    if (q !== query.value) query.value = q
    if (chapter !== chapterId.value) chapterId.value = chapter
  },
)
</script>

<template>
  <section>
    <h1 class="text-xl sm:text-2xl font-semibold">Словарь</h1>

    <div class="relative mt-4">
      <AppIcon name="search" :size="20" class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
      <input
        v-model="query"
        type="search"
        autocomplete="off"
        spellcheck="false"
        aria-label="Поиск по фразам"
        placeholder="Фраза на английском или русском"
        class="search-field w-full rounded-full border border-line bg-surface py-3 pr-12 pl-12 text-base placeholder:text-muted"
      />
      <button
        v-if="query"
        type="button"
        aria-label="Очистить поиск"
        class="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-ink"
        @click="query = ''"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </div>

    <StatusMessage v-if="loading || error" :loading="loading" :error="error" @retry="reload" />

    <template v-else-if="chapters">
      <ChapterFilter v-model="chapterId" :options="filters" label="Глава" class="mt-4" />

      <p class="mt-4 text-sm text-muted" role="status" aria-live="polite">
        {{ results.length ? `Найдено ${plural(results.length, 'match')}` : 'Ничего не нашлось' }}
      </p>

      <ol v-if="shown.length" class="mt-2 divide-y divide-line border-y border-line">
        <PhraseItem v-for="entry in shown" :key="entry.phrase.id" :phrase="entry.phrase" :query="query">
          <template #meta>
            <RouterLink
              :to="`/lessons/${entry.lessonId}`"
              class="mt-2 inline-flex flex-wrap items-baseline gap-x-1.5 text-sm text-muted hover:text-ink"
            >
              <span lang="en" class="font-serif">{{ entry.chapterTitle }}</span>
              <span aria-hidden="true">·</span>
              <span>{{ entry.lessonTitle }}</span>
            </RouterLink>
          </template>
        </PhraseItem>
      </ol>

      <p v-else class="mt-2 max-w-prose text-muted">
        Попробуйте другое слово или уберите фильтр по главе — поиск идёт и по английскому тексту, и по переводу.
      </p>

      <div v-if="results.length > shown.length" class="mt-4 sm:mt-5">
        <button type="button" class="btn-quiet" @click="visible += PAGE_SIZE">
          Показать ещё {{ Math.min(PAGE_SIZE, results.length - shown.length) }}
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
/* У type="search" свой крестик в WebKit — он дублировал бы нашу кнопку очистки. */
.search-field::-webkit-search-cancel-button {
  display: none;
}
</style>
