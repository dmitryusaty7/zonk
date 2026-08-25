/**
 * gameStore.js — СУДОВОЙ ЖУРНАЛ
 * ------------------------------------------------------------------
 * Состояние игры и вызовы кодекса. Сам ничего не считает: вся математика
 * в rulesEngine, здесь — экраны, очередь ходов, откат, сохранение
 * и слава Бухты.
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  DEFAULT_SETTINGS,
  createPlayer,
  resolveTurn,
  advanceTurn,
  validateSettings,
  barrelNeed,
} from '../engine/rulesEngine.js'
import { RACES, raceById, suggestName, DEFAULT_NAMES } from '../data/races.js'
import { emit } from '../audio/bus.js'
import { loadGlory, saveGlory, tallyGame } from '../tma/storage.js'

const UNDO_DEPTH = 30
const MAX_CREW = 8

const DEFAULT_ROSTER = () => [
  { name: 'Гразгар', race: 'orc' },
  { name: 'Мргрлгл', race: 'murloc' },
]

/** Имя из набора по умолчанию можно молча заменить при смене расы. */
const isDefaultName = (name) =>
  Object.values(DEFAULT_NAMES).some((pool) => pool.includes(name))

/** Глубокая правка настроек по пути вида 'wagon.value'. */
function setPath(obj, path, value) {
  const keys = path.split('.')
  const next = structuredClone(obj)
  let cur = next
  for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]]
  cur[keys.at(-1)] = value
  return next
}

const snapshot = (s) => ({
  players: structuredClone(s.players),
  entries: structuredClone(s.entries),
  turnIndex: s.turnIndex,
  round: s.round,
  winnerId: s.winnerId,
  winners: [...s.winners],
  finaleLeft: s.finaleLeft,
  screen: s.screen,
})

