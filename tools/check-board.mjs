/**
 * check-board.mjs — СТОЛ НА ЧЕТВЕРЫХ
 * ------------------------------------------------------------------
 * Отдельная проверка того, что за большим столом видно, чей ход:
 * подсвечен ровно один свиток и стол сам подкручивается к нему,
 * даже когда игрок четвёртый и за краем экрана.
 *
 * Запуск: npm run dev, затем node tools/check-board.mjs
 */
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = process.argv[2] || ROOT
const URL = process.env.ZONK_URL || 'http://localhost:5173'
const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
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
await page.goto(URL, { waitUntil: 'networkidle2' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle2' })
await page.waitForFunction(() => !!window.__zonk, { timeout: 10000 })
await wait(600)

const act = async (fn, ...args) => {
  await page.evaluate((n, a) => window.__zonk.getState()[n](...a), fn, args)
  await wait(160)
}

// Собираем стол на четверых и доводим ход до последнего игрока
await act('openCodex')
await act('addPlayer')
await act('addPlayer')
await act('toMenu')
await act('startGame')

const look = () =>
  page.evaluate(() => {
    const board = document.querySelector('[aria-label="Свитки игроков"]')
    const active = document.querySelector('.active-scroll')
    const col = active?.parentElement
    const bb = board.getBoundingClientRect()
    const cb = col?.getBoundingClientRect()
    return {
      turnIndex: window.__zonk.getState().turnIndex,
      activeCount: document.querySelectorAll('.active-scroll').length,
      inView: cb ? cb.left >= bb.left - 3 && cb.right <= bb.right + 3 : false,
      scrollLeft: Math.round(board.scrollLeft),
      scrollable: board.scrollWidth > board.clientWidth + 4,
    }
  })

const start = await look()
ok(start.scrollable, 'на четверых стол шире экрана', `${start.scrollLeft}px прокрутки`)
ok(start.activeCount === 1, 'подсвечен ровно один свиток')

// Проходим по кругу и на каждом ходу смотрим, довёл ли стол взгляд до игрока
for (let turn = 1; turn <= 3; turn++) {
  await act('padAdd', 50)
  await act('writeScore')
  await wait(700) // плавная прокрутка
  const v = await look()
  ok(
    v.inView && v.activeCount === 1,
    `ход игрока №${v.turnIndex + 1}: свиток подкручен в кадр`,
    `scrollLeft ${v.scrollLeft}px`,
  )
}

await page.screenshot({ path: resolve(OUT, 'four-players-active.png') })
await browser.close()

console.log(fails.length ? `\n⚠ Провалено: ${fails.length}` : '\nСтол на четверых ведёт себя правильно.')
process.exit(fails.length ? 1 : 0)
