/**
 * shots.mjs — ГЛАЗ РЕВИЗОРА
 * ------------------------------------------------------------------
 * Гоняет приложение в настоящем мобильном браузере (headless Edge/Chrome)
 * и снимает экраны: проверка вёрстки под телефон без телефона.
 *
 * Заодно подсовывает поддельный window.Telegram.WebApp — так проверяется
 * ветка Mini App: отключение свайпов, цвета хрома, тактильный отклик,
 * кнопка «назад» и облачное хранилище славы.
 *
 * Запуск:  node tools/shots.mjs [папка-вывода] [ширина] [высота]
 * Требует поднятый dev-сервер на http://localhost:5173
 */
import puppeteer from 'puppeteer-core'
import { mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const OUT = process.argv[2] || resolve(process.cwd(), 'shots')
const W = Number(process.argv[3]) || 390
const H = Number(process.argv[4]) || 844
const URL = process.env.ZONK_URL || 'http://localhost:5173'

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]

function findBrowser() {
  const found = BROWSERS.find((p) => existsSync(p))
  if (!found) throw new Error('Не нашёл Chrome или Edge для съёмки')
  return found
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** Поддельный клиент Telegram: ровно та поверхность, которой пользуется обёртка. */
function telegramStub() {
  window.__tgCalls = []
  const log = (x) => window.__tgCalls.push(x)
  window.Telegram = {
    WebApp: {
      initData: 'stub',
      initDataUnsafe: { user: { id: 1, first_name: 'Ревизор' } },
      platform: 'android',
      version: '8.0',
      colorScheme: 'dark',
      themeParams: {},
      viewportHeight: 844,
      viewportStableHeight: 844,
      safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
      contentSafeAreaInset: { top: 12, bottom: 0, left: 0, right: 0 },
      isVersionAtLeast: () => true,
      ready: () => log('ready'),
      expand: () => log('expand'),
      close: () => log('close'),
      disableVerticalSwipes: () => log('disableVerticalSwipes'),
      enableVerticalSwipes: () => {},
      setHeaderColor: (c) => log('header:' + c),
      setBackgroundColor: (c) => log('bg:' + c),
      setBottomBarColor: (c) => log('bottom:' + c),
      onEvent: () => {},
      offEvent: () => {},
      HapticFeedback: {
        impactOccurred(s) { log('haptic:' + s); return this },
        notificationOccurred(t) { log('notify:' + t); return this },
        selectionChanged() { return this },
      },
      BackButton: {
        isVisible: false,
        show: () => log('back.show'),
        hide: () => log('back.hide'),
        onClick: () => {},
        offClick: () => {},
      },
      CloudStorage: {
        _d: {},
        getItem(k, cb) { cb(null, this._d[k] ?? null); return this },
        setItem(k, v, cb) { this._d[k] = v; log('cloud.set'); cb && cb(null, true); return this },
        getItems(ks, cb) { cb(null, ks.map((k) => this._d[k] ?? null)); return this },
        removeItem(k, cb) { delete this._d[k]; cb && cb(null, true); return this },
        getKeys(cb) { cb(null, Object.keys(this._d)); return this },
      },
    },
  }
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const browser = await puppeteer.launch({
    executablePath: findBrowser(),
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      '--mute-audio',
      '--autoplay-policy=no-user-gesture-required',
    ],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  // Настоящий SDK перезаписал бы подделку и отвечал бы «версия 6.0».
  // Режем его на сетевом уровне — в тесте нужен управляемый клиент.
  await page.setRequestInterception(true)
  page.on('request', (r) =>
    r.url().includes('telegram.org') ? r.abort() : r.continue(),
  )
  await page.evaluateOnNewDocument(telegramStub)

  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    // ERR_FAILED — след нашей же блокировки telegram.org, не ошибка приложения
    if (m.type() !== 'error' || /ERR_FAILED/.test(m.text())) return
    errors.push(`console: ${m.text()}`)
  })

  await page.goto(URL, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle2' })
  await page.waitForFunction(() => !!window.__zonk, { timeout: 10000 })
  await wait(600) // дать шрифтам встать

  const shot = async (name) => {
    await wait(240)
    await page.screenshot({ path: resolve(OUT, `${name}.png`) })
    console.log(`  ✓ ${name}.png`)
  }

  /** Выполнить действие журнала и подождать перерисовку. */
  const act = async (fn, ...args) => {
    await page.evaluate((fnName, a) => window.__zonk.getState()[fnName](...a), fn, args)
    await wait(110)
  }

  const clickText = (text) =>
    page.evaluate((t) => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t)
      b?.click()
      return !!b
    }, text)

  const state = () =>
    page.evaluate(() => {
      const s = window.__zonk.getState()
      return {
        screen: s.screen,
        codexSeen: s.codexSeen,
        scores: s.players.map((p) => p.score),
        onBarrel: s.players.map((p) => !!p.barrel),
        winner: s.winnerId,
        glory: s.glory,
        pad: s.pad,
      }
    })

  const check = async (cond, what, detail = '') => {
    console.log(`  ${cond ? '✓' : '✗'} ${what}${detail ? ` — ${detail}` : ''}`)
    if (!cond) errors.push(`проверка провалена: ${what} ${detail}`)
  }

  // ── 01. Причал: якорь ещё не снять ──
  await shot('01-menu-locked')
  const anchorLocked = await page.evaluate(() =>
    [...document.querySelectorAll('button')].some(
      (b) => b.textContent.includes('СНЯТЬ ЯКОРЬ') && b.disabled,
    ),
  )
  await check(anchorLocked, 'без Кодекса якорь не снять')

  // ── 02-04. Кодекс: команда и правила ──
  await act('openCodex')
  await shot('02-codex-crew')
  await clickText('Правила')
  await wait(220)
  await shot('03-codex-rules')
  await clickText('НА ПРИЧАЛ')
  await wait(260)
  await shot('04-menu-ready')
  const st1 = await state()
  await check(st1.screen === 'menu' && st1.codexSeen, 'после Кодекса вернулись на причал')

  // ── 04b. Свод правил с отрисованными костями ──
  await act('openRules')
  await shot('04b-rules-combos')
  const diceDrawn = await page.evaluate(() => document.querySelectorAll('.die').length)
  await check(diceDrawn >= 30, 'комбинации показаны костями', `${diceDrawn} костей`)
  await page.evaluate(() => {
    const el = document.querySelector('main')
    if (el) el.scrollTop = el.scrollHeight
  })
  await shot('04c-rules-special')
  await act('toMenu')

  // ── 05. Стол ──
  await act('startGame')
  await shot('05-game-fresh')

  // ── 06. Набор золота номиналами ──
  await act('padAdd', 100)
  await act('padAdd', 25)
  await act('padAdd', 25)
  const st2 = await state()
  await check(st2.pad === '150', 'номиналы складываются', `набрано ${st2.pad}`)
  await shot('06-pad-filled')
  await act('writeScore')

  // ── 07. Крючки и рваная сеть ──
  for (let i = 0; i < 6; i++) await act('writeBolt')
  await shot('07-hooks-and-net')

  // ── 08. Бочка ловит перевалившего: 780 + 150 → 880 ──
  await page.evaluate(() => {
    const st = window.__zonk.getState()
    const players = st.players.map((p, i) =>
      i === 0
        ? { ...p, score: 780, entered: true, bolts: 0 }
        : { ...p, score: 700, entered: true, bolts: 0 },
    )
    window.__zonk.setState({ players, turnIndex: 0, entries: [] })
  })
  await act('padAdd', 100)
  await act('padAdd', 50)
  await act('writeScore')
  const st3 = await state()
  await check(st3.scores[0] === 880 && st3.onBarrel[0], 'бочка поймала', `780 + 150 → ${st3.scores[0]}`)
  await shot('08-barrel-caught')

  // ── 09. На бочке: недобор не пишется, крючок на месте ──
  await page.evaluate(() => window.__zonk.setState({ turnIndex: 0 }))
  await act('padAdd', 100)
  const padState = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const write = btns.find((b) => b.textContent.includes('ЗАПИСАТЬ') || b.textContent.includes('СУНДУК'))
    const bolt = btns.find((b) => b.textContent.includes('РЖАВЫЙ КРЮЧОК'))
    return { writeDisabled: !!write?.disabled, writeText: write?.textContent.trim(), boltVisible: !!bolt }
  })
  await check(padState.writeDisabled, 'недобор на бочке: запись заблокирована', 'набрано 100 из 120')
  await check(padState.boltVisible, 'крючок на бочке остаётся на экране')
  await shot('09-barrel-not-enough')

  // ── 10. На бочке 120+ → кнопка зовёт забрать сундук ──
  await act('padAdd', 25)
  const padWin = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('СУНДУК'))
    return { text: b?.textContent.trim(), disabled: !!b?.disabled }
  })
  await check(!!padWin.text && !padWin.disabled, 'при 125 кнопка зовёт забрать сундук', padWin.text)
  await shot('10-barrel-take-chest')

  await act('writeScore')
  const st4 = await state()
  await check(st4.scores[0] === 1000, 'лишнее за борт: счёт ровно 1000', `${st4.scores[0]}`)
  await check(!!st4.winner, 'сундук забран')
  // Сундук не обрывает партию: у соперника есть последний ход
  await check(st4.screen === 'game', 'начался последний круг', `экран ${st4.screen}`)
  await shot('11-finale')

  await act('padAdd', 50)
  await act('writeScore')
  await wait(400)
  const st5 = await state()
  await check(st5.screen === 'victory', 'после последнего круга — итоги', `экран ${st5.screen}`)
  await shot('12-victory')

  const gloryNames = Object.keys(st5.glory)
  await check(gloryNames.length > 0, 'слава записана', gloryNames.join(', '))

  // ── 12. Четверо за столом ──
  await act('toShore')
  await act('addPlayer')
  await act('addPlayer')
  await act('startGame')
  await act('padAdd', 100)
  await act('writeScore')
  await act('padAdd', 50)
  await act('writeScore')
  await act('writeBolt')
  await act('padAdd', 100)
  await act('padAdd', 100)
  await act('writeScore')
  await shot('13-four-players')

  // ── 13. Узкий экран ──
  await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await wait(320)
  await shot('14-narrow-360')
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true })

  // ── Швартовка к Telegram ──
  const tgCalls = await page.evaluate(() => window.__tgCalls || [])
  const has = (p) => tgCalls.some((c) => c.startsWith(p))
  await check(has('ready') && has('expand'), 'Telegram: ready и expand вызваны')
  await check(has('disableVerticalSwipes'), 'Telegram: вертикальные свайпы отключены')
  await check(has('header:') && has('bg:'), 'Telegram: хром покрашен под трюм')
  await check(has('haptic:') || has('notify:'), 'Telegram: тактильный отклик работает')
  await check(has('back.show'), 'Telegram: кнопка «назад» показана вне меню')
  await check(has('cloud.set'), 'Telegram: слава ушла в облако')

  const inset = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--tg-top').trim(),
  )
  await check(inset === '12px', 'Telegram: безопасные отступы применены', inset)

  // ── Звук ──
  const audioReport = await page.evaluate(async () => {
    const audio = window.__audio
    const bad = []
    if (!audio.unlock()) return { ok: false, bad: ['AudioContext не создался'] }
    for (const slot of window.__synths) {
      try {
        audio.play(slot)
      } catch (e) {
        bad.push(`${slot}: ${e.message}`)
      }
    }
    const events = Object.keys((await import('/src/audio/audioManager.js')).EVENT_MAP)
    for (const type of events) {
      try {
        audio.handle({ type, points: 350 })
      } catch (e) {
        bad.push(`event ${type}: ${e.message}`)
      }
    }
    return { ok: bad.length === 0, bad, slots: window.__synths.length, events: events.length }
  })
  await check(
    audioReport.ok,
    'звук отыгрывает без ошибок',
    audioReport.ok ? `${audioReport.slots} слотов, ${audioReport.events} событий` : audioReport.bad.join('; '),
  )

  await browser.close()

  if (errors.length) {
    console.log('\n⚠ Замечания:')
    errors.forEach((e) => console.log('   ' + e))
    process.exitCode = 1
  } else {
    console.log('\nВсё чисто: ошибок нет, проверки пройдены.')
  }
}

main().catch((e) => {
  console.error('Съёмка сорвалась:', e.message)
  process.exit(1)
})
