import { watchEffect } from 'vue'

const APP_NAME = 'English Phrases'

/** Заголовок вкладки браузера: «Приветствия – English Phrases». */
export function useDocumentTitle(getTitle: () => string | null | undefined) {
  watchEffect(() => {
    const title = getTitle()
    document.title = title ? `${title} – ${APP_NAME}` : APP_NAME
  })
}
