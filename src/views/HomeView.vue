<script setup lang="ts">
import { computed } from 'vue'
import { useContentStore } from '@/stores/content'
import { useProgressStore } from '@/stores/progress'
import { useSettingsStore } from '@/stores/settings'
import { useAsyncData } from '@/composables/useAsyncData'
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import StatusMessage from '@/components/StatusMessage.vue'
import { plural, itemForms, PHRASE_FORMS } from '@/utils/plural'

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
      chapter?.lessons.find((lesson) => lesson.phrases.some((phrase) => progress.boxOf(phrase.id) === 0)) ??
      chapter?.lessons[0] ??
      null
    return { index, nextLesson }
  },
)

const featured = computed(() => data.value?.nextLesson?.phrases.find((p) => progress.boxOf(p.id) === 0) ?? data.value?.nextLesson?.phrases[0] ?? null)

const dueCount = computed(() => progress.dueIds().length)

const DAY_FORMS: [string, string, string] = ['день', 'дня', 'дней']
</script>

<template>
  <StatusMessage v-if="loading || error" :loading="loading" :error="error" @retry="reload" />

  <template v-else-if="data">
    <!-- Сводка прогресса. Показываем, только когда уже есть что показывать. -->
    <div v-if="progress.startedCount > 0" class="flex flex-wrap items-center gap-x-5 gap-y-1 pb-6 text-sm">
      <span v-if="progress.streak > 0">
        Серия <span class="font-medium">{{ plural(progress.streak, DAY_FORMS) }}</span>
      </span>
      <span class="text-muted">Выучено {{ progress.learnedCount }} из {{ progress.startedCount }}</span>
      <span v-if="settings.dailyNewLimit > 0" class="text-muted">
        Новых сегодня {{ progress.newToday }} из {{ settings.dailyNewLimit }}
      </span>
      <RouterLink v-if="dueCount" to="/review" class="text-accent underline underline-offset-4">
        Повторить {{ plural(dueCount, PHRASE_FORMS) }}
      </RouterLink>
    </div>

    <section v-if="data.nextLesson && featured" class="pb-10">
      <p class="text-muted">Первая фраза урока «{{ data.nextLesson.title.ru }}»</p>
      <p lang="en" class="mt-4 font-serif text-[clamp(1.875rem,9vw,3.25rem)] leading-[1.15] font-semibold">
        <span class="marker">{{ featured.en }}</span>
      </p>
      <p class="mt-3 text-lg text-muted">{{ featured.ru }}</p>
      <div class="mt-5 sm:mt-6">
        <RouterLink :to="`/lessons/${data.nextLesson.id}`" class="btn-primary">
          Открыть урок {{ data.nextLesson.order }}
        </RouterLink>
      </div>
    </section>

    <section v-else class="pb-10">
      <h1 class="text-xl sm:text-2xl font-semibold">Глав пока нет</h1>
      <p class="mt-3 max-w-prose text-muted">
        Положите Word-файлы с фразами в папку content/source и выполните
        <code class="font-mono text-sm text-ink">yarn data:build</code>.
      </p>
    </section>

    <section v-if="data.index.chapters.length" class="border-t border-line pt-6">
      <div class="flex items-baseline justify-between gap-4">
        <h2 class="text-lg font-semibold">Главы</h2>
        <p class="text-sm text-muted">
          Добавлено {{ data.index.chapters.length }} из {{ data.index.plannedChapters }}
        </p>
      </div>
      <ul class="mt-2 divide-y divide-line">
        <li v-for="chapter in data.index.chapters" :key="chapter.id">
          <RouterLink :to="`/chapters/${chapter.id}`" class="group flex items-baseline gap-4 py-3 sm:py-4">
            <span class="w-6 shrink-0 font-serif text-lg text-muted tabular-nums">{{ chapter.order }}</span>
            <span class="min-w-0 flex-1">
              <span lang="en" class="block font-serif text-lg leading-snug group-hover:underline">
                {{ chapter.title.en }}
              </span>
              <span class="block text-sm text-muted">{{ chapter.title.ru }}</span>
            </span>
            <span class="shrink-0 text-sm text-muted">{{ plural(chapter.phraseCount, itemForms(chapter.kind)) }}</span>
          </RouterLink>
        </li>
      </ul>
    </section>
  </template>
</template>
