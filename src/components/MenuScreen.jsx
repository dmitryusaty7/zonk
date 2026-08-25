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
    <div className="screen pad-tg-top">
      {/* Вывеска и обстановка прокручиваются вместе: на низком экране
          неподвижная шапка выдавливала кнопки за край. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
      {/* ── Вывеска ── */}
      <header className="surf-orc frame-gold nailed relative mx-2 px-3 pb-4 pt-6 text-center">
        <h1 className="goth text-[68px] leading-[0.8] text-gold">{TAVERN.game}</h1>
        <p className="mt-1 text-[17px] leading-tight text-orc-bright">{TAVERN.subtitle}</p>
        <Ribbon className="mt-3">{TAVERN.place}</Ribbon>

        {/* Рыба-трофей на стене — гордость заведения */}
        <div className="mt-3 flex items-center justify-center gap-4">
          <span className="trophy" role="img" aria-label="Рыба-пила на доске">
            <Sprite name="sawfish" size={96} style={{ height: 48 }} />
          </span>
          <span className="hearth h-[56px] w-[56px]" role="img" aria-label="Очаг" />
        </div>

        {/* Стойка бармена: зелёные бутыли с пойлом и кружка */}
        <div className="mt-3 flex items-end justify-center gap-1.5 px-2">
          <Sprite name="bottle" size={24} />
          <Sprite name="bottle" size={28} />
          <Sprite name="mug" size={26} />
          <Sprite name="bottle" size={26} />
          <Sprite name="parrot" size={24} />
          <Sprite name="bottle" size={24} />
        </div>
        <div className="counter mx-1 mt-[-2px] h-[10px]" aria-hidden="true" />
        <p className="mt-2 text-[14px] leading-tight text-parch-dark">
          кости · золото · ром · драка
        </p>
      </header>

      {/* ── Команда одной строкой ── */}
      <div className="surf-board frame mx-2 mb-1 mt-1 px-3 py-3">
        <p className="tiny mb-2 text-[12px] leading-none text-orc-bright">ЗА СТОЛОМ</p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {roster.map((r, i) => (
            <span
              key={i}
              className="frame-thin surf-oak flex items-center gap-1.5 px-2 py-1.5"
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
      </div>

      {/* ── Кнопки ── */}
      <footer className="pad-tg-bottom mx-2 mb-2 mt-1 shrink-0 space-y-1.5">
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

      {/* Краб бегает по дну экрана и никому не мешает */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-6 overflow-hidden">
        <Sprite name="crab" size={22} className="crab-walk" />
      </div>

      {glory && <GloryModal onClose={() => setGlory(false)} />}
    </div>
  )
}
