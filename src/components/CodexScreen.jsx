/**
 * CodexScreen.jsx — КОДЕКС БУХТЫ
 * Две закладки: кто в команде и по каким правилам играем.
 * Пока сюда не заглянули — на причале не дают снять якорь.
 */
import { useState } from 'react'
import { useGameStore } from '../store/gameStore.js'
import { RACES, raceById } from '../data/races.js'
import { TERMS } from '../data/lore.js'
import { validateSettings } from '../engine/rulesEngine.js'
import SettingsPanel from './SettingsPanel.jsx'
import { tap, Emblem } from './ui.jsx'

const MAX_CREW = 8

function Crew() {
  const roster = useGameStore((s) => s.roster)
  const addPlayer = useGameStore((s) => s.addPlayer)
  const removePlayer = useGameStore((s) => s.removePlayer)
  const renamePlayer = useGameStore((s) => s.renamePlayer)
  const cycleRace = useGameStore((s) => s.cycleRace)

  return (
    <div className="space-y-2">
      <p className="mb-3 text-[15px] leading-tight text-parch-dark">
        Нажми на знак — сменишь расу. Имя вписывается своё: по нему считается
        слава между партиями.
      </p>

      {roster.map((r, i) => {
        const race = raceById(r.race)
        return (
          <div key={i} className="frame-thin surf-wood px-2 py-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="frame-thin flex h-14 w-14 shrink-0 flex-col items-center justify-center bg-wood-dark"
                onClick={() => {
                  tap('medium')
                  cycleRace(i)
                }}
                aria-label={`Сменить расу игрока ${r.name}. Сейчас: ${race.label}`}
              >
                <Emblem mark={race.mark} size={26} />
              </button>
              <input
                className="field h-14 min-w-0 flex-1 px-2 text-[22px]"
                value={r.name}
                maxLength={14}
                onChange={(e) => renamePlayer(i, e.target.value)}
                aria-label={`Имя игрока ${i + 1}`}
                placeholder="Имя"
              />
              <button
                type="button"
                className="btn btn-blood h-14 w-12 shrink-0 text-[20px] leading-none"
                onClick={() => {
                  tap('warning')
                  removePlayer(i)
                }}
                disabled={roster.length <= 2}
                aria-label={`Списать на берег: ${r.name}`}
              >
                ✕
              </button>
            </div>
            <span
              className="tiny mt-1.5 block text-[12px] leading-none"
              style={{ color: race.tint }}
            >
              {race.label.toUpperCase()}
            </span>
          </div>
        )
      })}

      <button
        type="button"
        className="btn btn-orc w-full py-4 text-[19px]"
        onClick={() => {
          tap()
          addPlayer()
        }}
        disabled={roster.length >= MAX_CREW}
      >
        + Взять на борт
      </button>

      <p className="tiny pt-1 text-[12px] leading-tight text-parch-dark">
        ОТ ДВУХ ДО {MAX_CREW} ИГРОКОВ. РАСЫ МОГУТ ПОВТОРЯТЬСЯ.
      </p>
    </div>
  )
}

export default function CodexScreen() {
  const [tab, setTab] = useState('crew')
  const toMenu = useGameStore((s) => s.toMenu)
  const settings = useGameStore((s) => s.settings)
  const errs = validateSettings(settings)

  return (
    <div className="pad-tg-top flex h-dvh flex-col">
      <header className="surf-orc frame-gold mx-2 px-3 py-3 text-center">
        <h1 className="goth text-[32px] leading-none text-gold">{TERMS.codex.toUpperCase()}</h1>
      </header>

      <nav className="mx-2 mt-1 flex gap-1">
        {[
          ['crew', 'Команда'],
          ['rules', 'Правила'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`btn flex-1 py-3.5 text-[20px] ${tab === id ? 'btn-orc' : ''}`}
            onClick={() => {
              tap()
              setTab(id)
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="surf-board frame mx-2 mt-1 flex-1 overflow-y-auto px-3 py-3">
        {tab === 'crew' ? <Crew /> : <SettingsPanel />}
      </main>

      <footer className="pad-tg-bottom mx-2 mb-2 mt-1">
        {errs.length > 0 && (
          <p className="frame-thin mb-1 bg-blood/50 px-2 py-1.5 text-[15px] leading-tight text-bone">
            {errs[0]}
          </p>
        )}
        <button
          type="button"
          className="btn btn-gold w-full py-5 text-[26px] leading-none"
          onClick={() => {
            tap()
            toMenu()
          }}
          disabled={errs.length > 0}
        >
          НА ПРИЧАЛ
        </button>
      </footer>
    </div>
  )
}
