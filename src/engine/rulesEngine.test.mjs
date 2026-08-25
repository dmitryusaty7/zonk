import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_SETTINGS,
  createPlayer,
  createGame,
  resolveTurn,
  advanceTurn,
  validateSettings,
  barrelNeed,
} from './rulesEngine.js'

/** Применить ход к снимку игры — мини-копия того, что делает стор. */
function apply(game, action) {
  const r = resolveTurn(game, action)
  const entries = game.entries.map((e) => (r.crossIds.includes(e.id) ? { ...e, crossed: true } : e))
  return {
    ...game,
    players: r.players,
    entries: [...entries, ...r.newEntries],
    winnerId: r.winnerId,
    lastEvents: r.events,
  }
}

const settings = (over = {}) => ({ ...structuredClone(DEFAULT_SETTINGS), ...over })

function game(n = 2, over = {}) {
  const names = ['Ян', 'Гашек', 'Радзиг', 'Кунеш']
  const marks = ['🛡️', '⚔️', '🍺', '🐗']
  const players = Array.from({ length: n }, (_, i) => createPlayer(names[i], marks[i]))
  return createGame(players, settings(over))
}

// ─────────────────────────── ПОДАТЬ ───────────────────────────

test('в общак не башлял — пишется ржавый крючок', () => {
  let g = game()
  g = apply(g, { type: 'score', points: 25 })
  assert.equal(g.players[0].score, 0)
  assert.equal(g.players[0].bolts, 1)
  assert.equal(g.entries.at(-1).type, 'bolt')
})

test('башлянул ровно 50 — игрок вписан', () => {
  let g = game()
  g = apply(g, { type: 'score', points: 50 })
  assert.equal(g.players[0].score, 50)
  assert.equal(g.players[0].entered, true)
})

// ─────────────────────────── БОЛТЫ ───────────────────────────

test('три крючка — рваная сеть и минус 100', () => {
  let g = game()
  g = apply(g, { type: 'score', points: 150 })
  g = apply(g, { type: 'bolt' })
  g = apply(g, { type: 'bolt' })
  g = apply(g, { type: 'bolt' })
  const p = g.players[0]
  assert.equal(p.score, 50, '150 - 100')
  assert.equal(p.bolts, 0, 'отсчёт начинается заново')
  const crossed = g.entries.filter((e) => e.type === 'bolt' && e.crossed)
  assert.equal(crossed.length, 3)
  assert.equal(g.entries.at(-1).type, 'boltPenalty')
  assert.equal(g.entries.at(-1).delta, -100)
})

test('удачный ход гасит накопленные крючки', () => {
  let g = game()
  g = apply(g, { type: 'bolt' })
  g = apply(g, { type: 'bolt' })
  g = apply(g, { type: 'score', points: 100 })
  assert.equal(g.players[0].bolts, 0)
  assert.equal(g.players[0].score, 100)
})

// ─────────────────────────── БОЧКА ───────────────────────────

test('точное попадание на 880 сажает на бочку', () => {
  let g = game()
  g.players[0].score = 830
  g.players[0].entered = true
  g = apply(g, { type: 'score', points: 50 })
  assert.equal(g.players[0].score, 880)
  assert.equal(g.players[0].barrel.value, 880)
  assert.equal(g.entries.at(-1).barrel, true)
})

test('перевалил за бочку — сел ровно на неё, лишнее пропало', () => {
  let g = game()
  Object.assign(g.players[0], { score: 780, entered: true })
  g = apply(g, { type: 'score', points: 150 })
  assert.equal(g.players[0].score, 880, '780 + 150 не 930, а бочка')
  assert.equal(g.players[0].barrel.value, 880)
  assert.equal(g.entries.at(-1).delta, 100, 'записана настоящая прибавка')
  assert.equal(g.entries.at(-1).barrel, true)
})

test('бочку нельзя перепрыгнуть даже точным выходом в тысячу', () => {
  let g = game()
  Object.assign(g.players[0], { score: 780, entered: true })
  g = apply(g, { type: 'score', points: 220 })
  assert.equal(g.players[0].score, 880)
  assert.equal(g.winnerId, null, 'через бочку в тысячу не заходят')
})

test('из нескольких перекрытых бочек ловит нижняя', () => {
  let g = game(2, {
    barrels: [
      { value: 880, attempts: 3, fallPenalty: 120 },
      { value: 500, attempts: 2, fallPenalty: 50 },
    ],
  })
  Object.assign(g.players[0], { score: 400, entered: true })
  g = apply(g, { type: 'score', points: 600 })
  assert.equal(g.players[0].score, 500)
  assert.equal(g.players[0].barrel.value, 500)
})

