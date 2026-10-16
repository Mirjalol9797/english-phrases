<script setup lang="ts">
import { computed } from 'vue'
import { useContentStore } from '@/stores/content'
import { useProgressStore } from '@/stores/progress'
import { useSettingsStore } from '@/stores/settings'
import { useAsyncData } from '@/composables/useAsyncData'
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import StatusMessage from '@/components/StatusMessage.vue'
import PhraseItem from '@/components/PhraseItem.vue'
import AppIcon from '@/components/AppIcon.vue'
import { plural, itemForms } from '@/utils/plural'
import { isPartStarted, nextPartIndex, splitIntoParts } from '@/utils/parts'

const props = defineProps<{ lessonId: string }>()
const content = useContentStore()
const progress = useProgressStore()
const settings = useSettingsStore()

const { data: ctx, loading, error, notFound, reload } = useAsyncData(
  () => props.lessonId,
  () => content.loadLesson(props.lessonId),
)

const started = (phrase: { id: string }) => progress.isStarted(phrase.id)

/** Сколько новых фраз в части, которую собираемся проходить. */
const newInPart = computed(() => (parts.value[nextPart.value] ?? []).filter((p) => progress.isNew(p.id)).length)

const newLeft = computed(() => progress.newLeftToday(settings.dailyNewLimit))

/** Предел не трогает повторение пройденного — только новые записи. */
const blockedByLimit = computed(() => newInPart.value > 0 && newLeft.value <= 0)

/** Урок, разбитый на части по размеру занятия из настроек. */
const parts = computed(() => splitIntoParts(ctx.value?.lesson.phrases ?? [], settings.sessionSize))

const split = computed(() => parts.value.length > 1)

/** Часть, с которой продолжать: первая, где остались нетронутые записи. */
const nextPart = computed(() => nextPartIndex(parts.value, started))

function practiceLink(index: number) {
  const base = `/lessons/${props.lessonId}/practice`
  return split.value ? `${base}?part=${index + 1}` : base
}

useDocumentTitle(() => ctx.value?.lesson.title.ru)
</script>

<template>
  <RouterLink v-if="ctx" :to="`/chapters/${ctx.chapter.id}`" class="link-back">
    <AppIcon name="chevron-left" :size="18" />
    <span lang="en">{{ ctx.chapter.title.en }}</span>
  </RouterLink>
  <RouterLink v-else to="/chapters" class="link-back">
    <AppIcon name="chevron-left" :size="18" />
    Все главы
  </RouterLink>

  <StatusMessage v-if="loading || error" :loading="loading" :error="error" :not-found="notFound" @retry="reload" />

  <article v-else-if="ctx">
    <header class="mt-4">
      <p class="text-sm text-muted">Урок {{ ctx.lesson.order }} из {{ ctx.chapter.lessons.length }}</p>
      <h1 lang="en" class="mt-1 font-serif text-2xl sm:text-[2rem] leading-tight font-semibold">
        <span class="marker">{{ ctx.lesson.title.en }}</span>
      </h1>
      <p class="mt-1 text-lg text-muted">{{ ctx.lesson.title.ru }}</p>
    </header>

    <div class="mt-4 sm:mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
      <RouterLink v-if="!blockedByLimit" :to="practiceLink(nextPart)" class="btn-primary">
        {{ split ? `Часть ${nextPart + 1} из ${parts.length}` : 'Начать урок' }}
      </RouterLink>
      <button v-else type="button" class="btn-primary" disabled>
        {{ split ? `Часть ${nextPart + 1} из ${parts.length}` : 'Начать урок' }}
      </button>
      <p class="text-sm text-muted">
        {{ plural(parts[nextPart]?.length ?? 0, itemForms(ctx.chapter.kind)) }}: карточки и четыре этапа.
      </p>
    </div>

    <!-- Дневной предел новых фраз. Пройденное повторять можно всегда. -->
    <p v-if="blockedByLimit" class="mt-3 max-w-prose text-sm text-muted">
      На сегодня новых фраз хватит — взяли {{ progress.newToday }} из {{ settings.dailyNewLimit }}.
      Так материал успевает улечься.
      <RouterLink to="/review" class="text-accent underline underline-offset-4">Повторить пройденное</RouterLink>
      или изменить предел в
      <RouterLink to="/settings" class="text-accent underline underline-offset-4">настройках</RouterLink>.
    </p>
    <p v-else-if="newInPart > 0 && settings.dailyNewLimit > 0" class="mt-3 text-sm text-muted">
      Новых сегодня: {{ progress.newToday }} из {{ settings.dailyNewLimit }}.
    </p>

    <!-- Выбор части. Нужен, только если урок длиннее размера занятия. -->
    <ul v-if="split" class="mt-4 flex flex-wrap gap-2">
      <li v-for="(part, index) in parts" :key="index">
        <RouterLink
          :to="practiceLink(index)"
          class="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm"
          :class="
            index === nextPart
              ? 'border-transparent bg-marker text-on-marker'
              : 'border-line text-muted hover:text-ink'
          "
        >
          Часть {{ index + 1 }}
          <span class="tabular-nums opacity-70">{{ part.length }}</span>
          <AppIcon v-if="isPartStarted(part, started)" name="check" :size="15" class="text-ok" />
        </RouterLink>
      </li>
    </ul>

    <ol class="mt-5 sm:mt-6 divide-y divide-line border-y border-line">
      <PhraseItem v-for="phrase in ctx.lesson.phrases" :key="phrase.id" :phrase="phrase" />
    </ol>

    <nav aria-label="Соседние уроки" class="mt-5 sm:mt-6 grid gap-3 sm:grid-cols-2">
      <RouterLink
        v-if="ctx.previous"
        :to="`/lessons/${ctx.previous.id}`"
        class="rounded-xl border border-line px-4 py-3 hover:border-muted"
      >
        <span class="block text-sm text-muted">Предыдущий урок</span>
        <span lang="en" class="block font-serif text-lg">{{ ctx.previous.title.en }}</span>
      </RouterLink>
      <RouterLink
        v-if="ctx.next"
        :to="`/lessons/${ctx.next.id}`"
        class="rounded-xl border border-line px-4 py-3 text-right hover:border-muted sm:col-start-2"
      >
        <span class="block text-sm text-muted">Следующий урок</span>
        <span lang="en" class="block font-serif text-lg">{{ ctx.next.title.en }}</span>
      </RouterLink>
    </nav>
  </article>
</template>
