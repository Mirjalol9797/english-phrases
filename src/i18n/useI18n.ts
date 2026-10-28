import { useSettingsStore } from '@/stores/settings'
import { pluralize, translate, translationOf, type Noun } from './core'

/**
 * Перевод и склонение на выбранном языке.
 *
 * Обе функции читают язык из настроек прямо при вызове, поэтому шаблон
 * сам перерисовывается при переключении — отдельной подписки не нужно.
 */
export function useI18n() {
  const settings = useSettingsStore()
  return {
    t: (text: string, values?: Record<string, string | number>) =>
      translate(text, settings.language, values),
    plural: (count: number, noun: Noun) => pluralize(count, noun, settings.language),
    /** Перевод записи или названия главы: tr(phrase), tr(chapter.title). */
    tr: (text: { ru: string; uz?: string }) => translationOf(text, settings.language),
  }
}
