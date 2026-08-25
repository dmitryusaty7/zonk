/**
 * MenuScreen.jsx — ПРИЧАЛ
 * Стартовый экран. Пока не заглянул в «Кодекс Бухты» — якорь не снять:
 * там же собирают команду, а без команды играть не с кем.
 */
import { useState } from 'react'
import { useGameStore } from '../store/gameStore.js'
import { TAVERN, TERMS } from '../data/lore.js'
import { raceById } from '../data/races.js'
import { gloryTable } from '../tma/storage.js'
import { tap, RaceIcon, Sprite, Coin, Ribbon, Modal } from './ui.jsx'

/* ─────────────────────── СЛАВА БУХТЫ ─────────────────────── */

function GloryModal({ onClose }) {
  const glory = useGameStore((s) => s.glory)
  const forget = useGameStore((s) => s.forgetGlory)
  const rows = gloryTable(glory)

  return (
    <Modal
      title={TERMS.glory}
      onClose={onClose}
      footer={
        rows.length > 0 && (
          <button
            type="button"
            className="btn w-full py-3 text-[16px]"
            onClick={() => {
              tap('warning')
              forget()
            }}
          >
            Пустить славу по ветру
          </button>
        )
      }
    >
      {rows.length === 0 ? (
        <p className="text-[17px] leading-tight text-parch-dim">
          Пока никто не забрал сундук. Победы считаются по имени персонажа и
          остаются здесь между партиями.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => (
            <li
              key={r.name}
              className={`surf-parch flex items-center gap-2 px-2 py-2 ${
                i === 0 ? 'frame-gold' : 'frame-thin'
              }`}
            >
              <span className="num w-6 text-[22px] leading-none text-ink/55">{i + 1}</span>
              <RaceIcon race={r.race} size={26} />
              <div className="min-w-0 flex-1">
                <span className="goth block truncate text-[21px] leading-none text-ink">{r.name}</span>
                <span className="tiny block text-[11px] leading-tight text-ink/60">
                  ПАРТИЙ {r.games} · ЛУЧШИЙ СЧЁТ {r.best}
                </span>
              </div>
              <span className="num text-[26px] leading-none text-ink">{r.wins}</span>
              <span className="tiny text-[11px] leading-none text-ink/60">ПОБ.</span>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  )
}

/* ─────────────────────── ПРИЧАЛ ─────────────────────── */

export default function MenuScreen() {
  const [glory, setGlory] = useState(false)
  const openCodex = useGameStore((s) => s.openCodex)
  const openRules = useGameStore((s) => s.openRules)
  const startGame = useGameStore((s) => s.startGame)
  const codexSeen = useGameStore((s) => s.codexSeen)
  const roster = useGameStore((s) => s.roster)
  const settings = useGameStore((s) => s.settings)
  const gloryCount = useGameStore((s) => Object.keys(s.glory).length)

  return (
    <div className="pad-tg-top flex h-dvh flex-col">
      {/* ── Вывеска ── */}
      <header className="surf-orc frame-gold nailed relative mx-2 px-3 pb-4 pt-6 text-center">
        <h1 className="goth text-[68px] leading-[0.8] text-gold">{TAVERN.game}</h1>
        <p className="mt-1 text-[17px] leading-tight text-orc-bright">{TAVERN.subtitle}</p>
        <Ribbon className="mt-3">{TAVERN.place}</Ribbon>

        {/* Очаг: единственный источник тепла в трюме */}
        <div className="mt-3 flex items-end justify-center gap-3">
          <Sprite name="mug" size={26} />
          <span className="hearth h-[52px] w-[52px]" role="img" aria-label="Очаг" />
          <Sprite name="fish" size={26} />
        </div>
        <p className="mt-1.5 text-[14px] leading-tight text-parch-dark">
          кости · золото · ром · драка
        </p>
      </header>

      {/* ── Команда одной строкой ── */}
      <div className="surf-board frame mx-2 mt-1 flex-1 overflow-y-auto px-3 py-3">
        <p className="tiny mb-2 text-[12px] leading-none text-orc-bright">ЗА СТОЛОМ</p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {roster.map((r, i) => (
            <span
              key={i}
              className="frame-thin surf-wood flex items-center gap-1.5 px-2 py-1.5"
            >
              <RaceIcon race={r.race} size={22} />
              <span className="text-[16px] leading-none text-parch">{r.name}</span>
            </span>
          ))}
        </div>

        <p className="tiny mb-2 text-[12px] leading-none text-orc-bright">КОДЕКС</p>
        <ul className="space-y-1 text-[15px] leading-tight text-parch-dim">
          <li>
            {TERMS.bank} — {settings.targetScore} <Coin size={13} />
          </li>
          <li>
            {TERMS.entry} — {settings.entryScore}
          </li>
          <li>
            {TERMS.barrel} — {settings.barrels.map((b) => b.value).join(', ') || 'нет'}
          </li>
          <li>
            {TERMS.wagon} — {settings.wagon.enabled ? settings.wagon.value : 'отменена'}
          </li>
          <li>
            {TERMS.backstab} — −{settings.backstab.penalty}
          </li>
        </ul>

        {!codexSeen && (
          <p className="frame-thin mt-4 bg-blood/30 px-2 py-2 text-[15px] leading-tight text-bone">
            Сперва загляни в {TERMS.codex}: там собирают команду и правят правила.
            Без этого якорь не снять.
          </p>
        )}
      </div>

      {/* ── Кнопки ── */}
      <footer className="pad-tg-bottom mx-2 mb-2 mt-1 space-y-1.5">
        <button
          type="button"
          className={`btn w-full py-4 text-[22px] leading-none ${codexSeen ? '' : 'btn-lamp'}`}
          onClick={() => {
            tap()
            openCodex()
          }}
        >
          {TERMS.codex}
        </button>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            className="btn py-3 text-[17px] leading-none"
            onClick={() => {
              tap()
              openRules()
            }}
          >
            Правила
          </button>
          <button
            type="button"
            className="btn py-3 text-[17px] leading-none"
            onClick={() => {
              tap()
              setGlory(true)
            }}
          >
            {TERMS.glory}
            {gloryCount > 0 && <span className="text-gold"> · {gloryCount}</span>}
          </button>
        </div>

        <button
          type="button"
          className="btn btn-gold w-full py-6 text-[34px] leading-none"
          onClick={() => {
            tap('heavy')
            startGame()
          }}
          disabled={!codexSeen || roster.length < 2}
        >
          {TERMS.start.toUpperCase()}
        </button>
      </footer>

      {glory && <GloryModal onClose={() => setGlory(false)} />}
    </div>
  )
}
