// Проверяет готовые JSON-файлы в public/data.
//
//   yarn data:validate

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateChapters, printReport } from './lib/validate.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(root, 'public', 'data')

async function main() {
  console.log('\nПроверка public/data')
  const index = JSON.parse(await readFile(path.join(dataDir, 'chapters.json'), 'utf8'))
  const errors = []
  const chapters = []

  for (const summary of index.chapters) {
    const chapter = JSON.parse(await readFile(path.join(dataDir, summary.file), 'utf8'))
    chapters.push(chapter)

    const phraseCount = chapter.lessons.reduce((s, l) => s + l.phrases.length, 0)
    if (chapter.id !== summary.id) errors.push(`${summary.file}: id «${chapter.id}» не совпадает с chapters.json («${summary.id}»).`)
    if (chapter.prefix !== summary.prefix) errors.push(`${summary.file}: префикс не совпадает с chapters.json.`)
    if (phraseCount !== summary.phraseCount) errors.push(`${summary.file}: фраз ${phraseCount}, а в chapters.json указано ${summary.phraseCount}.`)
  }

  const report = validateChapters(chapters, { plannedChapters: index.plannedChapters })
  report.errors.unshift(...errors)
  printReport(report)
  if (report.errors.length > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
