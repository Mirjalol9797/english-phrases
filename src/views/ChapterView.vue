<script setup lang="ts">
import { computed } from 'vue'
import { useI18n, nounOf } from '@/i18n'
import { useContentStore } from '@/stores/content'
import { useProgressStore } from '@/stores/progress'
import { useAsyncData } from '@/composables/useAsyncData'
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import StatusMessage from '@/components/StatusMessage.vue'
import AppIcon from '@/components/AppIcon.vue'
import { isLearned } from '@/utils/sm2'

const { plural } = useI18n()

const props = defineProps<{ chapterId: string }>()
const content = useContentStore()
const progress = useProgressStore()

const { data: chapter, loading, error, notFound, reload } = useAsyncData(
  () => props.chapterId,
  () => content.loadChapter(props.chapterId),
)

const phraseCount = computed(() => chapter.value?.lessons.reduce((sum, l) => sum + l.phrases.length, 0) ?? 0)

/** Для каждого урока: сколько фраз уже проходили и сколько дошло до выученных. */
const lessonProgress = computed(() => {
  const rows: Record<string, { started: number; learned: number; total: number }> = {}
  for (const lesson of chapter.value?.lessons ?? []) {
    let started = 0
    let learned = 0
    for (const phrase of lesson.phrases) {
      const entry = progress.get(phrase.id)
      if (entry) started += 1
      if (entry && isLearned(entry)) learned += 1
    }
    rows[lesson.id] = { started, learned, total: lesson.phrases.length }
  }
  return rows
})

const EMPTY_STAT = { started: 0, learned: 0, total: 0 }

function stat(lessonId: string) {
  return lessonProgress.value[lessonId] ?? EMPTY_STAT
}

useDocumentTitle(() => chapter.value?.title.en)
</script>

<template>
  <RouterLink to="/chapters" class="link-back">
    <AppIcon name="chevron-left" :size="18" />
    Все главы
  </RouterLink>

  <StatusMessage v-if="loading || error" :loading="loading" :error="error" :not-found="notFound" @retry="reload" />

  <section v-else-if="chapter">
    <header class="mt-4">
      <h1 lang="en" class="font-serif text-2xl sm:text-[2rem] leading-tight font-semibold">{{ chapter.title.en }}</h1>
      <p class="mt-1 text-lg text-muted">{{ chapter.title.ru }}</p>
      <p class="mt-3 text-sm text-muted">
        {{ plural(chapter.lessons.length, 'lesson') }}, {{ plural(phraseCount, nounOf(chapter.kind)) }}
      </p>
    </header>

    <ol class="mt-4 sm:mt-5 divide-y divide-line border-y border-line">
      <li v-for="lesson in chapter.lessons" :key="lesson.id">
        <RouterLink :to="`/lessons/${lesson.id}`" class="group flex items-center gap-4 py-3 sm:py-4">
          <span class="w-7 shrink-0 text-right font-serif text-lg text-muted tabular-nums">{{ lesson.order }}</span>
          <span class="min-w-0 flex-1">
            <span lang="en" class="block font-serif text-base leading-snug group-hover:underline sm:text-lg">
              {{ lesson.title.en }}
            </span>
            <span class="block text-sm text-muted">{{ lesson.title.ru }}</span>
          </span>
          <!-- Галочка, когда весь урок стал выученным. -->
          <span
            v-if="stat(lesson.id).total > 0 && stat(lesson.id).learned === stat(lesson.id).total"
            class="shrink-0 text-ok"
            title="Урок выучен"
          >
            <AppIcon name="check" :size="18" />
          </span>
          <span
            v-else-if="stat(lesson.id).started"
            class="shrink-0 text-xs text-muted tabular-nums"
            :title="`Пройдено ${stat(lesson.id).started} из ${stat(lesson.id).total}`"
          >
            {{ stat(lesson.id).started }}/{{ stat(lesson.id).total }}
          </span>
          <AppIcon name="chevron-right" class="shrink-0 text-muted" />
        </RouterLink>
      </li>
    </ol>
  </section>
</template>
