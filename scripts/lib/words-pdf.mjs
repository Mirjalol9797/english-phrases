// Разбор PDF со словарным уровнем Oxford 3000 и раскладка слов по урокам.
//
// Источник: таблица «☐ | слово | часть речи | перевод | пример». Колонки стоят
// на фиксированных позициях по горизонтали, и поле определяется именно по ним,
// а не по порядку текста: в ячейках бывают переносы, и перенесённые куски
// идут вперемешку с соседними ячейками.
//
// В колонке примера две строки: сам пример и его перевод. Их различаем по
// алфавиту — пример латиницей, перевод кириллицей.

import { readFile } from 'node:fs/promises'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

/** Отметка в начале строки таблицы: по ней документ делится на слова. */
const MARKER = '☐'

const CYRILLIC = /[а-яёА-ЯЁ]/

/**
 * Сокращения частей речи из шапки документа. Нужны, чтобы отделить слово
 * от части речи: в тексте они идут подряд и переносятся как попало
 * («det./numb» + «er, adv.» — это одна часть речи, разорванная переносом).
 */
const POS_TOKENS = [
  'modal v.',
  'aux. v.',
  'infinitive marker',
  'inf. marker',
  'indefinite article',
  'definite article',
  'exclam.',
  'number',
  'prep.',
  'pron.',
  'conj.',
  'det.',
  'adj.',
  'adv.',
  'art.',
  'n.',
  'v.',
]

/**
 * Левые края колонок таблицы. Текст относится к той колонке, чей край
 * ближайший слева. Проверяется на каждом файле: если разметка другая,
 * у слов окажутся пустые поля и сборка это покажет.
 */
const FOOTER_BELOW = 45

const COLUMNS = [
  { from: 50, field: 'marker' },
  { from: 65, field: 'word' },
  { from: 150, field: 'pos' },
  { from: 200, field: 'ru' },
  { from: 310, field: 'example' },
]

/** Счётчик слов в заголовке буквы — «A · 50». К самому слову отношения не имеет. */
const GROUP_COUNT = /^·\s*\d+$/

function clean(text) {
  return text.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Склейка кусков одной ячейки.
 *
 * Узкая колонка части речи рвётся посреди слова («det./numb» + «er, adv.»),
 * такие куски склеиваются вплотную — это и включает tight. Широкие колонки
 * переносятся по словам, и там между кусками нужен пробел, иначе
 * «перед» и «глаголом» слипнутся в одно слово.
 */
function joinFragments(parts, { tight = false } = {}) {
  let text = ''
  for (const part of parts) {
    const piece = part.trim()
    if (!piece) continue
    if (!text) {
      text = piece
      continue
    }
    const brokenWord = tight && /[a-zA-Zа-яёА-ЯЁ]$/.test(text) && /^[a-zа-яё]/.test(piece)
    const continuation = /^[.,)]/.test(piece) || /[/\-(]$/.test(text)
    text += brokenWord || continuation ? piece : ` ${piece}`
  }
  return clean(text)
}

function isRussian(line) {
  return CYRILLIC.test(line)
}

function columnOf(x) {
  let field = null
  for (const column of COLUMNS) {
    if (x >= column.from) field = column.field
  }
  return field
}

/**
 * Строки таблицы: каждая отметка ☐ начинает новую, остальной текст
 * раскладывается по колонкам. Всё, что левее таблицы или выше первой
 * отметки (колонтитулы, вступление, шапка), в строки не попадает.
 */
async function readRows(filePath) {
  const data = new Uint8Array(await readFile(filePath))
  const pdf = await getDocument({ data, useSystemFonts: true }).promise
  const rows = []
  let current = null

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()

    for (const item of content.items) {
      const text = typeof item.str === 'string' ? item.str.trim() : ''
      if (!text) continue
      // Внизу каждой страницы подпись и её номер — номер попадает в колонку примера.
      if (item.transform[5] < FOOTER_BELOW) continue
      const field = columnOf(item.transform[4])
      if (!field) continue

      if (text === MARKER) {
        if (current) rows.push(current)
        current = { word: [], pos: [], ru: [], example: [] }
        continue
      }
      // Шапка таблицы идёт до первой отметки, так что current ещё пуст.
      if (!current || field === 'marker') continue
      // Заголовок буквы стоит между строками, и счётчик попадает в колонку слова.
      if (GROUP_COUNT.test(text)) continue
      current[field].push(text)
    }
  }

  if (current) rows.push(current)
  await pdf.cleanup()
  return rows
}

