<script setup lang="ts">
import AppIcon from '../AppIcon.vue'
import { useI18n } from '@/i18n'

const { t } = useI18n()

// Кнопка повтора озвучки. Если в системе нет английского голоса, её просто не показываем.
defineProps<{ text: string; speak: (text: string) => void; supported: boolean }>()
</script>

<template>
  <button
    v-if="supported"
    type="button"
    class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-muted hover:text-ink"
    :aria-label="t('Произнести фразу')"
    @click="speak(text)"
  >
    <AppIcon name="speaker" :size="20" />
  </button>
</template>
