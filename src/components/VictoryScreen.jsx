/**
 * VictoryScreen.jsx — ДЕЛЁЖ СУНДУКА
 * Кто забрал Главный Сундук, а кто платит за ром.
 */
import { useGameStore } from '../store/gameStore.js'
import { tap, Emblem, Ribbon, Coin } from './ui.jsx'
import { raceById } from '../data/races.js'
import { TERMS } from '../data/lore.js'

export default function VictoryScreen() {
  const players = useGameStore((s) => s.players)
  const winnerId = useGameStore((s) => s.winnerId)
  const round = useGameStore((s) => s.round)
  const rematch = useGameStore((s) => s.rematch)
  const toShore = useGameStore((s) => s.toShore)

  const winner = players.find((p) => p.id === winnerId)
  const table = [...players].sort((a, b) => b.score - a.score)

  return (
    <div className="pad-tg-top flex h-dvh flex-col">
      <header className="surf-orc frame-gold nailed relative mx-2 px-3 pb-3 pt-5 text-center">
        <p className="tiny text-[13px] leading-none text-parch-dim">КРУГ {round} · РОМ ЗАКОНЧИЛСЯ</p>
        <h1 className="goth mt-1 leading-[0.85] text-gold" style={{ fontSize: 'clamp(34px, 11.5vw, 52px)' }}>
          СУНДУК НАШ!
        </h1>
        {winner && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <Emblem mark={winner.emblem} size={34} />
            <span className="goth text-[34px] leading-none text-bone">{winner.name}</span>
          </div>
        )}
        <Ribbon className="mt-2">ОСТАЛЬНЫЕ ПЛАТЯТ ЗА РОМ</Ribbon>
      </header>

      <main className="surf-board frame mx-2 mt-1 flex-1 overflow-y-auto px-2 py-2">
        <ol className="space-y-1">
          {table.map((p, i) => (
            <li
              key={p.id}
              className={`surf-parch flex items-center gap-2 px-2 py-1.5 ${
                p.id === winnerId ? 'frame-gold' : 'frame-thin'
              }`}
            >
              <span className="num w-6 text-[23px] leading-none text-ink/55">{i + 1}</span>
              <Emblem mark={p.emblem} size={26} />
              <div className="min-w-0 flex-1">
                <span className="goth block truncate text-[22px] leading-none text-ink">{p.name}</span>
                <span className="tiny block text-[11px] leading-tight text-ink/60">
                  {raceById(p.race).short} · ХОДОВ {p.stats.turns} · КРЮЧКОВ {p.stats.bolts}
                  {p.stats.backstabs > 0 && ` · ГАРПУНОВ ${p.stats.backstabs}`}
                </span>
              </div>
              <span className="num text-[32px] leading-none text-ink">{p.score}</span>
              <Coin size={18} />
            </li>
          ))}
        </ol>
      </main>

      <footer className="mx-2 mb-2 mt-1 grid grid-cols-2 gap-1">
        <button
          type="button"
          className="btn py-5 text-[20px] leading-tight"
          onClick={() => {
            tap()
            toShore()
          }}
        >
          На причал
        </button>
        <button
          type="button"
          className="btn btn-gold py-5 text-[23px] leading-tight"
          onClick={() => {
            tap()
            rematch()
          }}
        >
          Ещё партия
        </button>
        <div className="col-span-2 pad-tg-bottom" />
      </footer>
    </div>
  )
}
