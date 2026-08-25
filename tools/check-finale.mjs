/**
 * check-finale.mjs — ПОСЛЕДНИЙ КРУГ
 * ------------------------------------------------------------------
 * Взятый сундук больше не обрывает партию. Проверяем, что:
 *   — после победы игра продолжается, а в балке горит «последний круг»;
 *   — каждый из остальных получает ровно один ход, не больше;
 *   — успевший догнать тоже становится победителем;
 *   — первым в итогах помечается тот, кто дошёл раньше;
 *   — слава засчитывает победу обоим.
 *
 * Запуск: npm run dev, затем node tools/check-finale.mjs
 */
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'

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

const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.goto(URL, { waitUntil: 'networkidle2' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle2' })
await page.waitForFunction(() => !!window.__zonk, { timeout: 10000 })
await wait(500)

const act = async (fn, ...args) => {
  await page.evaluate((n, a) => window.__zonk.getState()[n](...a), fn, args)
  await wait(140)
}
const state = () =>
  page.evaluate(() => {
    const s = window.__zonk.getState()
    return {
      screen: s.screen,
      finaleLeft: s.finaleLeft,
      winnerId: s.winnerId,
      winners: s.winners,
      names: s.players.map((p) => p.name),
      scores: s.players.map((p) => p.score),
      turnIndex: s.turnIndex,
      glory: s.glory,
    }
  })

// Стол на троих
await act('openCodex')
await act('addPlayer')
await act('toMenu')
await act('startGame')

// Первый садится на бочку и берёт сундук
await page.evaluate(() => {
  const st = window.__zonk.getState()
  const players = st.players.map((p, i) =>
    i === 0
      ? {
          ...p,
          score: 880,
          entered: true,
          barrel: { value: 880, attempts: 3, fallPenalty: 120, used: 0 },
        }
      : { ...p, score: 700, entered: true },
  )
  window.__zonk.setState({ players, turnIndex: 0 })
})
await act('padAdd', 100)
await act('padAdd', 25)
await act('writeScore')

const afterWin = await state()
ok(afterWin.screen === 'game', 'сундук не обрывает партию', `экран ${afterWin.screen}`)
ok(afterWin.finaleLeft === 2, 'последний круг: по ходу каждому из двоих', `осталось ${afterWin.finaleLeft}`)
ok(afterWin.winners.length === 1, 'первый победитель записан', afterWin.names[0])
ok(afterWin.scores[0] === 1000, 'лишнее за борт', `${afterWin.scores[0]}`)

const banner = await page.evaluate(() => document.body.innerText.includes('ПОСЛЕДНИЙ КРУГ'))
ok(banner, 'в балке горит «последний круг»')

// Второй тоже добирает до сундука
await page.evaluate(() => {
  const st = window.__zonk.getState()
  const players = st.players.map((p, i) => (i === 1 ? { ...p, score: 900, entered: true } : p))
  window.__zonk.setState({ players })
})
await act('padAdd', 100)
await act('writeScore')

const mid = await state()
ok(mid.screen === 'game', 'после второй победы круг ещё не закончен')
ok(mid.winners.length === 2, 'догнавший тоже победитель', mid.winners.length + ' шт.')
ok(mid.finaleLeft === 1, 'остался один ход', `осталось ${mid.finaleLeft}`)

// Третий доигрывает свой последний ход
await act('padAdd', 50)
await act('writeScore')
await wait(400)

const end = await state()
ok(end.screen === 'victory', 'после последнего хода — итоги', `экран ${end.screen}`)
ok(end.winners.length === 2, 'победителей двое')
ok(end.winnerId === end.winners[0], 'первым помечен тот, кто дошёл раньше')

const marks = await page.evaluate(() => ({
  first: document.body.innerText.includes('ПЕРВЫЙ'),
  also: document.body.innerText.includes('УСПЕЛ'),
  shared: document.body.innerText.includes('СУНДУК ДЕЛЯТ'),
}))
ok(marks.first, 'в итогах есть пометка «ПЕРВЫЙ»')
ok(marks.also, 'догнавший помечен «УСПЕЛ»')
ok(marks.shared, 'заголовок говорит о делёжке')

const glory = end.glory
const wins = Object.values(glory).filter((g) => g.wins > 0).length
ok(wins === 2, 'слава засчитала победу обоим', `${wins} из ${Object.keys(glory).length}`)

// Больше ходов не принимаем
await act('padAdd', 100)
await act('writeScore')
const after = await state()
ok(after.screen === 'victory', 'после итогов ходы не пишутся')

await browser.close()

const real = errors.filter((e) => !/favicon/i.test(e))
ok(real.length === 0, 'консоль чистая', real.join(' | ') || 'ошибок нет')

console.log(fails.length ? `\n⚠ Провалено: ${fails.length}` : '\nПоследний круг работает по уговору.')
process.exit(fails.length ? 1 : 0)