test('бочка ловит раньше перебора', () => {
  let g = game()
  Object.assign(g.players[0], { score: 800, entered: true })
  g = apply(g, { type: 'score', points: 500 })
  assert.equal(g.players[0].score, 880, 'не перебор, а бочка')
  assert.equal(g.entries.at(-1).type, 'score')
})

test('на бочке золото не пишется, пока не набрал нужное', () => {
  let g = game()
  Object.assign(g.players[0], {
    score: 880, entered: true,
    barrel: { value: 880, attempts: 3, fallPenalty: 120, used: 0 },
  })
  g = apply(g, { type: 'score', points: 100 })
  assert.equal(g.players[0].score, 880, 'счёт не изменился')
  assert.equal(g.entries.at(-1).type, 'bolt', 'сгоревший глоток — это крючок')
  assert.equal(g.players[0].barrel.used, 1)
})

test('на бочке ровно 120 — сундук наш', () => {
  let g = game()
  Object.assign(g.players[0], {
    score: 880, entered: true,
    barrel: { value: 880, attempts: 3, fallPenalty: 120, used: 0 },
  })
  g = apply(g, { type: 'score', points: 120 })
  assert.equal(g.players[0].score, 1000)
  assert.equal(g.winnerId, g.players[0].id)
})

test('на бочке больше 120 — лишнее за борт, счёт ровно 1000', () => {
  let g = game()
  Object.assign(g.players[0], {
    score: 880, entered: true,
    barrel: { value: 880, attempts: 3, fallPenalty: 120, used: 0 },
  })
  g = apply(g, { type: 'score', points: 300 })
  assert.equal(g.players[0].score, 1000, 'счёт зафиксирован на сундуке')
  assert.equal(g.entries.at(-1).delta, 120, 'записано ровно недостающее')
  assert.match(g.entries.at(-1).note, /за борт/)
  assert.equal(g.winnerId, g.players[0].id)
})

test('barrelNeed говорит интерфейсу, сколько осталось', () => {
  const g = game()
  Object.assign(g.players[0], {
    score: 880, entered: true,
    barrel: { value: 880, attempts: 3, fallPenalty: 120, used: 0 },
  })
  assert.equal(barrelNeed(g.players[0], g.settings), 120)
  assert.equal(barrelNeed(g.players[1], g.settings), 0)
})

test('три сгоревших глотка — падение с бочки', () => {
  let g = game()
  Object.assign(g.players[0], {
    score: 880, entered: true,
    barrel: { value: 880, attempts: 3, fallPenalty: 120, used: 0 },
  })
  g = apply(g, { type: 'score', points: 100, playerId: g.players[0].id })
  g = apply(g, { type: 'score', points: 100, playerId: g.players[0].id })
  g = apply(g, { type: 'score', points: 100, playerId: g.players[0].id })
  assert.equal(g.players[0].score, 760)
  assert.equal(g.players[0].barrel, null)
  assert.equal(g.entries.at(-1).type, 'barrelFall')
})

test('крючок на бочке сжигает глоток и не копится в сеть', () => {
  let g = game()
  Object.assign(g.players[0], {
    score: 880, entered: true,
    barrel: { value: 880, attempts: 3, fallPenalty: 120, used: 0 },
  })
  g = apply(g, { type: 'bolt' })
  assert.equal(g.players[0].barrel.used, 1, 'глоток сгорел')
  assert.equal(g.players[0].bolts, 0, 'в рваную сеть на бочке крючки не идут')
  assert.equal(g.entries.at(-1).type, 'bolt')
})

test('на бочке три крючка не рвут сеть — только падение по настройке', () => {
  let g = game()
  Object.assign(g.players[0], {
    score: 880, entered: true,
    barrel: { value: 880, attempts: 3, fallPenalty: 120, used: 0 },
  })
  g = apply(g, { type: 'bolt', playerId: g.players[0].id })
  g = apply(g, { type: 'bolt', playerId: g.players[0].id })
  g = apply(g, { type: 'bolt', playerId: g.players[0].id })
  assert.equal(g.players[0].score, 760, '880 - 120, и ни копейки сверх')
  assert.ok(
    !g.entries.some((e) => e.type === 'boltPenalty'),
    'рваной сети на бочке быть не должно',
  )
  assert.equal(g.entries.at(-1).type, 'barrelFall')
  assert.equal(g.entries.at(-1).delta, -120)
})

