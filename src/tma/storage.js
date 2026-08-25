/**
 * storage.js — СУНДУК ПАМЯТИ
 * ------------------------------------------------------------------
 * Слава Бухты (победы по именам) живёт в облаке Telegram, если игра
 * открыта в мессенджере, и в localStorage во всех остальных случаях.
 * Наружу торчат две асинхронные функции — где именно лежит, знать не надо.
 *
 * CloudStorage работает на колбэках и хранит строки, поэтому здесь
 * и промисы, и JSON, и запасной путь на каждый чих.
 */
import { tg, insideTelegram } from './telegram.js'

const KEY = 'zonk-glory'
const cloud = tg?.CloudStorage || null
// CloudStorage появился в Bot API 6.9. Объект есть и в старых клиентах,
// но на каждый вызов ругается в консоль — потому проверяем версию.
const cloudReady = (() => {
  try {
    return insideTelegram && !!cloud && tg.isVersionAtLeast?.('6.9')
  } catch {
    return false
  }
})()
const hasCloud = !!cloudReady && typeof cloud.getItem === 'function'

function cloudGet(key) {
  return new Promise((resolve) => {
    try {
      cloud.getItem(key, (err, value) => resolve(err ? null : value || null))
    } catch {
      resolve(null)
    }
  })
}

function cloudSet(key, value) {
  return new Promise((resolve) => {
    try {
      cloud.setItem(key, value, (err) => resolve(!err))
    } catch {
      resolve(false)
    }
  })
}

const localGet = (key) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const localSet = (key, value) => {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/**
 * Прочитать славу.
 * @returns {Promise<Record<string, {wins:number, games:number, best:number}>>}
 */
export async function loadGlory() {
  const raw = hasCloud ? ((await cloudGet(KEY)) ?? localGet(KEY)) : localGet(KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** Записать славу. В облако и в локальную память сразу — облако бывает недоступно. */
export async function saveGlory(glory) {
  const raw = JSON.stringify(glory)
  localSet(KEY, raw)
  if (hasCloud) await cloudSet(KEY, raw)
}

/**
 * Учесть партию: победителю плюс победа, всем — плюс игра.
 * Считаем по имени персонажа, как и просили.
 */
export function tallyGame(glory, players, winnerId) {
  const next = { ...glory }
  players.forEach((p) => {
    const name = (p.name || '').trim()
    if (!name) return
    const row = next[name] || { wins: 0, games: 0, best: 0 }
    next[name] = {
      wins: row.wins + (p.id === winnerId ? 1 : 0),
      games: row.games + 1,
      best: Math.max(row.best, p.score),
      race: p.race || row.race,
    }
  })
  return next
}

export const gloryTable = (glory) =>
  Object.entries(glory)
    .map(([name, row]) => ({ name, ...row }))
    .sort((a, b) => b.wins - a.wins || b.best - a.best)
