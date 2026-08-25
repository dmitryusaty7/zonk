/**
 * PlayerScroll.jsx — СВИТОК ИГРОКА
 * Одна колонка судового журнала: знак расы, золото, столбик записей.
 * Пустой бросок рисуется ржавым крючком, три крючка — рваной сетью.
 */
import { useEffect, useRef } from 'react'
import { RaceIcon } from './ui.jsx'
import { plural, SIPS } from '../data/lore.js'

/* ─────────────────────────── СТРОКИ ─────────────────────────── */

/** Записанные златые: в столбик идёт нарастающий итог. */
function ScoreLine({ entry }) {
  // Число на бочке обводится деревянным кольцом — ему нужен свой ряд,
  // иначе рама налезает на соседние строки.
  if (entry.barrel) {
    return (
      <div className="scroll-line barrel-in flex flex-col items-center gap-1 px-1 py-2">
        <span className="on-barrel num px-2 py-0.5 text-[29px] leading-none">
          {entry.total}
        </span>
        <span className="tiny text-[12px] leading-none text-ink/60">+{entry.delta} · БОЧКА</span>
      </div>
    )
  }
  return (
    <div className="scroll-line ink-in flex items-baseline justify-center gap-1 px-1 py-1">
      <span className="num text-[33px] leading-none text-ink">{entry.total}</span>
      <span className="tiny text-[12px] leading-none text-ink/55">+{entry.delta}</span>
    </div>
  )
}

/** Ржавый крючок — пустой бросок. */
function BoltLine() {
  return (
    <div className="scroll-line hook-in flex h-[38px] items-center justify-center px-1">
      <span className="bolt-hook" role="img" aria-label="Ржавый крючок" />
    </div>
  )
}

/** Три крючка под рваной сетью — крест поверх группы. */
function CrossedBolts({ count }) {
  return (
    <div className="relative">
      {Array.from({ length: count }, (_, i) => (
        <BoltLine key={i} />
      ))}
      <span className="bolt-cross net-in" aria-hidden="true" />
      <span className="sr-only">Сеть порвана: {count} крючка перечёркнуты</span>
    </div>
  )
}

/** Списание: крест за болты, штраф, удар в спину, падение с бочки. */
function PenaltyLine({ entry }) {
  // Короткое слово читается в узкой колонке лучше мелкой пиктограммы.
  const mark = {
    boltPenalty: 'РВАНАЯ СЕТЬ',
    foul: 'ШТРАФ',
    backstab: 'ГАРПУН',
    knockOff: 'СПИХНУТ',
    barrelFall: 'УПАЛ',
    wagon: 'ПРОБОИНА',
    manual: 'ПРАВКА',
  }[entry.type]

  const positive = entry.delta > 0
  // Гарпун, сброс с бочки и падение — это удары: строка дёргается
  const hit = ['backstab', 'knockOff', 'barrelFall', 'wagon'].includes(entry.type)
  return (
    <div className={`scroll-line flex flex-col items-center px-1 py-1 ${hit ? 'jab-in' : 'ink-in'}`}>
      <span className="tiny text-[11px] leading-none text-blood/85">{mark}</span>
      <span
        className={`num text-[27px] leading-none ${positive ? 'text-moss' : 'text-blood'}`}
      >
        {positive ? '+' : '−'}
        {Math.abs(entry.delta)}
      </span>
      <span className="tiny text-[11px] leading-none text-ink/60">{entry.total}</span>
    </div>
  )
}

/** Сгоревшая попытка: промах на бочке, перебор, непринятая подать. */
function VoidLine({ entry }) {
  const label = { barrelMiss: 'глоток', overshoot: 'перебор', noEntry: 'не башлял' }[entry.type]
  return (
    <div className="scroll-line ink-in flex flex-col items-center px-1 py-1 opacity-70">
      <span className="goth text-[23px] leading-none text-ink/60">✕</span>
      <span className="tiny text-[11px] leading-none text-ink/55">{label}</span>
    </div>
  )
}

/** Разложить записи по строкам, склеив подряд идущие зачёркнутые болты. */
function renderLines(entries) {
  const out = []
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    if (e.type === 'bolt' && e.crossed) {
      let n = 0
      while (i + n < entries.length && entries[i + n].type === 'bolt' && entries[i + n].crossed) n++
      out.push(<CrossedBolts key={e.id} count={n} />)
      i += n - 1
      continue
    }
    if (e.type === 'bolt') out.push(<BoltLine key={e.id} />)
    else if (e.type === 'score') out.push(<ScoreLine key={e.id} entry={e} />)
    else if (['barrelMiss', 'overshoot', 'noEntry'].includes(e.type)) out.push(<VoidLine key={e.id} entry={e} />)
    else out.push(<PenaltyLine key={e.id} entry={e} />)
  }
  return out
}

/* ─────────────────────────── КОЛОНКА ─────────────────────────── */

export default function PlayerScroll({ player, entries, active, boltsMax, seed = 0, onTapHead }) {
  const bodyRef = useRef(null)
  // Каждый свиток берёт свой кусок пергамента — иначе видно, что это
  // одна и та же плитка, повторённая рядом.
  const grain = { backgroundPosition: `${(seed * 61) % 256}px ${(seed * 97) % 256}px` }

  // свежая запись всегда на виду
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries.length])

  return (
    <div
      className={`surf-parch frame flex h-full min-w-0 flex-col ${
        active ? 'active-scroll' : 'idle-scroll'
      }`}
      style={grain}
      aria-label={`Свиток игрока ${player.name}`}
    >
      {/* ── Шапка свитка ── */}
      <button
        type="button"
        onClick={onTapHead}
        className="surf-wood flex shrink-0 flex-col items-center gap-0.5 px-1 pb-1 pt-1.5 text-center"
      >
        <div className="flex items-center gap-1">
          <RaceIcon race={player.race} size={24} />
          <span
            className={`goth truncate text-[21px] leading-none ${active ? 'text-orc-bright torch' : 'text-parch'}`}
          >
            {player.name}
          </span>
        </div>

        <span
          className={`num text-[38px] leading-none ${
            player.barrel ? 'on-barrel my-1.5 px-1.5 text-gold-light' : 'text-parch'
          }`}
        >
          {player.score}
        </span>

        {player.barrel ? (
          <span className="tiny text-[12px] leading-none text-gold-light">
            {player.barrel.attempts - player.barrel.used}{' '}
            {plural(player.barrel.attempts - player.barrel.used, SIPS).toUpperCase()}
          </span>
        ) : (
          <span className="tiny flex items-center gap-[3px] leading-none" aria-label={`Болтов: ${player.bolts}`}>
            {Array.from({ length: Math.max(boltsMax, 1) }, (_, i) => (
              <span
                key={i}
                className={`inline-block h-[8px] w-[10px] ${
                  i < player.bolts ? 'bg-blood-bright' : 'bg-wood-dark'
                }`}
                style={{ boxShadow: '0 0 0 1px rgba(23,16,9,.8)' }}
              />
            ))}
          </span>
        )}
      </button>

      {/* ── Столбик записей ── */}
      <div ref={bodyRef} className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="tiny px-1 py-3 text-center text-[11px] leading-tight text-ink/45">
            ПУСТО
          </p>
        ) : (
          renderLines(entries)
        )}
      </div>
    </div>
  )
}
