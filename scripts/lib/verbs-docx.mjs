// Разбор Word-файла с неправильными глаголами и раскладка их по урокам.
//
// Источник: заголовки «Этап N — …» и под каждым таблица
// «№ | V1 | V2 — Past Simple | V3 — Past Participle | Перевод».

import mammoth from 'mammoth'
import { parse } from 'node-html-parser'

/** Заголовок этапа. Всё, что не подходит под него, — вступление и итоги. */
const STAGE_HEADING = /^Этап\s+(\d+)\s*[—–-]\s*(.+)$/

function clean(text) {
  return text.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Этапы с глаголами. Каждый — { number, title, verbs }, где глагол это
 * { v1, v2, v3, ru }. Порядок глаголов внутри этапа сохраняется: в источнике
 * он по убыванию полезности, и перемешивать его нельзя.
 */
export async function parseVerbsDocx(filePath) {
  const { value: html } = await mammoth.convertToHtml({ path: filePath })
  const doc = parse(html)
  const problems = []
  const stages = []
  let current = null

  for (const node of doc.childNodes) {
    if (node.nodeType !== 1) continue
    const tag = node.tagName.toLowerCase()

    if (tag === 'h1') {
      const match = clean(node.text).match(STAGE_HEADING)
      // Вступление и «Итоговая проверка» — это не этапы, таблиц под ними нет.
      current = match ? { number: Number(match[1]), title: clean(match[2]), verbs: [] } : null
      if (current) stages.push(current)
      continue
    }

    if (tag !== 'table') continue
    if (!current) continue

    for (const row of node.querySelectorAll('tr')) {
      const cells = row.querySelectorAll('td, th').map((cell) => clean(cell.text))
      if (cells.length < 5) {
        problems.push(`этап ${current.number}: в строке ${cells.length} колонок, ожидается 5.`)
        continue
      }
      const [number, v1, v2, v3, ru] = cells
      // Шапка таблицы повторяется в каждом этапе.
      if (number.toLowerCase() === '№' || v1 === 'V1') continue

      const verb = { v1, v2, v3, ru }
      const missing = Object.entries(verb)
        .filter(([, value]) => !value)
        .map(([key]) => key)
      if (missing.length) {
        problems.push(`этап ${current.number}, строка «${cells.join(' | ')}»: пусто — ${missing.join(', ')}.`)
        continue
      }
      current.verbs.push(verb)
    }
  }

  for (const stage of stages) {
    if (stage.verbs.length === 0) problems.push(`этап ${stage.number}: не нашлось ни одного глагола.`)
  }

  return { stages, problems }
}

/**
 * Этап режется на уроки по perLesson глаголов, размер выравнивается:
 * 22 глагола — это три урока по 8, 7 и 7, а не два по десять и огрызок.
 * Порядок источника сохраняется — он по убыванию полезности.
 */
export function splitStage(verbs, perLesson = 10) {
  const count = Math.ceil(verbs.length / perLesson)
  if (count === 0) return []

  const base = Math.floor(verbs.length / count)
  const bigger = verbs.length % count
  const lessons = []
  let at = 0
  for (let i = 0; i < count; i++) {
    const size = base + (i < bigger ? 1 : 0)
    lessons.push(verbs.slice(at, at + size))
    at += size
  }
  return lessons
}

/**
 * Что принимать как верный ответ для формы.
 *
 * Слэш в источнике означает допустимые варианты: got/gotten — обе формы верны,
 * was/were — обе формы глагола be. Принимаем и запись целиком, и каждый вариант:
 * по вопросу не угадать, ждут ли оба варианта через слэш.
 */
export function formVariants(form) {
  const parts = form
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
  return parts.length > 1 ? [form, ...parts] : [form]
}
