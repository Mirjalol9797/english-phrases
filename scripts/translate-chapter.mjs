// Конвейер перевода главы на узбекский.
//
//   node scripts/translate-chapter.mjs dump everyday-english    — выгрузить строки
//   node scripts/translate-chapter.mjs build everyday-english   — собрать файл перевода
//
// dump кладёт рядом с главой построчный список того, что ещё не переведено.
// Переводы дописываются в тот же файл пятым полем и собираются обратно
// командой build в content/translations/<глава>.json.
//
// Почему не редактировать JSON напрямую: перевод идёт партиями по сотне строк,
// и дописывать в конец простого файла надёжнее, чем каждый раз пересобирать JSON.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(root, 'public', 'data', 'chapters')
const workDir = path.join(root, 'content', 'translations', 'work')
const outDir = path.join(root, 'content', 'translations')

/** Разделитель полей. В английском тексте и переводах вертикальной черты не бывает. */
const SEP = '|'

/** Все строки главы, которые нужно перевести: запись и её примеры. */
function rowsOf(chapter) {
  const rows = []
  for (const lesson of chapter.lessons) {
    for (const phrase of lesson.phrases) {
      rows.push({ kind: 'phrase', en: phrase.en, pos: phrase.pos ?? '', ru: phrase.ru })
      for (const example of phrase.examples ?? []) {
        rows.push({ kind: 'example', of: phrase.en, pos: phrase.pos ?? '', ofRu: phrase.ru, en: example.en, ru: example.ru })
      }
    }
  }
  return rows
}

const workFile = (id) => path.join(workDir, `${id}.txt`)

async function dump(id) {
  const chapter = JSON.parse(await readFile(path.join(dataDir, `${id}.json`), 'utf8'))
  const rows = rowsOf(chapter)

  const done = new Set()
  if (existsSync(workFile(id))) {
    for (const line of (await readFile(workFile(id), 'utf8')).split('\n')) {
      const parts = line.split(SEP)
      if (parts.length >= 5 && parts[4].trim()) done.add(parts.slice(0, 4).join(SEP))
    }
  }

  const left = rows.filter((r) => {
    const key = r.kind === 'phrase' ? ['phrase', r.en, r.pos, r.ru] : ['example', r.of, r.pos, r.en]
    return !done.has(key.join(SEP))
  })

  console.log(`${id}: всего строк ${rows.length}, переведено ${rows.length - left.length}, осталось ${left.length}`)
  if (left.length === 0) return

  console.log('\nСледующие строки (формат: вид|ключ|часть речи|текст| ← сюда перевод):\n')
  for (const r of left.slice(0, Number(process.argv[4]) || 60)) {
    if (r.kind === 'phrase') console.log(`phrase${SEP}${r.en}${SEP}${r.pos}${SEP}${r.ru}${SEP}`)
    else console.log(`example${SEP}${r.of}${SEP}${r.pos}${SEP}${r.en}${SEP}`)
  }
}

async function build(id) {
  const chapter = JSON.parse(await readFile(path.join(dataDir, `${id}.json`), 'utf8'))
  const rows = rowsOf(chapter)

  if (!existsSync(workFile(id))) {
    console.error(`Нет файла ${workFile(id)} — сначала переведите строки.`)
    process.exit(1)
  }

  const uzOf = new Map()
  const problems = []
  const lines = (await readFile(workFile(id), 'utf8')).split('\n')
  for (const [i, line] of lines.entries()) {
    if (!line.trim()) continue
    const parts = line.split(SEP)
    if (parts.length < 5) {
      problems.push(`строка ${i + 1}: полей ${parts.length}, нужно 5 — ${line.slice(0, 60)}`)
      continue
    }
    const [kind, key, pos, text, uz] = parts.map((x) => x.trim())
    if (!uz) continue
    uzOf.set([kind, key, pos, text].join(SEP), uz)
  }

  const entries = new Map()
  let translated = 0
  for (const r of rows) {
    if (r.kind === 'phrase') {
      const uz = uzOf.get(['phrase', r.en, r.pos, r.ru].join(SEP))
      if (!uz) continue
      translated += 1
      entries.set([r.en, r.pos, r.ru].join(SEP), { en: r.en, ...(r.pos ? { pos: r.pos } : {}), ru: r.ru, uz })
    } else {
      const uz = uzOf.get(['example', r.of, r.pos, r.en].join(SEP))
      if (!uz) continue
      const key = [r.of, r.pos, r.ofRu].join(SEP)
      const entry = entries.get(key)
      if (!entry) {
        problems.push(`пример «${r.en}» переведён, а сама запись «${r.of}» — ещё нет.`)
        continue
      }
      entry.examples = [...(entry.examples ?? []), { en: r.en, uz }]
    }
  }

  if (problems.length) {
    console.log('ПРОБЛЕМЫ:')
    for (const p of problems.slice(0, 20)) console.log('  ' + p)
    process.exit(1)
  }

  const existing = existsSync(path.join(outDir, `${id}.json`))
    ? JSON.parse(await readFile(path.join(outDir, `${id}.json`), 'utf8'))
    : {}

  await mkdir(outDir, { recursive: true })
  await writeFile(
    path.join(outDir, `${id}.json`),
    JSON.stringify(
      {
        chapter: id,
        note: 'Узбекский перевод главы. Собран командой scripts/translate-chapter.mjs build — правьте content/translations/work/<глава>.txt, а не этот файл.',
        ...(existing.title ? { title: existing.title } : {}),
        ...(existing.lessons ? { lessons: existing.lessons } : {}),
        entries: [...entries.values()],
      },
      null,
      2,
    ) + '\n',
    'utf8',
  )

  const phrases = rows.filter((r) => r.kind === 'phrase').length
  console.log(`${id}: собрано ${entries.size} записей, из них переведённых фраз ${translated} из ${phrases}`)
  if (translated < phrases) console.log(`осталось ${phrases - translated} — перевод возьмётся в данные, когда глава будет целиком`)
}

const [, , command, id] = process.argv
if (!id || !['dump', 'build'].includes(command)) {
  console.error('Как пользоваться: node scripts/translate-chapter.mjs dump|build <глава> [сколько строк]')
  process.exit(1)
}
await mkdir(workDir, { recursive: true })
if (command === 'dump') await dump(id)
else await build(id)
