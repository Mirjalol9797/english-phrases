<script setup lang="ts">
import { useDocumentTitle } from '@/composables/useDocumentTitle'

useDocumentTitle(() => 'Страница не найдена')
</script>

<template>
  <section class="py-10">
    <h1 class="text-xl sm:text-2xl font-semibold">Такой страницы нет</h1>
    <p class="mt-3 text-muted">Проверьте адрес или вернитесь на главную.</p>
    <RouterLink to="/" class="btn-quiet mt-4 sm:mt-5">На главную</RouterLink>
  </section>
</template>
