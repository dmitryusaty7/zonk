/**
 * rulesEngine.js — КОДЕКС БУХТЫ
 * ------------------------------------------------------------------
 * Вся математика игры «1000» живёт здесь. Модуль абсолютно чистый:
 * никаких React, Zustand, DOM. На вход — снимок игры и действие,
 * на выход — новые игроки, новые записи в свитках и список событий
 * (события нужны звуку и всплывающим воплям кабатчика).
 *
 * Ни одна функция не мутирует переданные объекты.
 */

// ────────────────────────────── НАСТРОЙКИ ──────────────────────────────

export const DEFAULT_SETTINGS = {
  /** Победа. Классика — ровно 1000. */
  targetScore: 1000,
  /** true — выигрыш только точным попаданием, перебор сгорает. */
  exactFinish: true,

  /** «Общак» — сколько нужно взять за ход, чтобы вписаться в свиток. */
  entryScore: 50,
  /** Провал общака пишется ржавым крючком (иначе — пустая строка). */
  entryFailIsBolt: true,

  /**
   * «Бочки с пойлом». Базовая — 880.
   * Можно добавлять сколько угодно бочек на других значениях.
   *   value       — на каком числе стоит бочка
   *   attempts    — сколько глотков (попыток) даётся
   *   fallPenalty — сколько золота снимут при падении
   */
  barrels: [{ value: 880, attempts: 3, fallPenalty: 120 }],
  /** Соперник, вставший на ту же бочку, спихивает сидящего. */
  barrelKnockOff: true,
  /** ...но при игре вдвоём — не может (обычай бухты). */
  barrelKnockOffInDuel: false,

  /** «Дырявая лодка»: точное попадание на 555 сбрасывает счёт. */
  wagon: { enabled: true, value: 555, resetTo: 0 },

  /** «Уловы» (стриты на трёх костях). */
  streets: { small: 125, big: 250 },

  /**
   * «Удар в спину» — встал на то же число, что и соперник.
   * Не обогнал, а сравнялся: соперник за это теряет златые.
   */
  backstab: { enabled: true, penalty: 50 },

  /**
   * Шаг счёта. В кабаке все числа кратны пяти — что бы ни ввели,
   * движок притянет запись к ближайшему допустимому значению.
   */
  scoreStep: 5,

  /** «Ржавые крючки» — накопил 3, рваная сеть и списание. */
  bolts: { perPenalty: 3, penalty: 100 },

  /**
   * Суд Хозяина Бухты. Наказание одно и то же — один ржавый крючок.
   * Снимать золото за кривой бросок в Бухте не принято.
   */
  fouls: {
    mud: { label: 'Кость за борт' },
    crooked: { label: 'Кривой штурвал' },
  },

  /**
   * Пускать ли счёт ниже нуля.
   * По обычаю Бухты — нет: за столом долгов не пишут, ноль так ноль.
   */
  allowNegative: false,
}

// ────────────────────────────── ИГРОКИ ──────────────────────────────

