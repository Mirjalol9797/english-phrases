// Общая проверка данных глав. Используется и при конвертации, и в validate-data.mjs.

export const LESSONS_PER_CHAPTER = 20
export const PHRASES_PER_LESSON = 10

/**
 * Формат ID фразы: префикс заглавными и три цифры — EE001, GET001, PRE_IN001.
 * Подчёркивание нужно составным категориям вроде «in front of».
 */
export const PHRASE_ID = /^[A-Z][A-Z_]*\d{3}$/

/** Префикс из ID: по нему глава узнаётся при загрузке урока. */
export function prefixOf(id) {
  return String(id).match(/^([A-Z][A-Z_]*)\d{3}$/)?.[1] ?? ''
}

/**
 * Урок меньше этого размера, скорее всего, собрался неправильно.
 * Порог низкий намеренно: у предлогов вроде among или above
 * ходовых выражений честно набирается пять.
 */
export const MIN_PHRASES_PER_LESSON = 5

/**
 * @param {Array<object>} chapters  полные данные глав (с уроками и фразами)
 * @param {{ plannedChapters: number }} options
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateChapters(chapters, { plannedChapters }) {
  const errors = []
  const warnings = []

  if (chapters.length > plannedChapters) {
    errors.push(`Глав ${chapters.length}, а запланировано ${plannedChapters}. Увеличьте plannedChapters в content/chapters.config.json.`)
  }

  const seenChapterIds = new Set()
  const seenPrefixes = new Set()
  const seenOrders = new Set()
  const seenPhraseIds = new Map() // id -> chapter id
  const englishIndex = new Map() // нормализованный EN -> [id]

  for (const chapter of chapters) {
    const where = `Глава «${chapter.title?.en ?? chapter.id}»`
    // Глава с выражениями собрана из категорий источника, поэтому правила к ней мягче.
    const isExpressions = chapter.kind === 'expressions'

    if (chapter.kind !== 'phrases' && chapter.kind !== 'expressions') {
      errors.push(`${where}: неизвестный вид главы «${chapter.kind}», ожидается phrases или expressions.`)
    }

    if (seenChapterIds.has(chapter.id)) errors.push(`${where}: id «${chapter.id}» повторяется.`)
    seenChapterIds.add(chapter.id)

    if (seenPrefixes.has(chapter.prefix)) {
      errors.push(`${where}: префикс ID «${chapter.prefix}» уже используется другой главой. У каждой главы должен быть свой префикс.`)
    }
    seenPrefixes.add(chapter.prefix)

    if (seenOrders.has(chapter.order)) errors.push(`${where}: порядковый номер ${chapter.order} повторяется.`)
    seenOrders.add(chapter.order)

    if (!chapter.title?.en || !chapter.title?.ru) errors.push(`${where}: нет названия на английском или русском.`)

    if (chapter.lessons.length !== LESSONS_PER_CHAPTER) {
      const message = `${where}: уроков ${chapter.lessons.length}, ожидается ${LESSONS_PER_CHAPTER}.`
      if (isExpressions) warnings.push(message)
      else errors.push(message)
    }

    const ruIndex = new Map()
    const seenLessonPrefixes = new Map() // префикс урока -> номер урока
    let expectedNumber = 1

    chapter.lessons.forEach((lesson, lessonIndex) => {
      const lessonWhere = `${where}, урок ${lessonIndex + 1}`

      if (lesson.order !== lessonIndex + 1) {
        errors.push(`${lessonWhere}: номер темы ${lesson.order}, ожидается ${lessonIndex + 1}.`)
      }
      if (!lesson.title?.en || !lesson.title?.ru) errors.push(`${lessonWhere}: нет названия темы.`)

      if (lesson.phrases.length === 0) {
        errors.push(`${lessonWhere}: нет ни одной фразы.`)
      } else if (isExpressions) {
        // Размер урока задаёт сам источник: сколько выражений у глагола, столько и будет.
        if (lesson.phrases.length < MIN_PHRASES_PER_LESSON) {
          warnings.push(`${lessonWhere}: всего ${lesson.phrases.length} — подозрительно мало, ожидается хотя бы ${MIN_PHRASES_PER_LESSON}.`)
        }
      } else if (lesson.phrases.length !== PHRASES_PER_LESSON) {
        errors.push(`${lessonWhere}: фраз ${lesson.phrases.length}, ожидается ${PHRASES_PER_LESSON}.`)
      }

      // В главе с выражениями нумерация своя в каждом уроке: GET001…, TAKE001…
      let lessonPrefix = chapter.prefix
      if (isExpressions) {
        lessonPrefix = prefixOf(lesson.phrases[0]?.id)
        expectedNumber = 1
        if (!lessonPrefix) {
          errors.push(`${lessonWhere}: не удалось определить префикс ID по первой фразе.`)
        } else if (seenLessonPrefixes.has(lessonPrefix)) {
          errors.push(
            `${lessonWhere}: префикс ID «${lessonPrefix}» уже у урока ${seenLessonPrefixes.get(lessonPrefix)}.`,
          )
        }
        seenLessonPrefixes.set(lessonPrefix, lessonIndex + 1)
      }

      for (const phrase of lesson.phrases) {
        const expectedId = `${lessonPrefix}${String(expectedNumber).padStart(3, '0')}`
        if (phrase.id !== expectedId) {
          errors.push(`${lessonWhere}: ID ${phrase.id}, ожидается ${expectedId} (номера должны идти подряд).`)
        }
        expectedNumber += 1

        if (seenPhraseIds.has(phrase.id)) {
          errors.push(`${lessonWhere}: ID ${phrase.id} уже есть в главе «${seenPhraseIds.get(phrase.id)}».`)
        }
        seenPhraseIds.set(phrase.id, chapter.id)

        if (!phrase.en) errors.push(`${lessonWhere}: у ${phrase.id} пустая английская фраза.`)
        if (!phrase.ru) errors.push(`${lessonWhere}: у ${phrase.id} пустой перевод.`)
        if (phrase.example && (!phrase.example.en || !phrase.example.ru)) {
          errors.push(`${lessonWhere}: у ${phrase.id} пример есть только на одном языке.`)
        }
        if (isExpressions && !phrase.example) {
          warnings.push(`${lessonWhere}: у ${phrase.id} нет примера употребления.`)
        }

        const ruKey = phrase.ru.toLowerCase()
        ruIndex.set(ruKey, [...(ruIndex.get(ruKey) ?? []), phrase.id])

        const enKey = normalizeEnglish(phrase.en)
        englishIndex.set(enKey, [...(englishIndex.get(enKey) ?? []), phrase.id])
      }
    })

    for (const [ru, ids] of ruIndex) {
      if (ids.length > 1) {
        warnings.push(`${where}: одинаковый перевод «${ru}» у ${ids.join(', ')}. В тестах RU → EN эти фразы не должны быть неправильными вариантами друг для друга.`)
      }
    }
  }

  for (const [en, ids] of englishIndex) {
    if (ids.length > 1) {
      warnings.push(`Фраза «${en}» встречается несколько раз: ${ids.join(', ')}.`)
    }
  }

  return { errors, warnings }
}

export function normalizeEnglish(text) {
  return text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[.!?,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function printReport({ errors, warnings }) {
  for (const warning of warnings) console.warn(`  ! ${warning}`)
  for (const error of errors) console.error(`  ✗ ${error}`)
  if (errors.length === 0) console.log(`  ✓ Ошибок нет${warnings.length ? `, предупреждений: ${warnings.length}` : ''}.`)
}
