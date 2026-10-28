<script setup lang="ts">
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import { useI18n } from '@/i18n'

const { t } = useI18n()

useDocumentTitle(() => t('Страница не найдена'))
</script>

<template>
  <section class="py-10">
    <h1 class="text-xl sm:text-2xl font-semibold">{{ t('Такой страницы нет') }}</h1>
    <p class="mt-3 text-muted">{{ t('Проверьте адрес или вернитесь на главную.') }}</p>
    <RouterLink to="/" class="btn-quiet mt-4 sm:mt-5">{{ t('На главную') }}</RouterLink>
  </section>
</template>
