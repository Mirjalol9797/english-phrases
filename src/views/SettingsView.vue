<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import {
  useSettingsStore,
  THEME_OPTIONS,
  RATE_MIN,
  RATE_MAX,
  RATE_STEP,
  type ThemeChoice,
} from '@/stores/settings'
import { useProgressStore } from '@/stores/progress'
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import { useSpeech } from '@/composables/useSpeech'
import AppIcon, { type IconName } from '@/components/AppIcon.vue'
import { plural, PHRASE_FORMS } from '@/utils/plural'
import { today } from '@/utils/date'

useDocumentTitle(() => 'Настройки')

const settings = useSettingsStore()
const progress = useProgressStore()

const ICONS: Record<ThemeChoice, IconName> = { system: 'display', light: 'sun', dark: 'moon' }

const hint = computed(() =>
  settings.theme === 'system'
    ? `Сейчас ${settings.resolvedTheme === 'dark' ? 'тёмная' : 'светлая'}: так настроены телефон или компьютер.`
    : 'Выбор сохранён в этом браузере и не зависит от настроек системы.',
)

const speech = useSpeech()

/** Пример для кнопки проверки: короткая фраза с характерным ритмом. */
const SAMPLE = 'How are you doing today?'

const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const message = ref<{ text: string; bad?: boolean } | null>(null)
const confirmingReset = ref(false)

function save() {
  const blob = new Blob([progress.exportJson()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `english-phrases-${today()}.json`
  link.click()
  URL.revokeObjectURL(url)
  message.value = { text: 'Файл сохранён в загрузки.' }
}

async function load(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Сбрасываем значение, иначе повторный выбор того же файла не вызовет событие.
  input.value = ''
  if (!file) return

  const restored = progress.importJson(await file.text())
  message.value =
    restored === null
      ? { text: 'Не похоже на резервную копию этого приложения. Прогресс не тронут.', bad: true }
      : { text: `Восстановлено ${plural(restored, PHRASE_FORMS)}.` }
}

function reset() {
  progress.reset()
  confirmingReset.value = false
  message.value = { text: 'Прогресс очищен.' }
}
</script>

<template>
  <section>
    <h1 class="text-2xl font-semibold">Настройки</h1>

    <h2 class="mt-6 text-lg font-semibold">Тема</h2>
    <div role="radiogroup" aria-label="Тема оформления" class="mt-3 flex flex-wrap gap-2">
      <label
        v-for="option in THEME_OPTIONS"
        :key="option.value"
        class="theme-option flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium"
        :class="
          settings.theme === option.value
            ? 'border-transparent bg-marker text-on-marker'
            : 'border-line text-muted hover:text-ink'
        "
      >
        <input v-model="settings.theme" type="radio" name="theme" :value="option.value" class="sr-only" />
        <AppIcon :name="ICONS[option.value]" :size="18" />
        {{ option.label }}
      </label>
    </div>
    <p class="mt-3 text-sm text-muted">{{ hint }}</p>

    <!-- Раздела нет, если в системе не нашлось ни одного английского голоса. -->
    <template v-if="speech.supported.value">
      <h2 class="mt-8 text-lg font-semibold">Озвучка</h2>

      <label class="mt-3 block text-sm text-muted" for="voice">Голос</label>
      <select id="voice" v-model="settings.voiceName" class="field mt-1 max-w-sm">
        <option :value="null">Выбрать подходящий автоматически</option>
        <option v-for="item in speech.voices.value" :key="item.name" :value="item.name">
          {{ item.name }} — {{ item.lang }}{{ item.localService ? ', офлайн' : '' }}
        </option>
      </select>

      <label class="mt-5 block text-sm text-muted" for="rate">
        Скорость речи — {{ settings.speechRate.toFixed(1) }}
      </label>
      <input
        id="rate"
        v-model.number="settings.speechRate"
        type="range"
        :min="RATE_MIN"
        :max="RATE_MAX"
        :step="RATE_STEP"
        class="mt-2 w-full max-w-sm accent-marker"
      />
      <div class="flex max-w-sm justify-between text-xs text-muted">
        <span>медленнее</span>
        <span>обычно</span>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" class="btn-quiet" @click="speech.speak(SAMPLE)">
          <AppIcon name="speaker" :size="18" />
          Проверить
        </button>
        <p lang="en" class="font-serif text-sm text-muted">{{ SAMPLE }}</p>
      </div>

      <label class="mt-5 flex max-w-sm cursor-pointer items-center gap-3">
        <input v-model="settings.speechEnabled" type="checkbox" class="h-4 w-4 accent-marker" />
        <span class="text-sm">Проговаривать фразу на карточке сама</span>
      </label>
    </template>

    <h2 class="mt-8 text-lg font-semibold">Прогресс</h2>
    <p class="mt-3 text-muted">
      <template v-if="progress.startedCount === 0">Занятий ещё не было.</template>
      <template v-else>
        Начато {{ plural(progress.startedCount, PHRASE_FORMS) }}, выучено {{ progress.learnedCount }}.
      </template>
    </p>
    <p class="mt-1 max-w-prose text-sm text-muted">
      Прогресс хранится только в этом браузере. Очистка данных сайта или другое устройство — и его нет,
      поэтому держите резервную копию.
    </p>

    <div class="mt-5 flex flex-wrap gap-3">
      <button type="button" class="btn-quiet" :disabled="progress.startedCount === 0" @click="save">
        Сохранить копию
      </button>
      <button type="button" class="btn-quiet" @click="fileInput?.click()">Восстановить из файла</button>
      <input ref="fileInput" type="file" accept="application/json,.json" class="sr-only" @change="load" />
    </div>

    <div class="mt-5">
      <button
        v-if="!confirmingReset"
        type="button"
        class="text-sm text-muted underline underline-offset-4 hover:text-bad"
        :disabled="progress.startedCount === 0"
        @click="confirmingReset = true"
      >
        Очистить прогресс
      </button>
      <div v-else class="flex flex-wrap items-center gap-3">
        <p class="text-sm text-bad">Удалить весь прогресс без возможности вернуть?</p>
        <button type="button" class="btn-quiet" @click="reset">Удалить</button>
        <button type="button" class="btn-quiet" @click="confirmingReset = false">Отмена</button>
      </div>
    </div>

    <p v-if="message" class="mt-4 text-sm" :class="message.bad ? 'text-bad' : 'text-muted'" role="status">
      {{ message.text }}
    </p>

    <p class="mt-8 border-t border-line pt-5">
      <RouterLink to="/stats" class="text-accent underline underline-offset-4">Статистика</RouterLink>
    </p>
  </section>
</template>

<style scoped>
/* Сам радиопереключатель скрыт, поэтому рамку фокуса рисуем на подписи. */
.theme-option:has(:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
</style>
