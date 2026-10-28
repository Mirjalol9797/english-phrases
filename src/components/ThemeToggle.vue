<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import AppIcon from './AppIcon.vue'
import { useI18n } from '@/i18n'

const { t } = useI18n()

// Иконка показывает тему, на которую переключит нажатие.
const settings = useSettingsStore()

const next = computed(() => (settings.resolvedTheme === 'dark' ? 'light' : 'dark'))
const label = computed(() => (next.value === 'dark' ? t('Включить тёмную тему') : t('Включить светлую тему')))
</script>

<template>
  <button
    type="button"
    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-muted hover:text-ink"
    :title="label"
    :aria-label="label"
    @click="settings.toggleTheme()"
  >
    <AppIcon :name="next === 'dark' ? 'moon' : 'sun'" :size="19" />
  </button>
</template>
