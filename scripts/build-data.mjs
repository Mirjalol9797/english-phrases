// Собирает JSON для приложения из источников в content/source.
//
//   yarn data:build
//
// Каждый файл — одна глава. Поддерживаются три формата источника:
//   lessons    (по умолчанию, .docx) — заголовки «N. English — Русский» задают уроки,
//               таблица под заголовком содержит фразы (ID | English phrase | Перевод);
//   categories (.docx) — одна таблица на весь документ
//               (id | category | phrase_en | phrase_ru | example_en | example_ru),
//               каждая категория становится отдельным уроком;
//   words      (.pdf) — словарный уровень Oxford 3000: таблица
//               «☐ | слово | часть речи | перевод | пример», уроки собираются сами.
// Порядок, id и формат глав задаются в content/chapters.config.json.

import { readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mammoth from 'mammoth'
import { parse } from 'node-html-parser'
import { PHRASE_ID, PHRASES_PER_LESSON, prefixOf, validateChapters, printReport } from './lib/validate.mjs'
import { parseWordsPdf, buildWordLessons } from './lib/words-pdf.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = path.join(root, 'content', 'source')
const configPath = path.join(root, 'content', 'chapters.config.json')
const outDir = path.join(root, 'public', 'data')
const chaptersOutDir = path.join(outDir, 'chapters')

const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with'])

function cleanText(text) {
  return text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

function cleanEnglish(text) {
  return cleanText(text).replace(/[’‘]/g, "'")
}

function titleCase(text) {
  return text
    .toLowerCase()
    .split(' ')
    .map((word, i) => (i > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ')
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function parseChapterDocx(filePath) {
  const { value: html } = await mammoth.convertToHtml({ path: filePath })
  const doc = parse(html)
  const problems = []

  let titleEn = ''
  let titleRu = ''
  let currentLesson = null
  const lessons = []

  for (const node of doc.childNodes) {
    if (node.nodeType !== 1) continue
    const tag = node.tagName.toLowerCase()

    if (tag === 'p' && lessons.length === 0) {
      const text = cleanText(node.text)
      const strong = node.querySelector('strong')
      const em = node.querySelector('em')
      if (!titleEn && strong && cleanText(strong.text) === text) titleEn = titleCase(text)
      else if (!titleRu && em) titleRu = cleanText(em.text).split(/\s+[—–]\s+/)[0]
      continue
    }

    if (tag === 'h1') {
      const heading = cleanText(node.text)
      const match = heading.match(/^(\d+)\.\s*(.+?)\s+[—–]\s+(.+)$/)
      if (!match) {
        problems.push(`Заголовок «${heading}» не в формате «N. English — Русский».`)
        currentLesson = null
        continue
      }
      currentLesson = {
        order: Number(match[1]),
        title: { en: cleanEnglish(match[2]), ru: match[3] },
        phrases: [],
      }
      lessons.push(currentLesson)
      continue
    }

    if (tag === 'table' && currentLesson) {
      for (const row of node.querySelectorAll('tr')) {
        const cells = row.querySelectorAll('td, th').map((cell) => cleanText(cell.text))
        if (cells.length < 3 || cells[0].toUpperCase() === 'ID') continue
        // Поддержка таблиц и с колонкой «Категория» (4 колонки), и без неё (3 колонки).
        const [id, en, ru] = cells.length >= 4 ? [cells[0], cells[2], cells[3]] : cells
        currentLesson.phrases.push({ id, en: cleanEnglish(en), ru })
      }
    }
  }

  const firstId = lessons[0]?.phrases[0]?.id ?? ''
  const prefix = prefixOf(firstId)
  if (!prefix) problems.push(`Не удалось определить префикс ID по первой фразе «${firstId}».`)

  for (const lesson of lessons) {
    for (const phrase of lesson.phrases) {
      if (!PHRASE_ID.test(phrase.id)) problems.push(`ID «${phrase.id}» не в формате ABC001.`)
    }
  }

  return { titleEn, titleRu, prefix, lessons, problems }
}


/**
 * Формат categories: одна таблица на весь документ, уроки собираются по колонке category.
 * Нумерация ID своя в каждой категории (GET001…, TAKE001…), поэтому префикс главы
 * невозможно вывести из данных — он берётся из конфига.
 */
async function parseCategoriesDocx(filePath) {
  const { value: html } = await mammoth.convertToHtml({ path: filePath })
  const doc = parse(html)
  const problems = []

  let titleEn = ''
  let titleRu = ''
  for (const node of doc.childNodes) {
    if (node.nodeType !== 1 || node.tagName.toLowerCase() !== 'p') continue
    const strong = node.querySelector('strong')
    if (!strong) continue
    // Первая строка документа: «English Core Verbs — выражения с примерами».
    const [en, ru] = cleanText(strong.text).split(/\s+[—–]\s+/)
    titleEn = titleCase(en ?? '')
    titleRu = ru ?? ''
    break
  }

  const table = doc.querySelector('table')
  if (!table) {
    problems.push('В документе нет таблицы с выражениями.')
    return { titleEn, titleRu, lessons: [], problems }
  }

  // Порядок уроков — порядок первого появления категории в таблице.
  const byCategory = new Map()
  for (const row of table.querySelectorAll('tr')) {
    const cells = row.querySelectorAll('td, th').map((cell) => cleanText(cell.text))
    if (cells.length < 4 || cells[0].toLowerCase() === 'id') continue

    const [id, category, en, ru, exampleEn, exampleRu] = cells
    if (!category) {
      problems.push(`У ${id || 'строки без ID'} не указана категория.`)
      continue
    }
    if (!byCategory.has(category)) byCategory.set(category, [])

    const phrase = { id, en: cleanEnglish(en), ru }
    if (exampleEn || exampleRu) phrase.example = { en: cleanEnglish(exampleEn ?? ''), ru: exampleRu ?? '' }
    byCategory.get(category).push(phrase)
  }

  const lessons = [...byCategory].map(([category, phrases], index) => ({
    order: index + 1,
    title: { en: titleCase(category), ru: `Выражения с «${category.toLowerCase()}»` },
    phrases,
  }))

  for (const lesson of lessons) {
    for (const phrase of lesson.phrases) {
      if (!PHRASE_ID.test(phrase.id)) problems.push(`ID «${phrase.id}» не в формате ABC001.`)
    }
  }

  return { titleEn, titleRu, lessons, problems }
}

/**
 * Заголовок словарной статьи: что показываем и что принимаем на этапе письма.
 *
 * В источнике у статьи бывает пояснение в скобках («match (contest/correspond)») —
 * ввести такое невозможно, и смысл всё равно различают русские переводы, поэтому
 * скобки снимаем. Перечисление через запятую («a, an») оставляем как есть,
 * но принимаем и каждую часть отдельно: по переводу не угадать, что ждут обе.
 */
function headword(word) {
  const en = cleanEnglish(word.replace(/\s*\([^)]*\)/g, ''))
  const parts = en.split(',').map((part) => part.trim()).filter(Boolean)
  const accept = parts.length > 1 && parts.every((part) => !part.includes(' ')) ? parts : []
  return accept.length ? { en, accept } : { en }
}

/**
 * Формат words: словарный уровень Oxford 3000.
 *
 * Слова не разложены по темам, поэтому уроки собираются сами — перемешиванием,
 * см. buildWordLessons. Название главы берётся из конфига: в самом PDF оно
 * только в колонтитуле, а туда полагаться не стоит.
 */
async function parseWordsChapter(filePath, entry) {
  const problems = []
  const { words, problems: parseProblems } = await parseWordsPdf(filePath, { fixes: entry.fixes ?? {} })
  problems.push(...parseProblems)

  if (!entry.title?.en || !entry.title?.ru) {
    problems.push('для формата words нужно указать title в chapters.config.json.')
  }

  const perLesson = entry.wordsPerLesson ?? PHRASES_PER_LESSON
  const lessons = buildWordLessons(words, { perLesson }).map((group, index) => {
    const from = index * perLesson + 1
    const to = from + group.length - 1
    // Английской строкой — первые слова урока: по ним урок узнаёшь, когда возвращаешься.
    // Нумерация идёт русской строкой, иначе обе строки говорили бы одно и то же.
    const preview = group.slice(0, 3).map((word) => word.word).join(' · ')
    return {
      order: index + 1,
      title: { en: preview, ru: `Слова ${from}–${to}` },
      phrases: group.map((word, i) => ({
        id: `${entry.prefix}${String(from + i).padStart(3, '0')}`,
        ...headword(word.word),
        ru: word.ru,
        pos: word.pos,
        example: { en: cleanEnglish(word.example.en), ru: word.example.ru },
      })),
    }
  })

  return { titleEn: '', titleRu: '', lessons, problems }
}

async function main() {
  const config = JSON.parse(await readFile(configPath, 'utf8'))
  const plannedChapters = config.plannedChapters ?? 10

  // Word создаёт временные файлы «~$имя.docx», пока документ открыт, их пропускаем.
  const sourceFiles = (await readdir(sourceDir)).filter(
    (f) => (f.endsWith('.docx') || f.endsWith('.pdf')) && !f.startsWith('~$'),
  )

  const entries = [...config.chapters]
  for (const file of sourceFiles) {
    if (!entries.some((entry) => entry.file === file)) {
      console.warn(`  ! ${file} нет в chapters.config.json, глава добавлена в конец. Укажите для неё id и order в конфиге.`)
      entries.push({ file })
    }
  }

  const chapters = []
  const fatal = []
  let nextOrder = Math.max(0, ...entries.map((e) => e.order ?? 0)) + 1

  for (const entry of entries) {
    const filePath = path.join(sourceDir, entry.file)
    if (!existsSync(filePath)) {
      fatal.push(`Файл ${entry.file} указан в конфиге, но его нет в content/source.`)
      continue
    }

    const format = entry.format ?? 'lessons'
    if (format !== 'lessons' && format !== 'categories' && format !== 'words') {
      fatal.push(`${entry.file}: неизвестный format «${format}», ожидается lessons, categories или words.`)
      continue
    }

    console.log(`→ ${entry.file}`)
    const parsed =
      format === 'words'
        ? await parseWordsChapter(filePath, entry)
        : format === 'categories'
          ? await parseCategoriesDocx(filePath)
          : await parseChapterDocx(filePath)
    fatal.push(...parsed.problems.map((p) => `${entry.file}: ${p}`))

    // В форматах categories и words нумерация задаётся не источником, а конфигом.
    const prefix = format === 'lessons' ? parsed.prefix : entry.prefix
    if (!prefix) {
      fatal.push(`${entry.file}: для формата ${format} нужно указать prefix в chapters.config.json.`)
      continue
    }

    const titleEn = entry.title?.en ?? parsed.titleEn
    const titleRu = entry.title?.ru ?? parsed.titleRu
    const id = entry.id ?? slugify(titleEn || entry.file.replace(/\.(docx|pdf)$/, ''))
    const order = entry.order ?? nextOrder++

    const kind = format === 'words' ? 'words' : format === 'categories' ? 'expressions' : 'phrases'

    chapters.push({
      id,
      order,
      prefix,
      kind,
      // Группа собирает несколько глав в раздел на главной — например уровни Oxford 3000.
      ...(entry.group ? { group: entry.group } : {}),
      title: { en: titleEn, ru: titleRu },
      lessons: parsed.lessons.map((lesson) => ({
        id: `${prefix}-L${String(lesson.order).padStart(2, '0')}`,
        ...lesson,
      })),
    })
  }

  chapters.sort((a, b) => a.order - b.order)

  const report = validateChapters(chapters, { plannedChapters })
  report.errors.unshift(...fatal)
  printReport(report)

  if (report.errors.length > 0) {
    console.error('\nДанные не записаны: исправьте ошибки и запустите снова.')
    process.exit(1)
  }

  await mkdir(chaptersOutDir, { recursive: true })

  // Удаляем JSON глав, которых больше нет в источниках.
  const keep = new Set(chapters.map((c) => `${c.id}.json`))
  for (const file of await readdir(chaptersOutDir)) {
    if (file.endsWith('.json') && !keep.has(file)) await rm(path.join(chaptersOutDir, file))
  }

  for (const chapter of chapters) {
    await writeFile(path.join(chaptersOutDir, `${chapter.id}.json`), JSON.stringify(chapter, null, 2) + '\n')
  }

  const index = {
    version: 1,
    plannedChapters,
    totalPhrases: chapters.reduce((sum, c) => sum + c.lessons.reduce((s, l) => s + l.phrases.length, 0), 0),
    chapters: chapters.map((c) => ({
      id: c.id,
      order: c.order,
      prefix: c.prefix,
      kind: c.kind,
      ...(c.group ? { group: c.group } : {}),
      title: c.title,
      file: `chapters/${c.id}.json`,
      lessonCount: c.lessons.length,
      phraseCount: c.lessons.reduce((s, l) => s + l.phrases.length, 0),
    })),
  }
  await writeFile(path.join(outDir, 'chapters.json'), JSON.stringify(index, null, 2) + '\n')

  console.log(`\nГотово: глав ${chapters.length} из ${plannedChapters}, фраз ${index.totalPhrases}.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
