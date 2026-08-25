/**
 * VictoryScreen.jsx — ДЕЛЁЖ СУНДУКА
 * ------------------------------------------------------------------
 * Кто забрал Главный Сундук, а кто платит за ром.
 *
 * Победителей может быть несколько: сундук не обрывает партию, у всех
 * остальных есть последний ход, чтобы догнать. Тот, кто дошёл первым,
 * помечается отдельно — но золото делят все, кто успел.
 */
import { useMemo } from 'react'
import { useGameStore } from '../store/gameStore.js'
import { tap, RaceIcon, Ribbon, Coin } from './ui.jsx'
import { raceById } from '../data/races.js'
import { plural } from '../data/lore.js'

export default function VictoryScreen() {
  const players = useGameStore((s) => s.players)
  const winnerId = useGameStore((s) => s.winnerId)
  const winners = useGameStore((s) => s.winners)
  const round = useGameStore((s) => s.round)
  const rematch = useGameStore((s) => s.rematch)
  const toShore = useGameStore((s) => s.toShore)

  const won = new Set(winners?.length ? winners : [winnerId].filter(Boolean))
  const first = players.find((p) => p.id === winnerId)
  const shared = won.size > 1
  // Раскладка монет считается один раз: иначе они прыгали бы на каждый рендер
  const coins = useMemo(
    () => Array.from({ length: 18 }, () => ({ left: Math.random() * 96, delay: Math.random() * 1.4 })),
    [],
  )
  // Победители наверху по порядку взятия сундука, остальные — по золоту
  const table = [...players].sort((a, b) => {
    const aw = won.has(a.id)
    const bw = won.has(b.id)
    if (aw !== bw) return aw ? -1 : 1
    if (aw && bw) return winners.indexOf(a.id) - winners.indexOf(b.id)
    return b.score - a.score
  })

  return (
    <div className="chest-burst pad-tg-top relative flex h-dvh flex-col">
      {/* Монеты сыплются с потолка — по разу при появлении экрана */}
      <div className="coin-rain pointer-events-none fixed inset-0 z-20 overflow-hidden" aria-hidden="true">
        {coins.map((c, i) => (
          <i key={i} style={{ left: `${c.left}%`, animationDelay: `${c.delay}s` }} />
        ))}
      </div>
      <header className="surf-orc frame-gold nailed relative mx-2 px-3 pb-3 pt-5 text-center">
        <p className="tiny text-[13px] leading-none text-parch-dim">
          КРУГ {round} · РОМ ЗАКОНЧИЛСЯ
        </p>
        <h1
          className="goth mt-1 leading-[0.85] text-gold"
          style={{ fontSize: 'clamp(34px, 11.5vw, 52px)' }}
        >
          {shared ? 'СУНДУК ДЕЛЯТ!' : 'СУНДУК НАШ!'}
        </h1>

        {first && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <RaceIcon race={first.race} size={36} />
            <span className="goth text-[34px] leading-none text-bone">{first.name}</span>
          </div>
        )}

        {shared ? (
          <p className="mt-1 text-[15px] leading-tight text-orc-bright">
            дошёл первым · всего {won.size}{' '}
            {plural(won.size, ['победитель', 'победителя', 'победителей'])}
          </p>
        ) : null}

        <Ribbon className="mt-2">ОСТАЛЬНЫЕ ПЛАТЯТ ЗА РОМ</Ribbon>
      </header>

      <main className="surf-board frame mx-2 mt-1 flex-1 overflow-y-auto px-2 py-2">
        <ol className="space-y-1">
          {table.map((p, i) => {
            const isWinner = won.has(p.id)
            const isFirst = p.id === winnerId
            return (
              <li
                key={p.id}
                className={`surf-parch relative flex items-center gap-2 px-2 py-1.5 ${
                  isFirst ? 'frame-gold' : isWinner ? 'frame-neon' : 'frame-thin'
                }`}
              >
                <span className="num w-6 text-[23px] leading-none text-ink/55">{i + 1}</span>
                <RaceIcon race={p.race} size={28} />
                <div className="min-w-0 flex-1">
                  <span className="goth block truncate text-[22px] leading-none text-ink">
                    {p.name}
                    {isFirst && (
                      <span className="tiny ml-1.5 align-middle text-[11px] text-blood">
                        ПЕРВЫЙ
                      </span>
                    )}
                    {isWinner && !isFirst && (
                      <span className="tiny ml-1.5 align-middle text-[11px] text-orc-light">
                        УСПЕЛ
                      </span>
                    )}
                  </span>
                  <span className="tiny block text-[11px] leading-tight text-ink/60">
                    {raceById(p.race).short} · ХОДОВ {p.stats.turns} · КРЮЧКОВ {p.stats.bolts}
                    {p.stats.backstabs > 0 && ` · ГАРПУНОВ ${p.stats.backstabs}`}
                  </span>
                </div>
                <span className="num text-[32px] leading-none text-ink">{p.score}</span>
                <Coin size={18} />
              </li>
            )
          })}
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
            tap('success')
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