test('при игре вдвоём соперник не может скинуть с бочки', () => {
  let g = game(2)
  Object.assign(g.players[0], {
    score: 880, entered: true,
    barrel: { value: 880, attempts: 3, fallPenalty: 120, used: 0 },
  })
  Object.assign(g.players[1], { score: 830, entered: true })
  g = apply(g, { type: 'score', points: 50, playerId: g.players[1].id })
  assert.equal(g.players[0].score, 880, 'сидящий остался на бочке')
  assert.ok(g.players[0].barrel, 'бочка под ним цела')
  assert.equal(g.players[1].barrel.value, 880, 'второй тоже сел')
})

test('втроём — соперник скидывает с бочки', () => {
  let g = game(3)
  Object.assign(g.players[0], {
    score: 880, entered: true,
    barrel: { value: 880, attempts: 3, fallPenalty: 120, used: 0 },
  })
  Object.assign(g.players[1], { score: 830, entered: true })
  g = apply(g, { type: 'score', points: 50, playerId: g.players[1].id })
  assert.equal(g.players[0].score, 760)
  assert.equal(g.players[0].barrel, null)
  assert.ok(g.entries.some((e) => e.type === 'knockOff'))
})

test('можно поставить несколько бочек', () => {
  let g = game(2, {
    barrels: [
      { value: 880, attempts: 3, fallPenalty: 120 },
      { value: 500, attempts: 2, fallPenalty: 50 },
    ],
  })
  Object.assign(g.players[0], { score: 450, entered: true })
  g = apply(g, { type: 'score', points: 50 })
  assert.equal(g.players[0].barrel.value, 500)
  assert.equal(g.players[0].barrel.attempts, 2)
})

// ─────────────────────── РАЗБИТАЯ ТЕЛЕГА ───────────────────────

test('ровно 555 — лодка дырявая, счёт в ноль', () => {
  let g = game()
  Object.assign(g.players[0], { score: 505, entered: true })
  g = apply(g, { type: 'score', points: 50 })
  assert.equal(g.players[0].score, 0)
  assert.equal(g.entries.at(-1).type, 'wagon')
  assert.equal(g.entries.at(-1).delta, -555)
})

// ─────────────────────── УДАР В СПИНУ ───────────────────────

test('сравнялся с соперником — тот теряет 50 золота', () => {
  let g = game()
  Object.assign(g.players[0], { score: 300, entered: true })
  Object.assign(g.players[1], { score: 150, entered: true })
  g = apply(g, { type: 'score', points: 150, playerId: g.players[1].id })
  assert.equal(g.players[1].score, 300, 'встал ровно на чужое число')
  assert.equal(g.players[0].score, 250, '300 - 50')
  assert.ok(g.entries.some((e) => e.type === 'backstab'))
})

test('обгон без равенства больше не наказывается', () => {
  let g = game()
  Object.assign(g.players[0], { score: 300, entered: true })
  Object.assign(g.players[1], { score: 150, entered: true })
  g = apply(g, { type: 'score', points: 200, playerId: g.players[1].id })
  assert.equal(g.players[1].score, 350, 'обошёл соперника')
  assert.equal(g.players[0].score, 300, 'но тот ничего не потерял')
  assert.ok(!g.entries.some((e) => e.type === 'backstab'))
})

test('равенство бьёт сразу нескольких', () => {
  let g = game(3)
  Object.assign(g.players[0], { score: 400, entered: true })
  Object.assign(g.players[1], { score: 400, entered: true })
  Object.assign(g.players[2], { score: 300, entered: true })
  g = apply(g, { type: 'score', points: 100, playerId: g.players[2].id })
  assert.equal(g.players[2].score, 400)
  assert.equal(g.players[0].score, 350)
  assert.equal(g.players[1].score, 350)
})

test('сброшенного с бочки не бьют ещё и за равенство', () => {
  let g = game(3)
  Object.assign(g.players[0], {
    score: 880, entered: true,
    barrel: { value: 880, attempts: 3, fallPenalty: 120, used: 0 },
  })
  Object.assign(g.players[1], { score: 830, entered: true })
  g = apply(g, { type: 'score', points: 50, playerId: g.players[1].id })
  // только падение с бочки: 880 - 120, без дополнительных -50
  assert.equal(g.players[0].score, 760)
  assert.ok(!g.entries.some((e) => e.type === 'backstab'))
})

test('игрока на нуле не бьют в спину', () => {
  let g = game()
  g = apply(g, { type: 'score', points: 100 })
  assert.equal(g.players[1].score, 0)
  assert.ok(!g.entries.some((e) => e.type === 'backstab'))
})

// ─────────────────────── ШАГ СЧЁТА ───────────────────────

