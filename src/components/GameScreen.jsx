/**
 * GameScreen.jsx — СТОЛ В ТРЮМЕ
 * Свитки игроков, пульт писаря и всё, что открывается поверх:
 * кодекс, судовой журнал, правка счёта.
 */
import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore.js'
import { describeEntry } from '../engine/rulesEngine.js'
import PlayerScroll from './PlayerScroll.jsx'
import InputPad from './InputPad.jsx'
import SettingsPanel from './SettingsPanel.jsx'
import { Modal, tap, Emblem, Stepper, Coin } from './ui.jsx'
import { TERMS, plural, TURNS } from '../data/lore.js'

/* ─────────────────────── ЛЕТОПИСЬ СОБЫТИЙ ─────────────────────── */

function LogModal({ onClose }) {
  const entries = useGameStore((s) => s.entries)
  const players = useGameStore((s) => s.players)
  const rows = [...entries].reverse()

  return (
    <Modal title="Судовой журнал" onClose={onClose}>
      {rows.length === 0 ? (
        <p className="text-[17px] text-parch-dim">Пока ни одной записи.</p>
      ) : (
        <ol className="space-y-1">
          {rows.map((e) => (
            <li key={e.id} className="frame-thin surf-parch px-2 py-2 text-[15px] leading-tight text-ink">
              <span className="tiny mr-1 text-[11px] text-ink/55">КРУГ {e.round}</span>
              {describeEntry(e, players)}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  )
}

/* ─────────────────────── ПРАВКА ПИСАРЯ ─────────────────────── */

function ScribeModal({ player, onClose }) {
  const [delta, setDelta] = useState(50)
  const writeManual = useGameStore((s) => s.writeManual)

  const apply = (sign) => {
    tap()
    writeManual(player.id, sign * delta)
    onClose()
  }

  return (
    <Modal title="Правка писаря" onClose={onClose}>
      <div className="frame-thin surf-parch mb-3 flex items-center gap-2 px-3 py-2">
        <Emblem mark={player.emblem} size={30} />
        <span className="goth flex-1 text-[24px] leading-none text-ink">{player.name}</span>
        <span className="num text-[32px] leading-none text-ink">{player.score}</span>
        <Coin size={20} />
      </div>
      <p className="mb-3 text-[14px] leading-tight text-parch-dark">
        Ручная правка не трогает бочки, болты и очерёдность — только число в свитке.
      </p>
      <Stepper label="Величина" value={delta} onChange={setDelta} step={10} min={5} max={1000} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-blood py-4 text-[22px]" onClick={() => apply(-1)}>
          − {delta}
        </button>
        <button type="button" className="btn btn-gold py-4 text-[22px]" onClick={() => apply(1)}>
          + {delta}
        </button>
      </div>
    </Modal>
  )
}

/* ─────────────────────── ЭКРАН ─────────────────────── */

export default function GameScreen() {
  const [modal, setModal] = useState(null) // 'rules' | 'log' | null
  const [scribe, setScribe] = useState(null)

  const players = useGameStore((s) => s.players)
  const entries = useGameStore((s) => s.entries)
  const turnIndex = useGameStore((s) => s.turnIndex)
  const round = useGameStore((s) => s.round)
  const finaleLeft = useGameStore((s) => s.finaleLeft)
  const boltsMax = useGameStore((s) => s.settings.bolts.perPenalty)
  const muted = useGameStore((s) => s.muted)
  const toggleMute = useGameStore((s) => s.toggleMute)
  const undo = useGameStore((s) => s.undo)
  const canUndo = useGameStore((s) => s.history.length > 0)
  const toShore = useGameStore((s) => s.toShore)

  const byPlayer = (id) => entries.filter((e) => e.playerId === id)

  // Стол шире экрана, когда игроков больше трёх: сам подкручиваем к тому,
  // чей сейчас ход, — иначе четвёртый остаётся за краем и его не видно.
  const boardRef = useRef(null)
  const colRefs = useRef([])
  useEffect(() => {
    const board = boardRef.current
    const col = colRefs.current[turnIndex]
    if (!board || !col) return
    const target = col.offsetLeft - (board.clientWidth - col.clientWidth) / 2
    const max = board.scrollWidth - board.clientWidth
    board.scrollTo({ left: Math.max(0, Math.min(target, max)), behavior: 'smooth' })
  }, [turnIndex, players.length])

  return (
    <div className="pad-tg-top flex h-dvh flex-col gap-1">
      {/* ── Верхняя балка ── */}
      <header className="surf-orc frame mx-2 flex shrink-0 items-center gap-1 px-1.5 py-1.5">
        <button
          type="button"
          className="btn h-12 w-12 text-[20px] leading-none"
          onClick={() => {
            tap()
            setModal('rules')
          }}
          aria-label="Кодекс Бухты"
        >
          ☰
        </button>
        <button
          type="button"
          className="btn h-12 px-3 text-[17px] leading-none"
          onClick={() => {
            tap()
            setModal('log')
          }}
          aria-label="Судовой журнал"
        >
          Журнал
        </button>

        <span className="flex-1 text-center leading-none">
          {finaleLeft !== null ? (
            <>
              <span className="goth block text-[20px] leading-none text-blood-bright">
                ПОСЛЕДНИЙ КРУГ
              </span>
              <span className="tiny block text-[12px] leading-tight text-lamp">
                ОСТАЛОСЬ {finaleLeft} {plural(finaleLeft, TURNS).toUpperCase()}
              </span>
            </>
          ) : (
            <span className="goth text-[24px] leading-none text-gold">КРУГ {round}</span>
          )}
        </span>

        <button
          type="button"
          className="btn h-12 w-12 text-[20px] leading-none"
          onClick={() => {
            tap()
            undo()
          }}
          disabled={!canUndo}
          aria-label="Стереть последнюю запись"
        >
          ↶
        </button>
        <button
          type="button"
          className="btn h-12 w-12 text-[20px] leading-none"
          onClick={() => {
            tap()
            toggleMute()
          }}
          aria-label={muted ? 'Включить звук' : 'Заглушить'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </header>

      {/* ── Свитки ── */}
      <main
        ref={boardRef}
        className="mx-2 flex min-h-0 flex-1 gap-1.5 overflow-x-auto no-scrollbar"
        aria-label="Свитки игроков"
      >
        {players.map((p, i) => (
          <div
            key={p.id}
            ref={(el) => (colRefs.current[i] = el)}
            className="h-full min-w-[104px] shrink-0"
            // Больше трёх свитков — показываем край четвёртого,
            // чтобы было видно: стол шире экрана, можно листать.
            style={{ flexBasis: `calc(${100 / (players.length > 3 ? 2.7 : players.length)}% - 6px)` }}
          >
            <PlayerScroll
              player={p}
              entries={byPlayer(p.id)}
              active={i === turnIndex}
              boltsMax={boltsMax}
              seed={i + 1}
              onTapHead={() => {
                tap()
                setScribe(p)
              }}
            />
          </div>
        ))}
      </main>

      {/* ── Пульт ── */}
      <InputPad />

      {/* ── Окна ── */}
      {modal === 'log' && <LogModal onClose={() => setModal(null)} />}
      {modal === 'rules' && (
        <Modal
          title={TERMS.codex}
          onClose={() => setModal(null)}
          footer={
            <button
              type="button"
              className="btn w-full py-3.5 text-[18px]"
              onClick={() => {
                tap()
                setModal(null)
                toShore()
              }}
            >
              Сойти на берег
            </button>
          }
        >
          <SettingsPanel locked />
        </Modal>
      )}
      {scribe && <ScribeModal player={players.find((p) => p.id === scribe.id)} onClose={() => setScribe(null)} />}
    </div>
  )
}
