/**
 * fetch-fonts.mjs — ПИСЦОВЫЕ ПЕРЬЯ
 * ------------------------------------------------------------------
 * Тянет пиксельные шрифты с кириллицей из Google Fonts и кладёт их
 * в public/fonts, а рядом пишет src/styles/fonts.css с локальными
 * @font-face. Нужно, чтобы PWA работала офлайн и не ходила на чужой домен.
 *
 * Запуск: node tools/fetch-fonts.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FONT_DIR = resolve(ROOT, 'public/fonts')
const CSS_OUT = resolve(ROOT, 'src/styles/fonts.css')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

/**
 * Нужные семейства и подмножества. Лишние алфавиты не тащим.
 *
 * Handjet — переменный, берём весь диапазон 400..900. Тяжёлые начертания
 * нужны обязательно: в лёгких пятёрка читается как «S», а в кабаке
 * половина чисел на неё и заканчивается.
 * Pixelify Sans выброшен по той же причине — у него «5» неотличима от «S».
 */
const FAMILIES = [
  { query: 'Handjet:wght@400..900', slug: 'handjet' },
  { query: 'Tiny5', slug: 'tiny5' },
]
const KEEP = new Set(['cyrillic', 'cyrillic-ext', 'latin', 'latin-ext'])

/**
 * Эти подмножества вшиваются прямо в CSS как base64.
 * Причина: в вебвью Telegram шрифт иногда не успевал загрузиться, и текст
 * оставался тощим запасным моноширинным. Вшитый шрифт не может не приехать —
 * он часть стилей и рисуется с первого кадра. Остальные подмножества
 * (латиница, расширения) остаются файлами: они нужны редко.
 */
const INLINE = new Set(['handjet-cyrillic', 'tiny5-cyrillic'])

async function fetchCss(query) {
  const url = `https://fonts.googleapis.com/css2?family=${query}&display=swap`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`Google Fonts ответил ${res.status} на ${query}`)
  return res.text()
}

/** Разобрать CSS на блоки: комментарий-подмножество + @font-face. */
function parseBlocks(css) {
  const out = []
  const re = /\/\*\s*([a-z-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g
  let m
  while ((m = re.exec(css))) out.push({ subset: m[1], block: m[2] })
  return out
}

const field = (block, name) => block.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim()

async function main() {
  await mkdir(FONT_DIR, { recursive: true })
  await mkdir(dirname(CSS_OUT), { recursive: true })

  const faces = []

  for (const { query, slug } of FAMILIES) {
    const css = await fetchCss(query)
    const blocks = parseBlocks(css).filter((b) => KEEP.has(b.subset))
    if (!blocks.length) throw new Error(`Не нашлось нужных подмножеств для ${query}`)

    for (const { subset, block } of blocks) {
      const url = block.match(/url\((https:\/\/[^)]+)\)/)?.[1]
      if (!url) continue
      const file = `${slug}-${subset}.woff2`
      const res = await fetch(url, { headers: { 'User-Agent': UA } })
      if (!res.ok) throw new Error(`Не скачался ${url}`)
      const buf = Buffer.from(await res.arrayBuffer())
      await writeFile(resolve(FONT_DIR, file), buf)

      const key = `${slug}-${subset}`
      const inline = INLINE.has(key)
      faces.push({
        family: field(block, 'font-family'),
        style: field(block, 'font-style') || 'normal',
        weight: field(block, 'font-weight') || '400',
        range: field(block, 'unicode-range'),
        file,
        subset,
        size: buf.length,
        src: inline
          ? `url('data:font/woff2;base64,${buf.toString('base64')}') format('woff2')`
          : `url('/fonts/${file}') format('woff2')`,
      })
      console.log(`  ✓ ${file} (${(buf.length / 1024).toFixed(1)} КБ)${inline ? ' — вшит в CSS' : ''}`)
    }
  }

  const header = `/* ПИСЦОВЫЕ ПЕРЬЯ — локальные шрифты летописи.
 * Сгенерировано tools/fetch-fonts.mjs. Руками не править:
 * перезапусти  node tools/fetch-fonts.mjs
 *
 * Кириллица Handjet и Tiny5 вшита в этот файл целиком — иначе в вебвью
 * Telegram текст успевал показаться тощим запасным шрифтом.
 *
 * Handjet      — готический пиксель, заголовки и цифры счёта
 * Pixelify Sans — основной текст свитков
 * Tiny5        — мелкие подписи писаря
 */\n\n`

  const body = faces
    .map(
      (f) => `@font-face {
  font-family: ${f.family};
  font-style: ${f.style};
  font-weight: ${f.weight};
  font-display: ${f.src.startsWith("url('data:") ? 'block' : 'swap'};
  src: ${f.src};
  unicode-range: ${f.range};
}`,
    )
    .join('\n\n')

  await writeFile(CSS_OUT, header + body + '\n')
  const total = faces.reduce((a, f) => a + f.size, 0)
  console.log(`\nВсего ${faces.length} начертаний, ${(total / 1024).toFixed(1)} КБ → public/fonts`)
  console.log(`CSS: src/styles/fonts.css`)
}

main().catch((err) => {
  console.error('Перья сломались:', err.message)
  process.exit(1)
})
