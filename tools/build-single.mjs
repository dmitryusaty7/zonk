/**
 * build-single.mjs — СВИТОК В ОДНОМ ЛИСТЕ
 * ------------------------------------------------------------------
 * Склеивает прод-сборку в один HTML-файл: скрипт, стили, шрифты и
 * текстуры зашиваются внутрь как data:-строки. Такой файл можно
 * перекинуть на телефон и открыть прямо из файлового менеджера —
 * ни сервера, ни сети не нужно.
 *
 * Почему data:, а не ссылки на файлы: страница, открытая по file://,
 * живёт в «пустом» источнике, и браузер режет ей загрузку шрифтов
 * по CORS. Зашитые внутрь — грузятся всегда.
 *
 * Запуск:  npm run build && node tools/build-single.mjs
 */
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { resolve, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = resolve(ROOT, 'dist')
const OUT = resolve(ROOT, 'zonk.html')

const MIME = {
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
}

const kb = (n) => `${(n / 1024).toFixed(1)} КБ`

/** Файл → data:-строка. */
async function dataUri(path) {
  const buf = await readFile(path)
  const mime = MIME[extname(path)] || 'application/octet-stream'
  return { uri: `data:${mime};base64,${buf.toString('base64')}`, size: buf.length }
}

async function main() {
  let html = await readFile(resolve(DIST, 'index.html'), 'utf8')

  const assets = await readdir(resolve(DIST, 'assets'))
  const cssName = assets.find((f) => f.endsWith('.css'))
  const jsName = assets.find((f) => f.endsWith('.js'))
  if (!cssName || !jsName) throw new Error('Не нашёл собранные assets — сначала npm run build')

  // ── Стили: подменяем url(...) на data: ──
  let css = await readFile(resolve(DIST, 'assets', cssName), 'utf8')
  const refs = [...new Set([...css.matchAll(/url\((\.\.\/[^)'"]+)\)/g)].map((m) => m[1]))]
  let embedded = 0
  for (const ref of refs) {
    const file = resolve(DIST, 'assets', ref)
    const { uri, size } = await dataUri(file)
    css = css.split(`url(${ref})`).join(`url(${uri})`)
    embedded += size
  }
  console.log(`  ✓ вшито ${refs.length} ассетов (${kb(embedded)}): шрифты и текстуры`)

  const js = await readFile(resolve(DIST, 'assets', jsName), 'utf8')
  const favicon = await dataUri(resolve(DIST, 'favicon.png'))

  // ── Собираем один лист ──
  html = html
    // манифест и service worker в файле без сервера бесполезны
    .replace(/<link rel="manifest"[^>]*>/, '')
    .replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/, '')
    .replace(/<link rel="apple-touch-icon"[^>]*>/, '')
    // SDK Telegram нужен только внутри мессенджера; в одном листе он лишь
    // тянул бы сеть, а обёртка и без него прекрасно работает
    .replace(/<script src="https:\/\/telegram\.org[^"]*"><\/script>/, '')
    .replace(/<!-- Telegram Mini App SDK[\s\S]*?-->/, '')
    .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" type="image/png" href="${favicon.uri}" />`)
    .replace(
      /<script type="module" crossorigin src="[^"]+"><\/script>/,
      '<!-- скрипт ниже, после разметки -->',
    )
    .replace(
      /<link rel="stylesheet" crossorigin href="[^"]+">/,
      `<style>\n${css}\n</style>`,
    )
    .replace('</body>', `  <script type="module">\n${js}\n</script>\n  </body>`)

  await writeFile(OUT, html, 'utf8')
  const total = Buffer.byteLength(html)
  console.log(`  ✓ zonk.html — ${kb(total)}`)
  console.log('\nОдин файл. Кидай на телефон и открывай.')
}

main().catch((e) => {
  console.error('Не склеилось:', e.message)
  process.exit(1)
})
