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
    // В словарной главе уроков столько, сколько набралось слов: 900 слов — 90 уроков.
    const isWords = chapter.kind === 'words'
    // В главе с глаголами уроки идут по этапам источника, и размер задаёт этап.
    const isVerbs = chapter.kind === 'verbs'

    if (!['phrases', 'expressions', 'words', 'verbs'].includes(chapter.kind)) {
      errors.push(`${where}: неизвестный вид главы «${chapter.kind}», ожидается phrases, expressions, words или verbs.`)
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

    if (chapter.lessons.length !== LESSONS_PER_CHAPTER && !isWords && !isVerbs) {
      const message = `${where}: уроков ${chapter.lessons.length}, ожидается ${LESSONS_PER_CHAPTER}.`
      if (isExpressions) warnings.push(message)
      else errors.push(message)
    }

    // Словарная глава режется на уроки сама, и остаток размазывается по ним:
    // при 872 словах выходит 88 уроков по 9–10 слов. Разница больше одного слова
    // означает, что раскладка сломалась.
    if (isWords && chapter.lessons.length > 1) {
      const sizes = chapter.lessons.map((lesson) => lesson.phrases.length)
      const smallest = Math.min(...sizes)
      const largest = Math.max(...sizes)
      if (largest - smallest > 1) {
        errors.push(`${where}: уроки разного размера — от ${smallest} до ${largest} слов, ожидается разница не больше одного.`)
      }
      if (largest > PHRASES_PER_LESSON) {
        errors.push(`${where}: в уроке ${largest} слов, это больше ${PHRASES_PER_LESSON}.`)
      }
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
      } else if (isVerbs) {
        // Этап режется на равные уроки, но сам этап бывает любого размера.
        if (lesson.phrases.length > PHRASES_PER_LESSON) {
          errors.push(`${lessonWhere}: глаголов ${lesson.phrases.length}, это больше ${PHRASES_PER_LESSON}.`)
        } else if (lesson.phrases.length < MIN_PHRASES_PER_LESSON) {
          warnings.push(`${lessonWhere}: всего ${lesson.phrases.length} — подозрительно мало.`)
        }
      } else if (!isWords && lesson.phrases.length !== PHRASES_PER_LESSON) {
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
        if ((isExpressions || isWords) && !phrase.example) {
          warnings.push(`${lessonWhere}: у ${phrase.id} нет примера употребления.`)
        }
        if (isVerbs && (!phrase.forms?.v2 || !phrase.forms?.v3)) {
          errors.push(`${lessonWhere}: у ${phrase.id} нет второй или третьей формы.`)
        }
        if (isWords && !phrase.pos) {
          warnings.push(`${lessonWhere}: у ${phrase.id} не указана часть речи.`)
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
