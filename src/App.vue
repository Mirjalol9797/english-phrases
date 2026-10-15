<script setup lang="ts">
import AppNav from '@/components/AppNav.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import UpdateBanner from '@/components/UpdateBanner.vue'
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="app-header">
      <div class="mx-auto flex max-w-3xl items-center justify-between gap-6 px-5 py-2.5 sm:py-3">
        <RouterLink to="/" class="shrink-0 font-serif text-lg font-semibold whitespace-nowrap">English Phrases</RouterLink>
        <div class="flex items-center gap-2">
          <AppNav variant="top" class="hidden md:block" />
          <ThemeToggle />
        </div>
      </div>
    </header>

    <UpdateBanner />

    <main class="app-main mx-auto w-full max-w-3xl flex-1 px-5 pt-3">
      <RouterView />
    </main>

    <AppNav variant="bottom" class="md:hidden" />
  </div>
</template>

<style scoped>
.app-header {
  padding-top: env(safe-area-inset-top, 0px);
}

/* Отступ снизу, чтобы нижняя навигация на телефоне не закрывала контент. */
.app-main {
  padding-bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px));
}

@media (min-width: 48rem) {
  .app-main {
    padding-bottom: 3rem;
  }
}
</style>
