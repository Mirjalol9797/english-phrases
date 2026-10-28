<script setup lang="ts">
import { useI18n } from '@/i18n'

const { t } = useI18n()
// Временная заглушка для экранов, которые появятся на следующих этапах разработки.
defineProps<{
  title: string
  stage: number
  description: string
}>()
</script>

<template>
  <section>
    <h1 class="text-xl sm:text-2xl font-semibold">{{ title }}</h1>
    <p class="mt-3 max-w-prose text-muted">{{ description }}</p>
    <p class="mt-4 sm:mt-5 inline-block rounded-md border border-dashed border-line px-3 py-2 text-sm text-muted">
      {{ t('Экран появится на этапе') }} {{ stage }}.
    </p>
    <div class="mt-5 sm:mt-6">
      <RouterLink to="/chapters" class="btn-quiet">{{ t('Перейти к главам') }}</RouterLink>
    </div>
  </section>
</template>
