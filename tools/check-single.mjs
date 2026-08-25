/**
 * check-single.mjs — ПРИЁМКА ОДНОГО ЛИСТА
 * ------------------------------------------------------------------
 * Открывает zonk.html так, как это сделает телефон: по file://,
 * без сервера и без сети. Проверяет, что шрифты применились, текстуры
 * на месте, игра запускается и счёт пишется.
 *
 * Запуск:  node tools/build-single.mjs && node tools/check-single.mjs
 */
import puppeteer from 'puppeteer-core'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FILE = resolve(ROOT, 'zonk.html')
const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]

if (!existsSync(FILE)) {
  console.error('Нет zonk.html — сначала npm run build && node tools/build-single.mjs')
  process.exit(1)
}

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
// сеть должна быть не нужна вовсе
const network = []
page.on('request', (r) => !r.url().startsWith('file:') && !r.url().startsWith('data:') && network.push(r.url()))

console.log(`Приёмка одного листа: ${FILE}\n`)
await page.goto(pathToFileURL(FILE).href, { waitUntil: 'networkidle2' })
await wait(700)

ok(await page.evaluate(() => document.getElementById('root')?.children.length > 0), 'приложение отрисовалось по file://')

const fonts = await page.evaluate(async () => {
  await document.fonts.ready
  const h1 = document.querySelector('h1')
  return {
    loaded: [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family))],
    used: h1 ? getComputedStyle(h1).fontFamily : '',
    text: h1?.textContent || '',
  }
})
ok(fonts.loaded.some((f) => /Handjet/.test(f)), 'пиксельные шрифты вшиты и загрузились', fonts.loaded.join(', '))
ok(/Handjet/.test(fonts.used) && /[А-Я]/.test(fonts.text), 'кириллица набрана ими', fonts.text)

// Читаем сам файл: ни одной ссылки наружу остаться не должно
const raw = readFileSync(FILE, 'utf8')
const leftovers = [...raw.matchAll(/url\((\/[^)"']+|\.\.\/[^)"']+)\)/g)].map((m) => m[1])
ok(leftovers.length === 0, 'ни одной ссылки на внешний файл', leftovers.slice(0, 3).join(', ') || 'все вшиты')
ok(raw.includes('data:image/png;base64'), 'текстуры вшиты как data:')
ok(raw.includes('data:font/woff2;base64'), 'шрифты вшиты как data:')

// ── Живая проверка: пройти путь игрока целиком ──
const click = (text) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t))
    b?.click()
    return !!b
  }, text)

await click('Кодекс Бухты')
await wait(350)
ok(await page.evaluate(() => document.body.innerText.includes('Команда')), 'Кодекс открылся')

await click('НА ПРИЧАЛ')
await wait(350)
await click('СНЯТЬ ЯКОРЬ')
await wait(450)
ok(
  await page.evaluate(() =>
    [...document.querySelectorAll('button')].some((b) => b.textContent.includes('ЗАПИСАТЬ')),
  ),
  'партия началась',
)

// набираем 150 номиналами: 100 + 50
await click('+100')
await wait(150)
await click('+50')
await wait(250)
ok(await page.evaluate(() => document.body.innerText.includes('150')), 'номиналы складываются в табло')

await click('ЗАПИСАТЬ')
await wait(500)
const wrote = await page.evaluate(() => {
  const scroll = document.querySelector('[aria-label^="Свиток игрока"]')
  return scroll ? scroll.innerText.includes('150') : false
})
ok(wrote, 'золото записалось в свиток')

// ── Память между запусками ──
const stored = await page.evaluate(() => !!localStorage.getItem('zonk-bay'))
ok(stored, 'партия сохраняется в память телефона')

ok(network.length === 0, 'ни одного обращения в сеть', network.slice(0, 3).join(', ') || 'сеть не нужна')

const real = errors.filter((e) => !/favicon/i.test(e))
ok(real.length === 0, 'консоль чистая', real.join(' | ') || 'ошибок нет')

await page.screenshot({ path: resolve(ROOT, 'single-check.png') })
await browser.close()

console.log(fails.length ? `\n⚠ Провалено: ${fails.length}` : '\nОдин лист работает без сервера и без сети.')
process.exit(fails.length ? 1 : 0)
