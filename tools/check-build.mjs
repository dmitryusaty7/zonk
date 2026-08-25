/**
 * check-build.mjs — ПРИЁМКА
 * ------------------------------------------------------------------
 * Проверяет собранное приложение так, как его увидит телефон:
 * грузит прод-сборку, ждёт service worker, читает манифест,
 * проверяет шрифты, текстуры и работу офлайн-кеша.
 *
 * Запуск:  npm run build && npm run preview   (в другом окне)
 *          node tools/check-build.mjs
 */
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'

const URL = process.env.ZONK_URL || process.env.LETOPIS_URL || 'http://localhost:4173'
const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []
const ok = (cond, what, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${what}${detail ? ` — ${detail}` : ''}`)
  if (!cond) fails.push(what)
}

const browser = await puppeteer.launch({
  executablePath: BROWSERS.find((p) => existsSync(p)),
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars', '--mute-audio'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })

const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

console.log(`Приёмка прод-сборки: ${URL}\n`)
await page.goto(URL, { waitUntil: 'networkidle2' })

// ── Приложение поднялось ──
const rootFilled = await page.evaluate(() => document.getElementById('root')?.children.length > 0)
ok(rootFilled, 'приложение отрисовалось')

const title = await page.title()
ok(title.includes('ЗОНК'), 'заголовок на месте', title)

// ── Манифест ──
const manifest = await page.evaluate(async () => {
  const link = document.querySelector('link[rel="manifest"]')
  if (!link) return null
  const res = await fetch(link.href)
  return res.ok ? res.json() : null
})
ok(!!manifest, 'манифест доступен')
if (manifest) {
  ok(manifest.display === 'standalone', 'запуск отдельным окном', manifest.display)
  ok(manifest.icons?.length >= 3, 'иконки описаны', `${manifest.icons?.length} шт.`)
  ok(
    manifest.icons.some((i) => i.purpose === 'maskable'),
    'есть маскируемая иконка',
  )
  ok(manifest.lang === 'ru', 'язык русский')
}

// ── Шрифты действительно применились ──
const fontsReady = await page.evaluate(async () => {
  await document.fonts.ready
  const loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family)
  const h1 = document.querySelector('h1')
  return {
    families: [...new Set(loaded)],
    used: h1 ? getComputedStyle(h1).fontFamily : '',
    // кириллица не должна падать в системный шрифт
    cyrillic: h1?.textContent || '',
  }
})
ok(fontsReady.families.some((f) => /Handjet/.test(f)), 'готический пиксель загрузился', fontsReady.families.join(', '))
ok(/Handjet/.test(fontsReady.used), 'заголовок им и набран')
ok(/[А-Яа-я]/.test(fontsReady.cyrillic), 'кириллица в заголовке', fontsReady.cyrillic)

// ── Текстуры ──
// Пути относительные: приложение может жить в подпапке (GitHub Pages),
// и абсолютный /textures/... там ведёт мимо.
const textures = await page.evaluate(async () => {
  const files = ['textures/parchment.png', 'textures/wood.png', 'textures/linen.png', 'icons/icon-192.png']
  const out = {}
  for (const f of files) {
    const res = await fetch(new URL(f, document.baseURI))
    out[f] = res.ok && (res.headers.get('content-type') || '').includes('image')
  }
  return out
})
Object.entries(textures).forEach(([f, good]) => ok(good, `ассет ${f}`))

// ── Service worker ──
await page.waitForFunction(() => navigator.serviceWorker?.controller || window.__swWaited, { timeout: 8000 })
  .catch(() => {})
await wait(1500)
const sw = await page.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations()
  return { count: regs.length, active: regs.some((r) => r.active) }
})
ok(sw.count > 0 && sw.active, 'service worker зарегистрирован', `${sw.count} шт.`)

// ── Офлайн ──
await page.setOfflineMode(true)
await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
await wait(800)
const offlineOk = await page.evaluate(() => document.getElementById('root')?.children.length > 0)
ok(offlineOk, 'работает без сети')
await page.setOfflineMode(false)

// ── Ничего не сломалось по дороге ──
const realErrors = errors.filter((e) => !/favicon|Failed to load resource.*404/.test(e))
ok(realErrors.length === 0, 'консоль чистая', realErrors.join(' | ') || 'ошибок нет')

await browser.close()

console.log(fails.length ? `\n⚠ Провалено: ${fails.length}` : '\nПриёмка пройдена.')
process.exit(fails.length ? 1 : 0)
