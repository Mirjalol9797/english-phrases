<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'

/**
 * Полоска про обновление.
 *
 * Приложение работает офлайн, то есть показывает то, что лежит в кэше.
 * Без этой полоски новая версия появлялась бы молча и только со второго
 * запуска, а пользователь гадал бы, почему правок не видно.
 */

/** Как часто проверять обновления, если приложение не закрывают. */
const CHECK_EVERY = 60 * 60 * 1000

const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
  onRegisteredSW(_url, registration) {
    if (!registration) return
    setInterval(() => void registration.update(), CHECK_EVERY)
  },
})

function dismiss() {
  needRefresh.value = false
  offlineReady.value = false
}
</script>

<template>
  <div v-if="needRefresh || offlineReady" class="border-b border-line bg-surface" role="status">
    <div class="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5">
      <template v-if="needRefresh">
        <p class="text-sm">Вышла новая версия.</p>
        <button type="button" class="btn-quiet !min-h-9 text-sm" @click="updateServiceWorker(true)">
          Обновить
        </button>
      </template>
      <p v-else class="text-sm">Приложение готово работать без интернета.</p>

      <button
        type="button"
        class="ml-auto text-sm text-muted underline underline-offset-4 hover:text-ink"
        @click="dismiss"
      >
        {{ needRefresh ? 'Позже' : 'Понятно' }}
      </button>
    </div>
  </div>
</template>