/**
 * Слово и часть речи из склеенной латинской части строки.
 * Часть речи ищем не с начала: само слово тоже может быть «number» или «art».
 */
function splitWordAndPos(text) {
  let best = -1
  for (const token of POS_TOKENS) {
    const at = text.indexOf(token, 1)
    if (at > 0 && (best === -1 || at < best)) best = at
  }
  if (best === -1) return { word: text, pos: '' }
  return {
    word: text.slice(0, best).replace(/[\s,]+$/, '').trim(),
    pos: text.slice(best).trim(),
  }
}

/**
 * Склейка узкой колонки — слова или перевода.
 *
 * Длинное слово в такую колонку не влезает и рвётся посреди себя:
 * «достопримечательность» разорвана на «достопримечательнос» и «ть»,
 * «recommendation» — на «recommendatio» и «n». Отличить такой разрыв от
 * обычного переноса по пробелу нельзя ни по ширине строки (перенос по пробелу
 * тоже доходит до края), ни по виду кусков: «ice cream» и «per cent» — honest
 * два слова, а «according to» вдобавок склеилось бы в правдоподобное слово.
 *
 * Зато это же слово целиком стоит в примере — он и служит арбитром.
 * Склеиваем, только если склеенное сходится со словом из примера почти
 * по всей длине: случайное слипание двух разных слов так совпасть не может.
 */
export function joinCell(parts, { sample: sampleText, letters }) {
  const sample = sampleText
    .toLowerCase()
    .split(new RegExp(`[^${letters}-]+`))
    .filter((token) => token.length >= 10)

  const confirmed = (raw) => {
    const glued = raw.toLowerCase()
    if (glued.length < 10) return false
    return sample.some((token) => {
      // Длина должна почти совпасть: иначе подтвердилось бы любое слипание,
      // у которого первая половина сама по себе есть в примере.
      if (Math.abs(token.length - glued.length) > 3) return false
      // Сверяем только основу: в примере слово стоит в другом падеже.
      const stem = Math.max(10, Math.min(token.length, glued.length) - 3)
      return token.slice(0, stem) === glued.slice(0, stem)
    })
  }

  let text = ''
  for (const part of parts) {
    const piece = part.trim()
    if (!piece) continue
    if (!text) {
      text = piece
      continue
    }
    const tail = text.split(' ').pop() ?? ''
    const head = piece.split(' ')[0] ?? ''
    const letter = new RegExp(`^[${letters}]`)
    const wrapped =
      new RegExp(`[${letters}]$`).test(tail) && letter.test(head) && confirmed(tail + head)
    // Пометки вроде «match (contest/» + «correspond)» тоже идут вплотную.
    const continuation = /^[.,)]/.test(piece) || /[/\-(]$/.test(text)
    text += wrapped || continuation ? piece : ` ${piece}`
  }
  return clean(text)
}

export const CYRILLIC_LETTERS = 'а-яёА-ЯЁ'
export const LATIN_LETTERS = 'a-zA-Z'

/** Одно слово из строки таблицы. */
function parseRow(row) {
  // Пример склеиваем первым: он арбитр для колонок слова и перевода.
  const exampleEn = joinFragments(row.example.filter((line) => !isRussian(line)))
  const exampleRu = joinFragments(row.example.filter(isRussian))

  // Часть речи иногда попадает в колонку слова (и наоборот) — склеиваем и делим заново.
  const head = clean(
    `${joinCell(row.word, { sample: exampleEn, letters: LATIN_LETTERS })} ${joinFragments(row.pos, { tight: true })}`,
  )
  const { word, pos } = splitWordAndPos(head)
  const entry = {
    word,
    pos,
    ru: joinCell(row.ru, { sample: exampleRu, letters: CYRILLIC_LETTERS }),
    // Колонка примера вдвое шире, в неё помещается любое русское слово,
    // поэтому разрывов внутри слова там не бывает — склеиваем по пробелу.
    example: { en: exampleEn, ru: exampleRu },
  }

  const missing = []
  if (!entry.word) missing.push('слово')
  if (!entry.ru) missing.push('перевод')
  if (!entry.example.en) missing.push('пример')
  if (!entry.example.ru) missing.push('перевод примера')
  return { entry, missing }
}

/**
 * Слова из PDF уровня.
 * fixes — правки по слову для случаев, где в источнике чего-то не хватает:
 * { "sentence": { "ru": "предложение" } }.
 */
