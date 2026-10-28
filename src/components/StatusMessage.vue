<script setup lang="ts">
import { useI18n } from '@/i18n'

const { t } = useI18n()
defineProps<{
  loading?: boolean
  error?: string | null
  notFound?: boolean
}>()

defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="loading" class="py-12 text-center text-muted" role="status">{{ t('Загружаем фразы…') }}</div>

  <div v-else-if="notFound" class="py-10">
    <p class="text-lg font-medium">{{ error }}</p>
    <p class="mt-2 text-muted">{{ t('Возможно, ссылка устарела или глава ещё не добавлена.') }}</p>
    <RouterLink to="/chapters" class="btn-quiet mt-4 sm:mt-5">{{ t('Открыть список глав') }}</RouterLink>
  </div>

  <div v-else-if="error" class="py-10" role="alert">
    <p class="text-lg font-medium text-bad">{{ t('Данные не загрузились') }}</p>
    <p class="mt-2 text-muted">
      {{ error }} {{ t('Проверьте, что в папке public/data есть файлы глав (их создаёт команда') }}
      <code class="font-mono text-sm text-ink">yarn data:build</code>){{ t(', и попробуйте ещё раз.') }}
    </p>
    <button type="button" class="btn-quiet mt-4 sm:mt-5" @click="$emit('retry')">{{ t('Загрузить снова') }}</button>
  </div>
</template>
