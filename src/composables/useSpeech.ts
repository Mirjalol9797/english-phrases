import { computed, onMounted, ref, shallowRef } from 'vue'
import { useSettingsStore } from '@/stores/settings'

/**
 * Озвучка через встроенный в браузер speechSynthesis: отдельных аудиофайлов нет,
 * говорит голос, установленный в системе. Набор голосов зависит от устройства,
 * поэтому поддержка проверяется каждый раз, а не считается данностью.
 */
const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined

const allVoices = shallowRef<SpeechSynthesisVoice[]>([])
let listening = false

function loadVoices() {
  if (!synth) return
  allVoices.value = synth.getVoices()
  if (!listening) {
    // Первый getVoices() часто возвращает пустой список: голоса подгружаются позже.
    synth.addEventListener('voiceschanged', () => {
      allVoices.value = synth.getVoices()
    })
    listening = true
  }
}

/** Голос по умолчанию: системный без интернета и ближе к американскому произношению. */
function pickDefault(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null
  return (
    voices.find((v) => v.localService && v.lang.toLowerCase() === 'en-us') ??
    voices.find((v) => v.lang.toLowerCase() === 'en-us') ??
    voices.find((v) => v.localService) ??
    voices[0]!
  )
}

export function useSpeech() {
  const settings = useSettingsStore()
  const speaking = ref(false)

  onMounted(loadVoices)

  /** Только английские голоса: остальные прочитают фразу как набор букв. */
  const voices = computed(() => allVoices.value.filter((v) => v.lang.toLowerCase().startsWith('en')))

  const voice = computed(() => {
    const chosen = settings.voiceName ? voices.value.find((v) => v.name === settings.voiceName) : null
    // Выбранного голоса может не быть на другом устройстве — тогда берём подходящий сами.
    return chosen ?? pickDefault(voices.value)
  })

  const supported = computed(() => Boolean(synth) && voice.value !== null)

  function speak(text: string) {
    if (!synth || !voice.value || !text) return
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voice.value
    utterance.lang = voice.value.lang
    utterance.rate = settings.speechRate
    utterance.onstart = () => (speaking.value = true)
    utterance.onend = () => (speaking.value = false)
    utterance.onerror = () => (speaking.value = false)
    synth.speak(utterance)
  }

  function stop() {
    synth?.cancel()
    speaking.value = false
  }

  return { supported, speaking, voices, voice, speak, stop }
}
