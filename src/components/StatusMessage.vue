<script setup lang="ts">
defineProps<{
  loading?: boolean
  error?: string | null
  notFound?: boolean
}>()

defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="loading" class="py-12 text-center text-muted" role="status">Загружаем фразы…</div>

  <div v-else-if="notFound" class="py-10">
    <p class="text-lg font-medium">{{ error }}</p>
    <p class="mt-2 text-muted">Возможно, ссылка устарела или глава ещё не добавлена.</p>
    <RouterLink to="/chapters" class="btn-quiet mt-4 sm:mt-5">Открыть список глав</RouterLink>
  </div>

  <div v-else-if="error" class="py-10" role="alert">
    <p class="text-lg font-medium text-bad">Данные не загрузились</p>
    <p class="mt-2 text-muted">
      {{ error }} Проверьте, что в папке public/data есть файлы глав (их создаёт команда
      <code class="font-mono text-sm text-ink">yarn data:build</code>), и попробуйте ещё раз.
    </p>
    <button type="button" class="btn-quiet mt-4 sm:mt-5" @click="$emit('retry')">Загрузить снова</button>
  </div>
</template>