test('запись притягивается к шагу в пять золота', () => {
  let g = game()
  g = apply(g, { type: 'score', points: 123 })
  assert.equal(g.players[0].score, 125)
  assert.equal(g.entries.at(-1).delta, 125)
})

test('нельзя поставить бочку на число не кратное шагу', () => {
  const errs = validateSettings(settings({ barrels: [{ value: 883, attempts: 3, fallPenalty: 120 }] }))
  assert.ok(errs.some((e) => /делиться на 5/.test(e)))
})

// ─────────────────────── ПЕРЕБОР И ПОБЕДА ───────────────────────

test('перебор сгорает, счёт не меняется', () => {
  let g = game()
  Object.assign(g.players[0], { score: 900, entered: true })
  g = apply(g, { type: 'score', points: 150 })
  assert.equal(g.players[0].score, 900)
  assert.equal(g.entries.at(-1).type, 'overshoot')
  assert.equal(g.winnerId, null)
})

test('ровно 1000 — победа', () => {
  let g = game()
  Object.assign(g.players[0], { score: 900, entered: true })
  g = apply(g, { type: 'score', points: 100 })
  assert.equal(g.winnerId, g.players[0].id)
})

test('без точного финиша побеждает перебор', () => {
  let g = game(2, { exactFinish: false })
  Object.assign(g.players[0], { score: 900, entered: true })
  g = apply(g, { type: 'score', points: 150 })
  assert.equal(g.players[0].score, 1050)
  assert.equal(g.winnerId, g.players[0].id)
})

// ─────────────────────── СУД КОРЧМАРЯ ───────────────────────

test('кость за борт по умолчанию — крючок', () => {
  let g = game()
  g = apply(g, { type: 'foul', foul: 'mud' })
  assert.equal(g.players[0].bolts, 1)
  assert.equal(g.entries.at(-1).type, 'bolt')
  assert.match(g.entries.at(-1).note, /за борт/)
})

test('кривой штурвал — один крючок, золото не трогает', () => {
  let g = game()
  Object.assign(g.players[0], { score: 300, entered: true })
  g = apply(g, { type: 'foul', foul: 'crooked' })
  assert.equal(g.players[0].score, 300, 'золото на месте')
  assert.equal(g.players[0].bolts, 1, 'ровно один крючок')
  assert.equal(g.entries.at(-1).type, 'bolt')
  assert.match(g.entries.at(-1).note, /штурвал/)
})

test('кость за борт на бочке жжёт глоток, а не золото', () => {
  let g = game()
  Object.assign(g.players[0], {
    score: 880, entered: true,
    barrel: { value: 880, attempts: 3, fallPenalty: 120, used: 0 },
  })
  g = apply(g, { type: 'foul', foul: 'mud' })
  assert.equal(g.players[0].score, 880)
  assert.equal(g.players[0].barrel.used, 1)
  assert.equal(g.players[0].bolts, 0)
})

test('счёт не уходит в минус, если так велено настройками', () => {
  let g = game(2, { allowNegative: false })
  // три крючка подряд рвут сеть на -100, но ниже нуля не пускают
  g = apply(g, { type: 'foul', foul: 'mud', playerId: g.players[0].id })
  g = apply(g, { type: 'foul', foul: 'mud', playerId: g.players[0].id })
  g = apply(g, { type: 'foul', foul: 'mud', playerId: g.players[0].id })
  assert.equal(g.players[0].score, 0)
})

// ─────────────────────── ПОРЯДОК ХОДОВ ───────────────────────

test('ход переходит по кругу, круг растёт', () => {
  let g = game(3)
  assert.deepEqual(advanceTurn(g), { turnIndex: 1, round: 1 })
  g = { ...g, turnIndex: 2 }
  assert.deepEqual(advanceTurn(g), { turnIndex: 0, round: 2 })
})

// ─────────────────────── ПРОВЕРКА НАСТРОЕК ───────────────────────

test('нельзя поставить бочку на цель', () => {
  const errs = validateSettings(settings({ barrels: [{ value: 1000, attempts: 3, fallPenalty: 120 }] }))
  assert.ok(errs.length > 0)
})

test('нельзя поставить две бочки на одно значение', () => {
  const errs = validateSettings(settings({
    barrels: [
      { value: 880, attempts: 3, fallPenalty: 120 },
      { value: 880, attempts: 3, fallPenalty: 120 },
    ],
  }))
  assert.ok(errs.some((e) => /одном значении/.test(e)))
})

test('настройки по умолчанию законны', () => {
  assert.deepEqual(validateSettings(DEFAULT_SETTINGS), [])
})
