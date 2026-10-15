// Проверка готовности к офлайну: всё ли из списка предзагрузки есть в сборке
// и попало ли в него то, без чего приложение не откроется.
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')

if (!existsSync(path.join(dist, 'sw.js'))) {
  console.error('Нет dist/sw.js. Сначала выполните yarn build.')
  process.exit(1)
}
const sw = readFileSync(path.join(dist, 'sw.js'), 'utf8')
const urls = [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1])

let missing = 0
let bytes = 0
for (const url of urls) {
  const file = path.join(dist, decodeURIComponent(url))
  if (!existsSync(file)) {
    console.error(`  ✗ нет файла: ${url}`)
    missing++
  } else {
    bytes += statSync(file).size
  }
}

// Что обязано быть в кэше, иначе офлайн бесполезен.
const required = [
  ['страница', (u) => u === 'index.html'],
  ['список глав', (u) => u === 'data/chapters.json'],
  ['манифест', (u) => u.endsWith('.webmanifest')],
  ['иконка 192', (u) => u === 'icon-192.png'],
  ['иконка 512', (u) => u === 'icon-512.png'],
]
for (const [name, test] of required) {
  console.log(`  ${urls.some(test) ? '✓' : '✗'} ${name}`)
}

// Все главы из индекса
const index = JSON.parse(readFileSync(path.join(dist, 'data', 'chapters.json'), 'utf8'))
// В chapters.json путь уже относительный от data/: «chapters/everyday-english.json».
const missingChapters = index.chapters.filter((c) => !urls.includes(`data/${c.file}`))
console.log(`  ${missingChapters.length === 0 ? '✓' : '✗'} главы в кэше: ${index.chapters.length - missingChapters.length} из ${index.chapters.length}`)

// Все собранные js/css должны быть в кэше, иначе экран не откроется без сети
const assets = readdirSync(path.join(dist, 'assets')).filter((f) => /\.(js|css)$/.test(f))
const missingAssets = assets.filter((f) => !urls.includes(`assets/${f}`))
console.log(`  ${missingAssets.length === 0 ? '✓' : '✗'} код и стили: ${assets.length - missingAssets.length} из ${assets.length}`)
if (missingAssets.length) console.error('    не хватает:', missingAssets.join(', '))

console.log(`\nзаписей ${urls.length}, файлов нет: ${missing}, суммарно ${(bytes / 1024).toFixed(0)} КБ`)
console.log(`navigateFallback: ${/navigateFallback/.test(sw) || /createHandlerBoundToURL/.test(sw) ? 'задан' : 'НЕТ'}`)
process.exit(missing === 0 && missingChapters.length === 0 && missingAssets.length === 0 ? 0 : 1)
