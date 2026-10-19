<script setup lang="ts">
import { computed, ref, useTemplateRef, onMounted } from 'vue'
import type { FormsStep } from '@/types/practice'
import { isSameAnswer } from '@/utils/answer'

// Главное в неправильном глаголе — не перевод, а три формы. Здесь показана
// первая и перевод, а вторую и третью нужно вспомнить самому.
const props = defineProps<{ step: FormsStep }>()
const emit = defineEmits<{ answer: [correct: boolean] }>()

const past = ref('')
const participle = ref('')
const checked = ref(false)

// Фокус сразу в первое поле: иначе на компьютере приходится тянуться к мыши.
const field = useTemplateRef<HTMLInputElement>('field')
onMounted(() => field.value?.focus())

const matches = (value: string, accept: string[]) => accept.some((variant) => isSameAnswer(value, variant))

const pastOk = computed(() => matches(past.value, props.step.accept.v2))
const participleOk = computed(() => matches(participle.value, props.step.accept.v3))
const correct = computed(() => pastOk.value && participleOk.value)

const filled = computed(() => Boolean(past.value.trim() && participle.value.trim()))

/** Как форма записана в главе: с вариантами через слэш, если они есть. */
const written = computed(() => props.step.phrase.forms ?? { v2: '', v3: '' })

function stateClass(ok: boolean) {
  if (!checked.value) return ''
  return ok ? 'option-correct' : 'option-wrong'
}

function check() {
  if (checked.value || !filled.value) return
  checked.value = true
  emit('answer', correct.value)
}
</script>

<template>
  <div>
    <p class="text-sm text-muted">Напишите вторую и третью формы</p>

    <p lang="en" class="mt-3 font-serif text-[clamp(1.5rem,6vw,2.5rem)] leading-tight font-semibold">
      <span class="marker">{{ step.phrase.en }}</span>
    </p>
    <p class="mt-1 text-muted">{{ step.phrase.ru }}</p>

    <form class="mt-4 sm:mt-5 grid gap-3 sm:grid-cols-2" @submit.prevent="check">
      <label class="block">
        <span class="block text-sm text-muted">Past Simple</span>
        <input
          ref="field"
          v-model="past"
          type="text"
          lang="en"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :readonly="checked"
          class="field mt-1 font-serif text-lg"
          :class="stateClass(pastOk)"
        />
      </label>

      <label class="block">
        <span class="block text-sm text-muted">Past Participle</span>
        <input
          v-model="participle"
          type="text"
          lang="en"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :readonly="checked"
          class="field mt-1 font-serif text-lg"
          :class="stateClass(participleOk)"
        />
      </label>

      <button v-if="!checked" type="submit" class="btn-primary sm:col-span-2 justify-self-start" :disabled="!filled">
        Проверить
      </button>
    </form>

    <!-- Показываем обе формы целиком: ошиблись в одной — вторую тоже полезно увидеть. -->
    <template v-if="checked && !correct">
      <p class="mt-4 sm:mt-5 text-sm text-muted">Правильно</p>
      <p lang="en" class="mt-1 font-serif text-lg">
        <span class="marker font-semibold">{{ step.phrase.en }}</span>
        — <span :class="pastOk ? '' : 'marker font-semibold'">{{ written.v2 }}</span>
        — <span :class="participleOk ? '' : 'marker font-semibold'">{{ written.v3 }}</span>
      </p>
    </template>

    <!-- Ответ верный, но записан иначе: ввели got, а в главе got/gotten. -->
    <p
      v-else-if="checked && (past.trim() !== written.v2 || participle.trim() !== written.v3)"
      class="mt-4 sm:mt-5 text-sm text-muted"
    >
      В главе записано так:
      <span lang="en" class="font-serif">{{ step.phrase.en }} — {{ written.v2 }} — {{ written.v3 }}</span>
    </p>
  </div>
</template>
