<script setup lang="ts">
import { useRoute } from 'vue-router'
import AppIcon, { type IconName } from './AppIcon.vue'
import { useI18n } from '@/i18n'

const { t } = useI18n()

defineProps<{ variant?: 'top' | 'bottom' }>()

interface NavItem {
  to: string
  label: string
  icon: IconName
  /** Пути, при которых пункт считается активным. */
  match: (path: string) => boolean
}

const items: NavItem[] = [
  { to: '/', label: t('Главная'), icon: 'home', match: (p) => p === '/' },
  { to: '/chapters', label: t('Главы'), icon: 'book', match: (p) => p.startsWith('/chapters') || p.startsWith('/lessons') },
  { to: '/review', label: t('Повторение'), icon: 'repeat', match: (p) => p.startsWith('/review') },
  { to: '/phrases', label: t('Словарь'), icon: 'search', match: (p) => p.startsWith('/phrases') },
  { to: '/settings', label: t('Настройки'), icon: 'sliders', match: (p) => p.startsWith('/settings') || p.startsWith('/stats') },
]

const route = useRoute()
</script>

<template>
  <nav
    v-if="variant === 'bottom'"
    :aria-label="t('Основная навигация')"
    class="bottom-nav fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface"
  >
    <ul class="mx-auto grid max-w-3xl grid-cols-5">
      <li v-for="item in items" :key="item.to">
        <RouterLink
          :to="item.to"
          class="flex flex-col items-center gap-1 pt-2 pb-1.5 text-[0.6875rem] font-medium"
          :class="item.match(route.path) ? 'text-ink' : 'text-muted'"
          :aria-current="item.match(route.path) ? 'page' : undefined"
        >
          <span
            class="flex h-7 w-12 items-center justify-center rounded-full"
            :class="item.match(route.path) ? 'bg-marker text-on-marker' : ''"
          >
            <AppIcon :name="item.icon" :size="20" />
          </span>
          {{ item.label }}
        </RouterLink>
      </li>
    </ul>
  </nav>

  <nav v-else :aria-label="t('Основная навигация')">
    <ul class="flex items-center gap-1">
      <li v-for="item in items" :key="item.to">
        <RouterLink
          :to="item.to"
          class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
          :class="item.match(route.path) ? 'bg-marker text-on-marker' : 'text-muted hover:text-ink'"
          :aria-current="item.match(route.path) ? 'page' : undefined"
        >
          <AppIcon :name="item.icon" :size="18" />
          {{ item.label }}
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>
