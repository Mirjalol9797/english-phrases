<script setup lang="ts">
import { computed } from 'vue'
import { useI18n, nounOf } from '@/i18n'
import { useContentStore } from '@/stores/content'
import { useProgressStore } from '@/stores/progress'
import { useAsyncData } from '@/composables/useAsyncData'
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import StatusMessage from '@/components/StatusMessage.vue'
import AppIcon from '@/components/AppIcon.vue'

const { plural, t, tr } = useI18n()

const content = useContentStore()
const progress = useProgressStore()

/** Прогресс главы, если по ней уже занимались. */
function counts(chapterId: string) {
  return progress.countsByChapter[chapterId] ?? null
}
useDocumentTitle(() => t('Главы'))

const { data: index, loading, error, reload } = useAsyncData(
  () => 'chapters',
  () => content.loadIndex(),
)

/** Во всех главах по 20 уроков, но размер урока одинаков только у глав с фразами. */
const hasExpressions = computed(() => index.value?.chapters.some((c) => c.kind === 'expressions') ?? false)

const total = computed(() => {
  if (!index.value) return ''
  const count = index.value.totalPhrases
  return hasExpressions.value ? t('{count} фраз и выражений', { count }) : plural(count, 'phrase')
})

/** Номера глав, которые запланированы, но ещё не добавлены. */
const emptySlots = computed(() => {
  if (!index.value) return []
  const added = index.value.chapters.length
  const missing = Math.max(0, index.value.plannedChapters - added)
  return Array.from({ length: missing }, (_, i) => added + i + 1)
})
</script>

<template>
  <StatusMessage v-if="loading || error" :loading="loading" :error="error" @retry="reload" />

  <section v-else-if="index">
    <h1 class="text-xl sm:text-2xl font-semibold">{{ t('Главы') }}</h1>
    <p class="mt-2 max-w-prose text-muted">
      {{ t('Добавлено {done} из {total}, всего {count}.', { done: index.chapters.length, total: index.plannedChapters, count: total }) }}
      {{ t('Каждая глава разбита на уроки, в уроке от пяти до двадцати записей.') }}
    </p>

    <ol class="mt-4 sm:mt-5 divide-y divide-line border-y border-line">
      <li v-for="chapter in index.chapters" :key="chapter.id">
        <RouterLink :to="`/chapters/${chapter.id}`" class="group flex items-center gap-4 py-3 sm:py-4">
          <span class="w-7 shrink-0 text-right font-serif text-xl sm:text-2xl text-muted tabular-nums">{{ chapter.order }}</span>
          <span class="min-w-0 flex-1">
            <span lang="en" class="block font-serif text-lg leading-snug group-hover:underline sm:text-xl">
              {{ chapter.title.en }}
            </span>
            <span class="block text-muted">{{ tr(chapter.title) }}</span>
            <span class="mt-1 block text-sm text-muted">
              {{ plural(chapter.lessonCount, 'lesson') }},
              {{ plural(chapter.phraseCount, nounOf(chapter.kind)) }}
              <template v-if="counts(chapter.id)">
                · {{ t('начато {started}, выучено {learned}', { started: counts(chapter.id)!.started, learned: counts(chapter.id)!.learned }) }}
              </template>
            </span>
          </span>
          <AppIcon name="chevron-right" class="shrink-0 text-muted" />
        </RouterLink>
      </li>
      <li v-for="number in emptySlots" :key="`empty-${number}`" class="flex items-center gap-4 py-3 sm:py-4 text-muted">
        <span class="w-7 shrink-0 text-right font-serif text-xl sm:text-2xl tabular-nums opacity-60">{{ number }}</span>
        <span>{{ t('Пока не добавлена') }}</span>
      </li>
    </ol>
  </section>
</template>