export async function parseWordsPdf(filePath, { fixes = {} } = {}) {
  const rows = await readRows(filePath)
  const problems = []
  const words = []

  for (const row of rows) {
    // Шапка таблицы повторяется на каждой странице — у неё нет примера.
    if (row.word.join(' ') === 'Word') continue

    const { entry, missing } = parseRow(row)
    const fix = fixes[entry.word]
    if (fix) {
      if (fix.ru) entry.ru = fix.ru
      if (fix.pos) entry.pos = fix.pos
      if (fix.example) entry.example = { ...entry.example, ...fix.example }
    }

    const stillMissing = missing.filter(
      (what) =>
        !(what === 'перевод' && entry.ru) &&
        !(what === 'пример' && entry.example.en) &&
        !(what === 'перевод примера' && entry.example.ru),
    )
    if (stillMissing.length) {
      const where = entry.word || JSON.stringify(row)
      problems.push(`«${where}»: не хватает — ${stillMissing.join(', ')}.`)
      continue
    }
    words.push(entry)
  }

  return { words, problems }
}

/** Предсказуемый генератор: пересборка данных должна давать ту же раскладку. */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled(items, random) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Грубый класс части речи: по нему слова разных видов расходятся по урокам. */
function posClass(pos) {
  if (/\bv\./.test(pos) || /modal v|aux\. v/.test(pos)) return 'verb'
  if (/\badj\./.test(pos)) return 'adj'
  if (/\badv\./.test(pos)) return 'adv'
  if (/\bn\./.test(pos)) return 'noun'
  return 'other'
}

/** Похожие слова мешают друг другу запоминаться: actor и actress в один урок не ставим. */
function similarityKey(word) {
  return word.toLowerCase().replace(/[^a-z]/g, '').slice(0, 3)
}

/**
 * Раскладка слов по урокам.
 *
 * В источнике слова идут по алфавиту, и подряд стоящие похожи друг на друга
 * (actor, actress, add, address). Учить их вместе тяжелее всего, поэтому
 * уроки собираются перемешиванием: в каждом слова разных частей речи,
 * а слова с общим началом разводятся по разным урокам.
 */
export function buildWordLessons(words, { perLesson = 10, seed = 20261016 } = {}) {
  const random = mulberry32(seed)

  // Корзины по частям речи, каждая перемешана отдельно.
  const buckets = new Map()
  for (const word of words) {
    const key = posClass(word.pos)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(word)
  }
  const order = [...buckets.keys()].sort()
  const queues = order.map((key) => shuffled(buckets.get(key), random))

  // Раздаём по кругу пропорционально размеру корзины: в каждом уроке смесь.
  const sequence = []
  const taken = queues.map(() => 0)
  while (sequence.length < words.length) {
    let bestIndex = -1
    let bestShare = -1
    queues.forEach((queue, i) => {
      if (taken[i] >= queue.length) return
      // Берём из той корзины, что сильнее всего отстала от своей доли.
      const share = (queue.length - taken[i]) / queue.length
      if (share > bestShare) {
        bestShare = share
        bestIndex = i
      }
    })
    sequence.push(queues[bestIndex][taken[bestIndex]++])
  }

  // Уроков столько, сколько нужно на все слова, а размер выравнивается:
  // при 872 словах иначе последним уроком осталось бы два слова.
  const lessons = []
  const count = Math.ceil(sequence.length / perLesson)
  const base = count ? Math.floor(sequence.length / count) : 0
  const bigger = count ? sequence.length % count : 0
  let at = 0
  for (let i = 0; i < count; i++) {
    const size = base + (i < bigger ? 1 : 0)
    lessons.push(sequence.slice(at, at + size))
    at += size
  }

  // Разводим похожие слова: меняем местами со словом из другого урока.
  for (let i = 0; i < lessons.length; i++) {
    for (let j = 0; j < lessons[i].length; j++) {
      const key = similarityKey(lessons[i][j].word)
      const clash = lessons[i].some((other, k) => k !== j && similarityKey(other.word) === key)
      if (!clash) continue

      const swapped = lessons.some((lesson, li) => {
        if (li === i) return false
        return lesson.some((candidate, ci) => {
          const candidateKey = similarityKey(candidate.word)
          const fitsHere = !lessons[i].some((o, k) => k !== j && similarityKey(o.word) === candidateKey)
          const fitsThere = !lesson.some((o, k) => k !== ci && similarityKey(o.word) === key)
          if (!fitsHere || !fitsThere) return false
          ;[lessons[i][j], lesson[ci]] = [lesson[ci], lessons[i][j]]
          return true
        })
      })
      if (!swapped) continue
    }
  }

  return lessons
}
