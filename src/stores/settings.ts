import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export type ThemeChoice = 'system' | 'light' | 'dark'

export const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'Как в системе' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
]

/** Тот же ключ читает маленький скрипт в index.html, чтобы тема применилась до отрисовки. */
const STORAGE_KEY = 'english-phrases:theme'
const SPEECH_KEY = 'english-phrases:speech'
const VOICE_KEY = 'english-phrases:voice'
const RATE_KEY = 'english-phrases:rate'

/** Скорость речи. Медленнее единицы учебные фразы заметно проще разобрать на слух. */
export const RATE_MIN = 0.6
export const RATE_MAX = 1.2
export const RATE_STEP = 0.1
export const DEFAULT_RATE = 0.9

function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'system' || value === 'light' || value === 'dark'
}

/** localStorage может быть недоступен (приватный режим, запрет хранилища) — тогда тема просто не запомнится. */
function readStoredTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return isThemeChoice(saved) ? saved : 'system'
  } catch {
    return 'system'
  }
}

function readStoredSpeech(): boolean {
  try {
    return localStorage.getItem(SPEECH_KEY) !== 'off'
  } catch {
    return true
  }
}

/** Имя выбранного голоса. Сам голос ищется при озвучке: на другом устройстве его может не быть. */
function readStoredVoice(): string | null {
  try {
    return localStorage.getItem(VOICE_KEY)
  } catch {
    return null
  }
}

function readStoredRate(): number {
  try {
    const saved = Number(localStorage.getItem(RATE_KEY))
    return saved >= RATE_MIN && saved <= RATE_MAX ? saved : DEFAULT_RATE
  } catch {
    return DEFAULT_RATE
  }
}

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

/** Настройки приложения. Пока только тема, дальше сюда же лягут озвучка и темп занятий. */
export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<ThemeChoice>(readStoredTheme())
  const systemDark = ref(darkQuery.matches)

  function syncSystemTheme() {
    systemDark.value = darkQuery.matches
  }

  darkQuery.addEventListener('change', syncSystemTheme)
  // Подстраховка: тему системы могли сменить, пока вкладка была скрыта.
  document.addEventListener('visibilitychange', syncSystemTheme)

  /** Тема, которую видно на экране: «как в системе» превращается в light или dark. */
  const resolvedTheme = computed<'light' | 'dark'>(() =>
    theme.value === 'system' ? (systemDark.value ? 'dark' : 'light') : theme.value,
  )

  // Светлая и тёмная палитры уже описаны в main.css, отсюда только выбирается нужная.
  watch(
    [theme, resolvedTheme],
    ([choice]) => {
      const root = document.documentElement
      if (choice === 'system') root.removeAttribute('data-theme')
      else root.setAttribute('data-theme', choice)

      // Цвет строки браузера на телефоне берём из той же переменной, что и фон страницы.
      const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      if (meta) meta.content = getComputedStyle(root).getPropertyValue('--paper').trim()
    },
    { immediate: true },
  )

  watch(theme, (choice) => {
    try {
      localStorage.setItem(STORAGE_KEY, choice)
    } catch {
      // Не запомнили выбор — приложение всё равно работает.
    }
  })

  /** Автоозвучка карточек в занятии. Кнопку повтора выключение не трогает. */
  const speechEnabled = ref(readStoredSpeech())

  watch(speechEnabled, (enabled) => {
    try {
      localStorage.setItem(SPEECH_KEY, enabled ? 'on' : 'off')
    } catch {
      // Не запомнили выбор — приложение всё равно работает.
    }
  })

  /** Голос и скорость озвучки. null у голоса — «выбрать подходящий самому». */
  const voiceName = ref<string | null>(readStoredVoice())
  const speechRate = ref(readStoredRate())

  watch(voiceName, (name) => {
    try {
      if (name) localStorage.setItem(VOICE_KEY, name)
      else localStorage.removeItem(VOICE_KEY)
    } catch {
      // Не запомнили выбор — приложение всё равно работает.
    }
  })

  watch(speechRate, (rate) => {
    try {
      localStorage.setItem(RATE_KEY, String(rate))
    } catch {
      // Не запомнили выбор — приложение всё равно работает.
    }
  })

  function setTheme(value: ThemeChoice) {
    theme.value = value
  }

  /** Кнопка в шапке: переключает на противоположную тему, выбор при этом становится явным. */
  function toggleTheme() {
    theme.value = resolvedTheme.value === 'dark' ? 'light' : 'dark'
  }

  return { theme, resolvedTheme, speechEnabled, voiceName, speechRate, setTheme, toggleTheme }
})
