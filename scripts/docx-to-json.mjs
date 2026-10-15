// Конвертирует Word-файлы глав из content/source в JSON для приложения.
//
//   yarn data:build
//
// Каждый .docx — одна глава. Поддерживаются два формата источника:
//   lessons    (по умолчанию) — заголовки «N. English — Русский» задают уроки,
//               таблица под заголовком содержит фразы (ID | English phrase | Перевод);
//   categories — одна таблица на весь документ
//               (id | category | phrase_en | phrase_ru | example_en | example_ru),
//               каждая категория становится отдельным уроком.
// Порядок, id и формат глав задаются в content/chapters.config.json.

import { readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mammoth from 'mammoth'
import { parse } from 'node-html-parser'
import { PHRASE_ID, prefixOf, validateChapters, printReport } from './lib/validate.mjs'

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

async function main() {
  const config = JSON.parse(await readFile(configPath, 'utf8'))
  const plannedChapters = config.plannedChapters ?? 10

  // Word создаёт временные файлы «~$имя.docx», пока документ открыт, их пропускаем.
  const sourceFiles = (await readdir(sourceDir)).filter((f) => f.endsWith('.docx') && !f.startsWith('~$'))

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
    if (format !== 'lessons' && format !== 'categories') {
      fatal.push(`${entry.file}: неизвестный format «${format}», ожидается lessons или categories.`)
      continue
    }

    console.log(`→ ${entry.file}`)
    const parsed = format === 'categories' ? await parseCategoriesDocx(filePath) : await parseChapterDocx(filePath)
    fatal.push(...parsed.problems.map((p) => `${entry.file}: ${p}`))

    // В формате categories у каждого урока своя нумерация, общий префикс главы задаёт конфиг.
    const prefix = format === 'categories' ? entry.prefix : parsed.prefix
    if (!prefix) {
      fatal.push(`${entry.file}: для формата categories нужно указать prefix в chapters.config.json.`)
      continue
    }

    const titleEn = entry.title?.en ?? parsed.titleEn
    const titleRu = entry.title?.ru ?? parsed.titleRu
    const id = entry.id ?? slugify(titleEn || entry.file.replace(/\.docx$/, ''))
    const order = entry.order ?? nextOrder++

    chapters.push({
      id,
      order,
      prefix,
      kind: format === 'categories' ? 'expressions' : 'phrases',
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
