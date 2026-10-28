<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from '@/i18n'
import {
  useSettingsStore,
  THEME_OPTIONS,
  RATE_MIN,
  RATE_MAX,
  RATE_STEP,
  DAILY_NEW_OPTIONS,
  STAGE_OPTIONS,
  type ThemeChoice,
} from '@/stores/settings'
import { useProgressStore } from '@/stores/progress'
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import { useSpeech } from '@/composables/useSpeech'
import AppIcon, { type IconName } from '@/components/AppIcon.vue'
import { SESSION_SIZE_OPTIONS } from '@/utils/parts'
import { today } from '@/utils/date'

const { plural } = useI18n()

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

/** На слух не ответить без английского голоса или с выключенным звуком. */
const listeningPossible = computed(() => speech.supported.value && settings.speechEnabled)

/** Последний включённый этап выключить нельзя — об этом стоит сказать прямо. */
const onlyStageLeft = computed(() => settings.enabledStages.length === 1)

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
      : { text: `Восстановлено ${plural(restored, 'phrase')}.` }
}

function reset() {
  progress.reset()
  confirmingReset.value = false
  message.value = { text: 'Прогресс очищен.' }
}
</script>

<template>
  <section>
    <h1 class="text-xl sm:text-2xl font-semibold">Настройки</h1>

    <h2 class="mt-5 sm:mt-6 text-lg font-semibold">Тема</h2>
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
      <h2 class="mt-6 sm:mt-8 text-lg font-semibold">Озвучка</h2>

      <label class="mt-3 block text-sm text-muted" for="voice">Голос</label>
      <select id="voice" v-model="settings.voiceName" class="field mt-1 max-w-sm">
        <option :value="null">Выбрать подходящий автоматически</option>
        <option v-for="item in speech.voices.value" :key="item.name" :value="item.name">
          {{ item.name }} — {{ item.lang }}{{ item.localService ? ', офлайн' : '' }}
        </option>
      </select>

      <label class="mt-4 sm:mt-5 block text-sm text-muted" for="rate">
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

      <label class="mt-4 sm:mt-5 flex max-w-sm cursor-pointer items-center gap-3">
        <input v-model="settings.speechEnabled" type="checkbox" class="h-4 w-4 accent-marker" />
        <span class="text-sm">Проговаривать фразу на карточке сама</span>
      </label>
    </template>

    <h2 class="mt-6 sm:mt-8 text-lg font-semibold">Занятие</h2>
    <p class="mt-1 text-sm text-muted">Сколько записей брать за раз. Длинный урок разобьётся на части.</p>
    <div role="radiogroup" aria-label="Размер занятия" class="mt-3 flex flex-wrap gap-2">
      <label
        v-for="option in SESSION_SIZE_OPTIONS"
        :key="option.value"
        class="theme-option cursor-pointer rounded-full border px-4 py-2.5 text-sm font-medium"
        :class="
          settings.sessionSize === option.value
            ? 'border-transparent bg-marker text-on-marker'
            : 'border-line text-muted hover:text-ink'
        "
      >
        <input v-model="settings.sessionSize" type="radio" name="session-size" :value="option.value" class="sr-only" />
        {{ option.label }}
      </label>
    </div>

    <p class="mt-4 sm:mt-5 text-sm text-muted">Какие этапы проходить</p>
    <ul class="mt-2 grid gap-2">
      <li v-for="option in STAGE_OPTIONS" :key="option.value">
        <label
          class="theme-option flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm"
          :class="settings.isStageEnabled(option.value) ? 'border-muted' : 'border-line text-muted'"
        >
          <input
            type="checkbox"
            class="h-4 w-4 accent-marker"
            :checked="settings.isStageEnabled(option.value)"
            :disabled="onlyStageLeft && settings.isStageEnabled(option.value)"
            @change="settings.toggleStage(option.value)"
          />
          <span class="flex-1">{{ option.label }}</span>
          <span v-if="option.value === 'listen' && !listeningPossible" class="text-xs text-muted">
            нужен английский голос
          </span>
        </label>
      </li>
    </ul>
    <p class="mt-2 text-sm text-muted">
      <template v-if="onlyStageLeft">Последний этап выключить нельзя — в уроке будет нечего делать.</template>
      <template v-else>Выключенные этапы не появятся ни в уроке, ни в повторении.</template>
    </p>

    <p class="mt-4 sm:mt-5 text-sm text-muted">Сколько новых фраз брать в день</p>
    <div role="radiogroup" aria-label="Новых фраз в день" class="mt-2 flex flex-wrap gap-2">
      <label
        v-for="option in DAILY_NEW_OPTIONS"
        :key="option.value"
        class="theme-option cursor-pointer rounded-full border px-4 py-2.5 text-sm font-medium"
        :class="
          settings.dailyNewLimit === option.value
            ? 'border-transparent bg-marker text-on-marker'
            : 'border-line text-muted hover:text-ink'
        "
      >
        <input v-model="settings.dailyNewLimit" type="radio" name="daily-new" :value="option.value" class="sr-only" />
        {{ option.label }}
      </label>
    </div>
    <p class="mt-2 text-sm text-muted">
      Сегодня взято {{ progress.newToday }}. Предел касается только новых записей — повторять
      пройденное можно сколько угодно.
    </p>

    <h2 class="mt-6 sm:mt-8 text-lg font-semibold">Прогресс</h2>
    <p class="mt-3 text-muted">
      <template v-if="progress.startedCount === 0">Занятий ещё не было.</template>
      <template v-else>
        Начато {{ plural(progress.startedCount, 'phrase') }}, выучено {{ progress.learnedCount }}.
      </template>
    </p>
    <p class="mt-1 max-w-prose text-sm text-muted">
      Прогресс хранится только в этом браузере. Очистка данных сайта или другое устройство — и его нет,
      поэтому держите резервную копию.
    </p>

    <div class="mt-4 sm:mt-5 flex flex-wrap gap-3">
      <button type="button" class="btn-quiet" :disabled="progress.startedCount === 0" @click="save">
        Сохранить копию
      </button>
      <button type="button" class="btn-quiet" @click="fileInput?.click()">Восстановить из файла</button>
      <input ref="fileInput" type="file" accept="application/json,.json" class="sr-only" @change="load" />
    </div>

    <div class="mt-4 sm:mt-5">
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

    <p class="mt-6 sm:mt-8 border-t border-line pt-5">
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
