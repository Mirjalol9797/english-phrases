import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Горячие клавиши занятия. Слушаем окно, а не элемент: в упражнениях
 * фокус гуляет между кнопками, и завязываться на него ненадёжно.
 */
export function useWindowKey(handler: (event: KeyboardEvent) => void) {
  function onKeydown(event: KeyboardEvent) {
    // Сочетания с модификаторами — это команды браузера, не наши.
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
    handler(event)
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}

/** Печатают ответ — значит, клавиша предназначена полю, а не нам. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element) return false
  return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable
}

/**
 * Есть ли у устройства точный указатель. По нему решаем, показывать ли
 * подсказку про клавиши: на телефоне она бессмысленна.
 */
export function useHasKeyboard() {
  const hasKeyboard = ref(false)
  onMounted(() => {
    hasKeyboard.value = window.matchMedia('(pointer: fine)').matches
  })
  return hasKeyboard
}
