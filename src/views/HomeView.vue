<script setup lang="ts">
import { computed } from 'vue'
import { useI18n, nounOf } from '@/i18n'
import { useContentStore } from '@/stores/content'
import { useProgressStore } from '@/stores/progress'
import { useSettingsStore } from '@/stores/settings'
import { useAsyncData } from '@/composables/useAsyncData'
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import StatusMessage from '@/components/StatusMessage.vue'
import type { ChapterSummary } from '@/types/content'

const { t, plural } = useI18n()

const content = useContentStore()
const progress = useProgressStore()
const settings = useSettingsStore()
useDocumentTitle(() => null)

const { data, loading, error, reload } = useAsyncData(
  () => 'home',
  async () => {
    const index = await content.loadIndex()
    const firstChapter = index.chapters[0]
    const chapter = firstChapter ? await content.loadChapter(firstChapter.id) : null
    // Следующий урок — первый, где есть ещё не тронутые фразы.
    const nextLesson =
      chapter?.lessons.find((lesson) => lesson.phrases.some((phrase) => !progress.isStarted(phrase.id))) ??
      chapter?.lessons[0] ??
      null
    return { index, nextLesson }
  },
)

/**
 * Главы по разделам: сначала те, что сами по себе, потом наборы вроде Oxford 3000.
 * Порядок разделов — порядок первой главы в каждом, чтобы он задавался конфигом.
 */
const sections = computed(() => {
  const chapters = data.value?.index.chapters ?? []
  const groups = new Map<string, ChapterSummary[]>()
  for (const chapter of chapters) {
    const key = chapter.group ?? ''
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(chapter)
  }
  return [...groups].map(([title, items]) => ({ title: title || t('Главы'), items }))
})

const featured = computed(() => data.value?.nextLesson?.phrases.find((p) => !progress.isStarted(p.id)) ?? data.value?.nextLesson?.phrases[0] ?? null)

const dueCount = computed(() => progress.dueIds().length)

</script>

<template>
  <StatusMessage v-if="loading || error" :loading="loading" :error="error" @retry="reload" />

  <template v-else-if="data">
    <!-- Сводка прогресса. Показываем, только когда уже есть что показывать. -->
    <div v-if="progress.startedCount > 0" class="flex flex-wrap items-center gap-x-5 gap-y-1 pb-6 text-sm">
      <span v-if="progress.streak > 0">
        {{ t('Серия') }} <span class="font-medium">{{ plural(progress.streak, 'day') }}</span>
      </span>
      <span class="text-muted">
        {{ t('Выучено {done} из {total}', { done: progress.learnedCount, total: progress.startedCount }) }}
      </span>
      <span v-if="settings.dailyNewLimit > 0" class="text-muted">
        {{ t('Новых сегодня {done} из {total}', { done: progress.newToday, total: settings.dailyNewLimit }) }}
      </span>
      <RouterLink v-if="dueCount" to="/review" class="text-accent underline underline-offset-4">
        {{ t('Повторить') }} {{ plural(dueCount, 'phrase') }}
      </RouterLink>
    </div>

    <section v-if="data.nextLesson && featured" class="pb-10">
      <p class="text-muted">{{ t('Первая фраза урока «{title}»', { title: data.nextLesson.title.ru }) }}</p>
      <p lang="en" class="mt-4 font-serif text-[clamp(1.875rem,9vw,3.25rem)] leading-[1.15] font-semibold">
        <span class="marker">{{ featured.en }}</span>
      </p>
      <p class="mt-3 text-lg text-muted">{{ featured.ru }}</p>
      <div class="mt-5 sm:mt-6">
        <RouterLink :to="`/lessons/${data.nextLesson.id}`" class="btn-primary">
          {{ t('Открыть урок {n}', { n: data.nextLesson.order }) }}
        </RouterLink>
      </div>
    </section>

    <section v-else class="pb-10">
      <h1 class="text-xl sm:text-2xl font-semibold">{{ t('Глав пока нет') }}</h1>
      <p class="mt-3 max-w-prose text-muted">
        {{ t('Положите Word-файлы с фразами в папку content/source и выполните') }}
        <code class="font-mono text-sm text-ink">yarn data:build</code>.
      </p>
    </section>

    <section
      v-for="(section, sectionIndex) in sections"
      :key="section.title"
      class="border-t border-line pt-6"
      :class="sectionIndex > 0 && 'mt-6 sm:mt-8'"
    >
      <div class="flex items-baseline justify-between gap-4">
        <h2 class="text-lg font-semibold">{{ section.title }}</h2>
        <p v-if="sectionIndex === 0" class="text-sm text-muted">
          {{ t('Добавлено {done} из {total}', { done: data.index.chapters.length, total: data.index.plannedChapters }) }}
        </p>
      </div>
      <ul class="mt-2 divide-y divide-line">
        <li v-for="chapter in section.items" :key="chapter.id">
          <RouterLink :to="`/chapters/${chapter.id}`" class="group flex items-baseline gap-4 py-3 sm:py-4">
            <span class="w-6 shrink-0 font-serif text-lg text-muted tabular-nums">{{ chapter.order }}</span>
            <span class="min-w-0 flex-1">
              <span lang="en" class="block font-serif text-lg leading-snug group-hover:underline">
                {{ chapter.title.en }}
              </span>
              <span class="block text-sm text-muted">{{ chapter.title.ru }}</span>
            </span>
            <span class="shrink-0 text-sm text-muted">{{ plural(chapter.phraseCount, nounOf(chapter.kind)) }}</span>
          </RouterLink>
        </li>
      </ul>
    </section>
  </template>
</template>