export const useGameStore = create()(
  persist(
    (set, get) => ({
      // ─────────── экран ───────────
      screen: 'menu', // menu | codex | rules | game | victory
      /** Кодекс должны хотя бы раз открыть — только потом снимаем якорь. */
      codexSeen: false,

      // ─────────── команда и правила ───────────
      roster: DEFAULT_ROSTER(),
      settings: structuredClone(DEFAULT_SETTINGS),

      // ─────────── партия ───────────
      players: [],
      entries: [],
      turnIndex: 0,
      round: 1,
      /** Кто взял сундук первым — его и помечаем в итогах. */
      winnerId: null,
      /** Все, кто успел взять сундук: в последнем круге их может быть несколько. */
      winners: [],
      /**
       * Сколько ходов осталось до конца партии.
       * null — финал не начат; число — идёт последний круг.
       */
      finaleLeft: null,

      // ─────────── ход ───────────
      pad: '',

      // ─────────── прочее ───────────
      history: [],
      toast: null,
      muted: false,
      voicePack: 'pirate',
      glory: {},

      // ═════════ ЭКРАНЫ ═════════
      openCodex: () => set({ screen: 'codex', codexSeen: true }),
      openRules: () => set({ screen: 'rules' }),
      toMenu: () => set({ screen: 'menu' }),

      // ═════════ КОМАНДА ═════════
      addPlayer: () =>
        set((s) => {
          if (s.roster.length >= MAX_CREW) return s
          const race = RACES[s.roster.length % RACES.length].id
          const taken = s.roster.map((r) => r.name)
          return { roster: [...s.roster, { name: suggestName(race, taken), race }] }
        }),

      removePlayer: (i) =>
        set((s) => (s.roster.length <= 2 ? s : { roster: s.roster.filter((_, k) => k !== i) })),

      renamePlayer: (i, name) =>
        set((s) => ({ roster: s.roster.map((r, k) => (k === i ? { ...r, name } : r)) })),

      /** Перещёлкнуть расу. Своё имя не трогаем, стандартное — подменяем. */
      cycleRace: (i) =>
        set((s) => {
          const cur = s.roster[i]
          const idx = RACES.findIndex((r) => r.id === cur.race)
          const next = RACES[(idx + 1) % RACES.length]
          const taken = s.roster.filter((_, k) => k !== i).map((r) => r.name)
          return {
            roster: s.roster.map((r, k) =>
              k === i
                ? {
                    ...r,
                    race: next.id,
                    name: isDefaultName(r.name) ? suggestName(next.id, taken) : r.name,
                  }
                : r,
            ),
          }
        }),

      // ═════════ КОДЕКС ═════════
      setSetting: (path, value) => set((s) => ({ settings: setPath(s.settings, path, value) })),

      addBarrel: () =>
        set((s) => {
          const used = s.settings.barrels.map((b) => b.value)
          let v = 500
          while (used.includes(v) && v < s.settings.targetScore) v += 5
          return {
            settings: {
              ...s.settings,
              barrels: [...s.settings.barrels, { value: v, attempts: 3, fallPenalty: 120 }].sort(
                (a, b) => a.value - b.value,
              ),
            },
          }
        }),

      removeBarrel: (i) =>
        set((s) => ({
          settings: { ...s.settings, barrels: s.settings.barrels.filter((_, k) => k !== i) },
        })),

      updateBarrel: (i, patch) =>
        set((s) => ({
          settings: {
            ...s.settings,
            barrels: s.settings.barrels.map((b, k) => (k === i ? { ...b, ...patch } : b)),
          },
        })),

      resetSettings: () => set({ settings: structuredClone(DEFAULT_SETTINGS) }),

      // ═════════ СТАРТ ═════════
      startGame: () => {
        const s = get()
        const errs = validateSettings(s.settings)
        if (errs.length) {
          set({ toast: { kind: 'error', text: errs[0] } })
          return false
        }
        const players = s.roster.map((r) => ({
          ...createPlayer(r.name.trim() || 'Салага', raceById(r.race).mark),
          race: r.race,
        }))
        set({
          screen: 'game',
          players,
          entries: [],
          turnIndex: 0,
          round: 1,
          winnerId: null,
          winners: [],
          finaleLeft: null,
          pad: '',
          history: [],
        })
        emit({ type: 'gameStart' })
        return true
      },

      // ═════════ ВВОД ХОДА ═════════
      padClear: () => set({ pad: '' }),
      /** Прибавить золота фишкой номинала. Другого способа ввода нет,
       *  поэтому любое набранное число заведомо кратно шагу счёта. */
      padAdd: (n) => set((s) => ({ pad: String(Math.min(9999, (Number(s.pad) || 0) + n)) })),

      // ═════════ ЗАПИСЬ В СВИТОК ═════════
      commit: (action) => {
        const s = get()
        if (s.screen === 'victory') return
        const g = {
          settings: s.settings,
          players: s.players,
          entries: s.entries,
          turnIndex: s.turnIndex,
          round: s.round,
          winnerId: s.winnerId,
        }
        const r = resolveTurn(g, action)
        const entries = s.entries.map((e) => (r.crossIds.includes(e.id) ? { ...e, crossed: true } : e))

        /*
         * ФИНАЛ.
         * Взятый сундук партию не обрывает: у остальных есть ровно по одному
         * последнему ходу, чтобы догнать. Кто успеет — тоже победитель,
         * но первым помечается тот, кто дошёл раньше.
         */
        const finaleWasOn = s.finaleLeft !== null
        let winners = s.winners
        let winnerId = s.winnerId
        let finaleLeft = finaleWasOn ? s.finaleLeft - 1 : null

        const wonNow = r.winnerId && !winners.includes(r.winnerId)
        if (wonNow) {
          winners = [...winners, r.winnerId]
          if (!winnerId) {
            winnerId = r.winnerId
            // по одному последнему ходу каждому, кроме самого победителя
            finaleLeft = s.players.length - 1
          }
        }

        const over = finaleLeft !== null && finaleLeft <= 0
        const turn = over ? { turnIndex: s.turnIndex, round: s.round } : advanceTurn(g)

        set({
          history: [...s.history, snapshot(s)].slice(-UNDO_DEPTH),
          players: r.players,
          entries: [...entries, ...r.newEntries],
          winnerId,
          winners,
          finaleLeft,
          turnIndex: turn.turnIndex,
          round: turn.round,
          pad: '',
          screen: over ? 'victory' : 'game',
        })

        r.events.forEach(emit)
        if (wonNow && !over) emit({ type: 'finale' })
        if (over) get().recordGlory(r.players, winners)
      },

      /** Идёт ли последний круг. */
      inFinale: () => get().finaleLeft !== null,

      /** Записать набранное золото. */
      writeScore: () => {
        const s = get()
        const points = Number(s.pad) || 0
        if (points <= 0) {
          set({ toast: { kind: 'error', text: 'Нечего писать: набери золота или вешай крючок.' } })
          return
        }
        // На бочке недобор не пишется вовсе — это провал, а не запись.
        const me = s.players[s.turnIndex]
        if (me?.barrel && points < barrelNeed(me, s.settings)) {
          set({ toast: { kind: 'error', text: 'Мало для сундука. Вешай ржавый крючок.' } })
          return
        }
        get().commit({ type: 'score', points })
      },

      writeBolt: () => get().commit({ type: 'bolt' }),
      writeFoul: (foul) => get().commit({ type: 'foul', foul }),

      /** Ручная правка счёта писарем. */
      writeManual: (playerId, delta) => {
        const s = get()
        const players = s.players.map((p) =>
          p.id === playerId ? { ...p, score: p.score + delta } : p,
        )
        const player = players.find((p) => p.id === playerId)
        const entry = {
          id: `e_manual_${Date.now()}`,
          playerId,
          round: s.round,
          type: 'manual',
          delta,
          total: player.score,
          crossed: false,
          barrel: false,
          note: 'Правка писаря',
          ts: Date.now(),
        }
        set({
          history: [...s.history, snapshot(s)].slice(-UNDO_DEPTH),
          players,
          entries: [...s.entries, entry],
        })
      },

      // ═════════ ОТКАТ ═════════
      undo: () =>
        set((s) => {
          if (!s.history.length) return { toast: { kind: 'error', text: 'Откатывать нечего.' } }
          const prev = s.history.at(-1)
          emit({ type: 'undo' })
          return { ...prev, history: s.history.slice(0, -1), pad: '' }
        }),

      // ═════════ СЛАВА БУХТЫ ═════════
      hydrateGlory: async () => {
        const glory = await loadGlory()
        if (glory && Object.keys(glory).length) set({ glory })
      },

      recordGlory: (players, winners) => {
        const glory = tallyGame(get().glory, players, winners)
        set({ glory })
        saveGlory(glory)
      },

      forgetGlory: () => {
        set({ glory: {} })
        saveGlory({})
      },

      // ═════════ ЗАВЕРШЕНИЕ ═════════
      rematch: () =>
        set((s) => ({
          screen: 'game',
          players: s.players.map((p) => ({
            ...p,
            score: 0,
            bolts: 0,
            entered: false,
            barrel: null,
            stats: { turns: 0, bolts: 0, best: 0, penalties: 0, backstabs: 0 },
          })),
          entries: [],
          turnIndex: 0,
          round: 1,
          winnerId: null,
          winners: [],
          finaleLeft: null,
          pad: '',
          history: [],
        })),

      toShore: () =>
        set((s) => ({
          screen: 'menu',
          roster: s.players.length
            ? s.players.map((p) => ({ name: p.name, race: p.race || 'orc' }))
            : s.roster,
          winnerId: null,
          winners: [],
          finaleLeft: null,
          pad: '',
        })),

      // ═════════ МЕЛОЧИ ═════════
      setToast: (toast) => set({ toast }),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
      setVoicePack: (voicePack) => set({ voicePack }),
    }),
    {
      name: 'zonk-bay',
      version: 4,
      /**
       * Пока переключателя «ниже нуля» не было в Кодексе, у всех лежало
       * старое значение true, выбрать которое было негде. Поднимая версию,
       * приводим сохранённое к новому обычаю — минус выключен.
       */
      migrate: (state, from) => {
        if (!state) return state
        if (from < 4 && state.settings) {
          return { ...state, settings: { ...state.settings, allowNegative: false } }
        }
        return state
      },
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        // «Кодекс» — не место для возврата: после перезапуска встаём в меню
        screen: s.screen === 'codex' || s.screen === 'rules' ? 'menu' : s.screen,
        codexSeen: s.codexSeen,
        roster: s.roster,
        settings: s.settings,
        players: s.players,
        entries: s.entries,
        turnIndex: s.turnIndex,
        round: s.round,
        winnerId: s.winnerId,
        winners: s.winners,
        finaleLeft: s.finaleLeft,
        muted: s.muted,
        voicePack: s.voicePack,
        glory: s.glory,
      }),
    },
  ),
)

// ─────────── селекторы ───────────
export const selectCurrent = (s) => s.players[s.turnIndex] || null
