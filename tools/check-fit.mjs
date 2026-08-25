/**
 * check-fit.mjs — ВСЁ ЛИ ВЛЕЗЛО
 * ------------------------------------------------------------------
 * Кнопки уезжали за нижний край: внутри Telegram окно ниже, чем думает
 * браузер, а высокая шапка и пульт сжиматься не умели. Эта проверка
 * прогоняет каждый экран по списку высот — от обычного телефона до
 * совсем низкого окна — и следит, чтобы нижняя кнопка осталась в кадре.
 *
 * Кнопки внутри прокручиваемых списков не в счёт: до них доезжают
 * пальцем, и это нормально.
 *
 * Запуск: npm run dev, затем node tools/check-fit.mjs
 */
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'

const URL = process.env.ZONK_URL || 'http://localhost:5173'
const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
]
const HEIGHTS = [844, 740, 640, 560, 480, 420, 380]
const WIDTHS = [390, 320]

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []

const browser = await puppeteer.launch({
  executablePath: BROWSERS.find((p) => existsSync(p)),
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars'],
})
const page = await browser.newPage()

/** Самая нижняя кнопка, до которой нельзя доскроллить. */
const worstFixedButton = () =>
  page.evaluate(() => {
    const scrollable = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const c = getComputedStyle(p)
        if ((c.overflowY === 'auto' || c.overflowY === 'scroll') && p.scrollHeight > p.clientHeight + 2) {
          return true
        }
      }
      return false
    }
    let worst = { bottom: 0, text: '' }
    for (const b of document.querySelectorAll('button')) {
      if (!b.offsetParent) continue
      if (scrollable(b)) continue // до него доедут прокруткой
      const r = b.getBoundingClientRect()
      if (r.bottom > worst.bottom) worst = { bottom: r.bottom, text: b.textContent.trim().slice(0, 16) }
    }
    return { ...worst, vh: window.innerHeight }
  })

for (const w of WIDTHS) {
  for (const h of HEIGHTS) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await page.goto(URL, { waitUntil: 'networkidle2' })
    await page.evaluate(() => localStorage.clear())
    await page.reload({ waitUntil: 'networkidle2' })
    await page.waitForFunction(() => !!window.__zonk, { timeout: 10000 })
    await wait(400)

    const screens = [
      ['причал', () => {}],
      ['кодекс', (s) => s.openCodex()],
      ['правила', (s) => s.openRules()],
      ['стол', (s) => { s.toMenu(); s.startGame() }],
    ]

    for (const [name, act] of screens) {
      await page.evaluate((fn) => {
        // eslint-disable-next-line no-new-func
        new Function('s', `(${fn})(s)`)(window.__zonk.getState())
      }, act.toString())
      await wait(360)
      const r = await worstFixedButton()
      const over = Math.round(r.bottom - r.vh)
      if (over > 0) {
        fails.push(`${w}×${h} ${name}: «${r.text}» за краем на ${over}px`)
        console.log(`  ✗ ${w}×${h} ${name.padEnd(8)} «${r.text}» за краем на ${over}px`)
      }
    }
  }
  console.log(`  ✓ ширина ${w}: ${HEIGHTS.length} высот проверено`)
}

await browser.close()
console.log(
  fails.length
    ? `\n⚠ Кнопки вылезают в ${fails.length} случаях`
    : '\nНа всех размерах экрана нижние кнопки в кадре.',
)
process.exit(fails.length ? 1 : 0)
