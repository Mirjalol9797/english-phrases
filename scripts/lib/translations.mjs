import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

/**
 * Узбекский перевод главы: content/translations/<id>.json.
 *
 * Ключ записи — английский текст, часть речи и русский перевод. По ID нельзя:
 * у слов он зависит от перемешивания уроков. Если запись в источнике изменится,
 * ключ не совпадёт — и об этом скажет отчёт сборки, а не тишина.
 */
export const translationKey = (en, pos, ru) => `${en}|${pos ?? ''}|${ru ?? ''}`

export async function loadTranslation(dir, chapterId) {
  const file = path.join(dir, `${chapterId}.json`)
  if (!existsSync(file)) return null
  return { chapterId, ...JSON.parse(await readFile(file, 'utf8')) }
}

/**
 * Прикладывает перевод к собранной главе. Меняет главу на месте.
 *
 * Возвращает отдельно ошибки и предупреждения. Ошибка — опечатка в ключе:
 * перевод молча не применился бы. Предупреждение — глава переведена наполовину:
 * это обычное состояние работы, но в данные такой перевод не попадает.
 *
 * Почему не попадает: в упражнении перемешались бы языки — ответ по-узбекски,
 * неверные варианты по-русски, и ответ стало бы видно по языку.
 */
const CYRILLIC = /[А-Яа-яЁё]/

/**
 * Что проверяем у каждой записи перевода.
 *
 * Кириллица в узбекском — почти наверняка непереведённый кусок: латиница
 * официальная, и смешивать их незачем. Дословное совпадение с русским —
 * признак того, что строку скопировали и забыли перевести.
 */
function checkEntry(entry, where) {
  const problems = []
  const texts = [
    ['перевод', entry.uz, entry.ru],
    ...(entry.examples ?? []).map((example, i) => [`пример ${i + 1}`, example.uz, example.ru]),
  ]

  for (const [what, uz, ru] of texts) {
    if (!uz) continue
    if (CYRILLIC.test(uz)) {
      problems.push(`${where}: у «${entry.en}» в узбекском ${what}е осталась кириллица — «${uz}».`)
    }
    if (ru && uz.trim() === ru.trim()) {
      problems.push(`${where}: у «${entry.en}» узбекский ${what} дословно совпал с русским.`)
    }
  }
  return problems
}

/**
 * Две разные фразы с одинаковым узбекским переводом.
 *
 * В упражнении неверные варианты берутся из той же главы, и два одинаковых
 * варианта сразу видно. По-русски такие пары сборка уже называет — это та же
 * проверка для узбекского. Если фразы и по-русски переведены одинаково,
 * пара уже названа в русском отчёте, и повторять её незачем.
 */
function sameUzDifferentRu(applied, where) {
  const byUz = new Map()
  for (const { entry } of applied) {
    const key = entry.uz.trim().toLowerCase()
    byUz.set(key, [...(byUz.get(key) ?? []), entry])
  }

  const problems = []
  for (const group of byUz.values()) {
    const russians = new Set(group.map((e) => e.ru.trim().toLowerCase()))
    if (group.length > 1 && russians.size > 1) {
      problems.push(
        `${where}: «${group.map((e) => e.en).join('», «')}» переведены на узбекский одинаково ` +
          `(«${group[0].uz}»), хотя по-русски различаются — в упражнении это даст два одинаковых варианта.`,
      )
    }
  }
  return problems
}

export function applyTranslation(chapter, translation) {
  const problems = []
  const warnings = []
  if (!translation) return { problems, warnings }

  const where = `content/translations/${translation.chapterId}.json`
  const entries = new Map()
  for (const entry of translation.entries ?? []) {
    const key = translationKey(entry.en, entry.pos, entry.ru)
    if (entries.has(key)) problems.push(`${where}: «${entry.en}» встречается дважды.`)
    entries.set(key, entry)
  }

  const used = new Set()
  const applied = []
  let total = 0


  for (const lesson of chapter.lessons) {
    for (const phrase of lesson.phrases) {
      total += 1
      const found = entries.get(translationKey(phrase.en, phrase.pos, phrase.ru))
      if (!found) continue
      // Русский текст примера известен только из главы: в файле перевода его нет.
      for (const example of found.examples ?? []) {
        example.ru = (phrase.examples ?? []).find((e) => e.en === example.en)?.ru
      }
      used.add(translationKey(found.en, found.pos, found.ru))
      if (found.uz) applied.push({ phrase, entry: found })
    }
  }

  // Проверяем после сопоставления: русский текст примера берётся из главы.
  for (const entry of entries.values()) problems.push(...checkEntry(entry, where))

  for (const key of entries.keys()) {
    if (!used.has(key)) {
      problems.push(`${where}: «${key.split('|')[0]}» не нашлось среди записей главы.`)
    }
  }

  if (applied.length === 0) return { problems, warnings }

  if (applied.length < total) {
    warnings.push(
      `${where}: переведено ${applied.length} записей из ${total}, перевод пока не взят. ` +
        'Главу нужно переводить целиком, иначе в упражнении перемешаются языки.',
    )
    return { problems, warnings }
  }

  problems.push(...sameUzDifferentRu(applied, where))
  if (problems.length) return { problems, warnings }

  // Глава переведена целиком — только теперь переносим в данные.
  if (translation.title) chapter.title.uz = translation.title
  for (const lesson of chapter.lessons) {
    const lessonUz = (translation.lessons ?? {})[lesson.title.ru]
    if (lessonUz) lesson.title.uz = lessonUz
  }
  for (const { phrase, entry } of applied) {
    phrase.uz = entry.uz
    for (const [i, example] of (phrase.examples ?? []).entries()) {
      const uz = (entry.examples ?? []).find((e) => e.en === example.en)?.uz
      if (uz) phrase.examples[i] = { ...example, uz }
    }
  }

  console.log(`    узбекский перевод: ${applied.length} из ${total}`)
  return { problems, warnings }
}