let seq = 0
const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`

export function createPlayer(name, emblem) {
  return {
    id: uid('p'),
    name,
    emblem,
    score: 0,
    /** сколько грязных болтов висит непогашенными */
    bolts: 0,
    /** вписан ли в летопись (прошёл «подать») */
    entered: false,
    /** сидит ли на бочке: { value, attempts, fallPenalty, used } */
    barrel: null,
    /** статистика для итогового свитка */
    stats: { turns: 0, bolts: 0, best: 0, penalties: 0, backstabs: 0 },
  }
}

export function createGame(players, settings = DEFAULT_SETTINGS) {
  return {
    settings,
    players,
    entries: [],
    turnIndex: 0,
    round: 1,
    winnerId: null,
  }
}

// ────────────────────────────── ХЕЛПЕРЫ ──────────────────────────────

/** Притянуть число к шагу счёта: 123 при шаге 5 станет 125. */
export function snap(value, step = 5) {
  if (!step || step < 1) return Math.round(value)
  return Math.round(value / step) * step
}

/** Сколько золота нужно за ход, чтобы сойти с бочки к сундуку. */
export function barrelNeed(player, settings) {
  return player?.barrel ? settings.targetScore - player.score : 0
}

export function findBarrel(settings, value) {
  return settings.barrels.find((b) => b.value === value) || null
}

export function isBarrelValue(settings, value) {
  return settings.barrels.some((b) => b.value === value)
}

function clampScore(score, settings) {
  return settings.allowNegative ? score : Math.max(0, score)
}

function knockOffAllowed(settings, playerCount) {
  if (!settings.barrelKnockOff) return false
  // При игре вдвоём противник не может скинуть игрока с бочки.
  if (playerCount <= 2) return settings.barrelKnockOffInDuel
  return true
}

/** Последние N неперечёркнутых болтов игрока — их зачеркнёт кровавый крест. */
function lastOpenBolts(entries, playerId, n) {
  const out = []
  for (let i = entries.length - 1; i >= 0 && out.length < n; i--) {
    const e = entries[i]
    if (e.playerId === playerId && e.type === 'bolt' && !e.crossed) out.unshift(e.id)
  }
  return out
}

// ────────────────────────────── ЯДРО ──────────────────────────────

/**
 * Разрешить ход.
 *
 * @param {object} game   снимок { settings, players, entries, turnIndex, round, winnerId }
 * @param {object} action { type: 'score'|'bolt'|'foul', points?, foul?, playerId?, note? }
 * @returns {{ players, newEntries, crossIds, events, winnerId }}
 */
export function resolveTurn(game, action) {
  const { settings } = game
  const players = game.players.map((p) => ({ ...p, stats: { ...p.stats } }))
  const idx = action.playerId
    ? players.findIndex((p) => p.id === action.playerId)
    : game.turnIndex
  const me = players[idx]
  if (!me) {
    return { players: game.players, newEntries: [], crossIds: [], events: [], winnerId: game.winnerId }
  }

  const newEntries = []
  const crossIds = []
  const events = []
  let winnerId = game.winnerId
  const round = game.round

  // Счёт соперников на начало хода. Равенство считается только по нему.
  const scoresBefore = new Map(players.map((p) => [p.id, p.score]))
  // Кого уже сбросили с бочки этим ходом — второй раз за тот же ход не бьём.
  const knockedOff = new Set()

  const push = (playerId, type, delta, extra = {}) => {
    const target = players.find((p) => p.id === playerId)
    const entry = {
      id: uid('e'),
      playerId,
      round,
      type,
      delta,
      total: target ? target.score : 0,
      crossed: false,
      barrel: false,
      note: '',
      ts: Date.now(),
      ...extra,
    }
    newEntries.push(entry)
    return entry
  }

  me.stats.turns += 1

  /**
   * Сжечь глоток на бочке.
   *
   * Пока игрок сидит на бочке, промах — это тот же ржавый крючок,
   * но в рваную сеть он НЕ идёт: второго счётчика на бочке нет.
   * Расплата ровно одна — падение с бочки, когда глотки кончатся,
   * и её размер берётся из настроек бочки.
   */
  function burnBarrelAttempt(note) {
    if (!me.barrel) return
    const attempts = me.barrel.attempts
    const used = me.barrel.used + 1
    me.barrel = { ...me.barrel, used }
    me.stats.bolts += 1
    push(me.id, 'bolt', 0, { note: note || `Глоток ${used} из ${attempts}` })
    events.push({ type: 'barrelMiss', playerId: me.id })

    if (used >= attempts) {
      const penalty = me.barrel.fallPenalty
      me.score = clampScore(me.score - penalty, settings)
      me.barrel = null
      me.stats.penalties += 1
      push(me.id, 'barrelFall', -penalty, { note: 'Глотки кончились' })
      events.push({ type: 'barrelFall', playerId: me.id })
    }
  }

  /** Записать ржавый крючок. На бочке счёт ведут глотки, а не сеть. */
  const writeBolt = (note) => {
    if (me.barrel) {
      burnBarrelAttempt(note)
      return
    }

    me.bolts += 1
    me.stats.bolts += 1
    push(me.id, 'bolt', 0, { note })
    events.push({ type: 'bolt', playerId: me.id })

    if (settings.bolts.perPenalty > 0 && me.bolts >= settings.bolts.perPenalty) {
      const ids = lastOpenBolts([...game.entries, ...newEntries], me.id, settings.bolts.perPenalty)
      crossIds.push(...ids)
      newEntries.forEach((e) => {
        if (ids.includes(e.id)) e.crossed = true
      })
      me.score = clampScore(me.score - settings.bolts.penalty, settings)
      me.bolts = 0
      me.stats.penalties += 1
      push(me.id, 'boltPenalty', -settings.bolts.penalty, {
        note: `${settings.bolts.perPenalty} крючка — сеть рвётся`,
      })
      events.push({ type: 'boltPenalty', playerId: me.id })
    }
  }

  // ─── СУД ХОЗЯИНА БУХТЫ ───
  // Кость за борт и кривой штурвал стоят ровно один крючок — не больше.
  if (action.type === 'foul') {
    const label = settings.fouls[action.foul]?.label || 'Провинность'
    events.push({ type: 'foul', playerId: me.id, foul: action.foul })
    writeBolt(label)
    return { players, newEntries, crossIds, events, winnerId }
  }

  const points = action.type === 'bolt' ? 0 : snap(Number(action.points) || 0, settings.scoreStep)

  // ─── РЖАВЫЙ БОЛТ ───
  if (points <= 0) {
    writeBolt(action.note || '')
    return { players, newEntries, crossIds, events, winnerId }
  }

  // ─── ПОДАТЬ (вход в игру) ───
  if (!me.entered && points < settings.entryScore) {
    events.push({ type: 'noEntry', playerId: me.id, points })
    if (settings.entryFailIsBolt) {
      writeBolt(`В общак не башлял (${points})`)
    } else {
      push(me.id, 'noEntry', 0, { note: `В общак не башлял (${points})` })
      burnBarrelAttempt('Подать не взята')
    }
    return { players, newEntries, crossIds, events, winnerId }
  }

  // ─── ИГРОК СИДИТ НА БОЧКЕ ───
  // Пока сидишь — золото не пишется. Уйти можно только к сундуку.
  if (me.barrel) {
    // Сойти с бочки можно, набрав нужное ИЛИ БОЛЬШЕ за один ход.
    // Всё, что сверх, — за борт: счёт фиксируется ровно на сундуке.
    const need = settings.targetScore - me.score
    if (points >= need) {
      me.score = settings.targetScore
      me.barrel = null
      me.entered = true
      me.stats.best = Math.max(me.stats.best, need)
      push(me.id, 'score', need, {
        note: points > need ? `Сундук! Лишние ${points - need} за борт` : 'Сундук!',
      })
      winnerId = me.id
      events.push({ type: 'win', playerId: me.id })
      return { players, newEntries, crossIds, events, winnerId }
    }
    burnBarrelAttempt(`Мимо: ${points} из ${need}`)
    return { players, newEntries, crossIds, events, winnerId }
  }

  // ─── ОБЫЧНАЯ ЗАПИСЬ ───
  const before = me.score
  const raw = before + points

  /*
   * БОЧКА ЛОВИТ ПЕРВОЙ.
   * Перепрыгнуть бочку нельзя: кто дошёл до её числа или перевалил за него —
   * садится ровно на бочку, лишнее пропадает. Было 780, выбросил 150 —
   * не 930, а 880 и на бочку. Если за ход перекрыто сразу несколько бочек,
   * ловит самая нижняя.
   */
  const caught =
    settings.barrels
      .filter((b) => before < b.value && raw >= b.value)
      .sort((a, b) => a.value - b.value)[0] || null

  // Перебор — ход сгорает. Но только если по пути не стояла бочка.
  if (!caught && settings.exactFinish && raw > settings.targetScore) {
    push(me.id, 'overshoot', 0, { note: `Перебор (${raw})` })
    events.push({ type: 'overshoot', playerId: me.id, would: raw })
    return { players, newEntries, crossIds, events, winnerId }
  }

  const after = caught ? caught.value : raw
  const gain = after - before

  me.score = after
  me.entered = true
  me.bolts = 0 // удачный ход гасит накопленные болты
  me.stats.best = Math.max(me.stats.best, gain)

  // Победа
  if (!caught && after >= settings.targetScore) {
    push(me.id, 'score', gain, { note: 'Главный Сундук!' })
    winnerId = me.id
    events.push({ type: 'win', playerId: me.id })
    return { players, newEntries, crossIds, events, winnerId }
  }

  // Дырявая лодка (555)
  if (!caught && settings.wagon.enabled && after === settings.wagon.value) {
    push(me.id, 'score', gain)
    const lost = after - settings.wagon.resetTo
    me.score = settings.wagon.resetTo
    me.stats.penalties += 1
    push(me.id, 'wagon', -lost, { note: 'Дно пробито' })
    events.push({ type: 'wagon', playerId: me.id })
    return { players, newEntries, crossIds, events, winnerId }
  }

  // Бочка
  const barrelDef = caught
  const scoreEntry = push(me.id, 'score', gain, { barrel: !!barrelDef })

  if (barrelDef) {
    me.barrel = {
      value: barrelDef.value,
      attempts: barrelDef.attempts,
      fallPenalty: barrelDef.fallPenalty,
      used: 0,
    }
    scoreEntry.note =
      raw > barrelDef.value
        ? `Бочка ${barrelDef.value} · бросок ${points}`
        : `Бочка ${barrelDef.value}`
    events.push({ type: 'barrelSit', playerId: me.id, value: barrelDef.value })

    if (knockOffAllowed(settings, players.length)) {
      players.forEach((o) => {
        if (o.id === me.id || !o.barrel || o.barrel.value !== barrelDef.value) return
        const pen = o.barrel.fallPenalty
        o.score = clampScore(o.score - pen, settings)
        o.barrel = null
        o.stats.penalties += 1
        knockedOff.add(o.id)
        push(o.id, 'knockOff', -pen, { note: `Спихнут с бочки ${barrelDef.value}` })
        events.push({ type: 'knockOff', playerId: o.id, byId: me.id })
      })
    }
  }

  // ─── УДАР В СПИНУ ───
  // Срабатывает на равенстве: встал на то же число, что и соперник —
  // соперник платит. Обгон сам по себе безнаказан.
  if (settings.backstab.enabled) {
    players.forEach((o) => {
      // Сидящего на бочке это правило не трогает: за бочку отвечает
      // сброс, а он вдвоём запрещён. Иначе запрет обходился бы боком.
      if (o.id === me.id || knockedOff.has(o.id) || o.barrel) return
      const oBefore = scoresBefore.get(o.id)
      if (oBefore > 0 && me.score === oBefore) {
        o.score = clampScore(o.score - settings.backstab.penalty, settings)
        o.stats.penalties += 1
        me.stats.backstabs += 1
        push(o.id, 'backstab', -settings.backstab.penalty, { note: `Сравнялся: ${me.name}` })
        events.push({ type: 'backstab', playerId: o.id, byId: me.id })
      }
    })
  }

  events.push({ type: 'score', playerId: me.id, points })
  return { players, newEntries, crossIds, events, winnerId }
}

// ────────────────────────────── ПОРЯДОК ХОДОВ ──────────────────────────────

export function advanceTurn(game) {
  const next = (game.turnIndex + 1) % game.players.length
  return { turnIndex: next, round: next === 0 ? game.round + 1 : game.round }
}

// ────────────────────────────── ОПИСАНИЯ ──────────────────────────────

export const ENTRY_LABELS = {
  score: 'Записано',
  bolt: 'Ржавый крючок',
  boltPenalty: 'Рваная сеть',
  foul: 'Суд Хозяина Бухты',
  barrelMiss: 'Глоток сгорел',
  barrelFall: 'Упал с бочки',
  knockOff: 'Спихнут с бочки',
  wagon: 'Дырявая лодка',
  backstab: 'Гарпун в спину',
  overshoot: 'Перебор',
  noEntry: 'В общак не башлял',
  manual: 'Правка писаря',
}

/** Строка для летописи событий. */
export function describeEntry(entry, players) {
  const p = players.find((x) => x.id === entry.playerId)
  const who = p ? `${p.emblem} ${p.name}` : '—'
  const label = ENTRY_LABELS[entry.type] || entry.type
  const delta = entry.delta > 0 ? `+${entry.delta}` : entry.delta < 0 ? `${entry.delta}` : '—'
  return `${who}: ${label} ${delta}${entry.note ? ` · ${entry.note}` : ''}`
}

/** Проверка настроек перед стартом — возвращает список претензий. */
export function validateSettings(s) {
  const errs = []
  const step = s.scoreStep || 1
  const off = (v) => step > 1 && v % step !== 0

  if (s.targetScore < 100) errs.push('Сундук не может быть меньше 100')
  if (s.entryScore < 0) errs.push('Общак не может быть отрицательным')
  if (s.barrels.some((b) => b.value >= s.targetScore)) errs.push('Бочка не может стоять на сундуке или выше')
  if (s.barrels.some((b) => b.attempts < 1)) errs.push('На бочке нужен хотя бы один глоток')
  const vals = s.barrels.map((b) => b.value)
  if (new Set(vals).size !== vals.length) errs.push('Две бочки на одном значении')
  if (s.wagon.enabled && s.wagon.value >= s.targetScore) errs.push('Лодка не может стоять на сундуке или выше')

  // Число, не кратное шагу, просто недостижимо — на него никогда не встанут
  if (off(s.targetScore)) errs.push(`Сундук должен делиться на ${step}`)
  if (s.barrels.some((b) => off(b.value))) errs.push(`Бочка должна делиться на ${step}`)
  if (s.wagon.enabled && off(s.wagon.value)) errs.push(`Лодка должна делиться на ${step}`)
  return errs
}
