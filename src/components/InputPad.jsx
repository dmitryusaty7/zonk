/**
 * InputPad.jsx — ПУЛЬТ ПИСАРЯ
 * ------------------------------------------------------------------
 * Набор золота за ход. Перебросы игроки считают в уме — кнопки «Кураж»
 * здесь нет намеренно. Ввод только номиналами: любое набранное число
 * заведомо кратно шагу счёта, кривое ввести нечем.
 *
 * Иерархия жёсткая: «Записать» и «Ржавый крючок» — во всю ширину,
 * редкие штрафы Хозяина Бухты — мелкой строкой внизу.
 */
import { useEffect, useRef } from 'react'
import { useGameStore, selectCurrent } from '../store/gameStore.js'
import { barrelNeed } from '../engine/rulesEngine.js'
import { TERMS, plural, SIPS } from '../data/lore.js'
import { tap, RaceIcon, Coin } from './ui.jsx'

/** Ходовые номиналы. Крупные суммы набираются повтором. */
const QUICK = [5, 10, 25, 50, 100]

export default function InputPad() {
  const boxRef = useRef(null)
  const player = useGameStore(selectCurrent)
  const settings = useGameStore((s) => s.settings)
  const pad = useGameStore((s) => s.pad)
  const padAdd = useGameStore((s) => s.padAdd)
  const padClear = useGameStore((s) => s.padClear)
  const writeScore = useGameStore((s) => s.writeScore)
  const writeBolt = useGameStore((s) => s.writeBolt)
  const writeFoul = useGameStore((s) => s.writeFoul)

  // Вопли Бухты садятся ровно над пультом — он сообщает свою высоту.
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const root = document.documentElement
    const ro = new ResizeObserver(([e]) => {
      root.style.setProperty('--pad-h', `${Math.round(e.contentRect.height)}px`)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.setProperty('--pad-h', '0px')
    }
  }, [])

  if (!player) return null

  const total = Number(pad) || 0
  const onBarrel = !!player.barrel
  const need = barrelNeed(player, settings)
  const sipsLeft = onBarrel ? player.barrel.attempts - player.barrel.used : 0

  // На бочке пишем только полный выход к сундуку. Недобор — провал,
  // и он оформляется крючком, а не записью.
  const canWrite = onBarrel ? total >= need : total > 0
  const winning = onBarrel && total >= need

  const act = (fn, kind = 'light') => () => {
    tap(kind)
    fn()
  }

  return (
    <section
      ref={boxRef}
      className="surf-oak frame-gold pad-tg-bottom mx-2 shrink-0 px-2 pb-2 pt-2"
      aria-label="Пульт записи золота"
    >
      {/* ── Чей ход и что от него требуется ── */}
      <div className="mb-2 flex items-center gap-2">
        <RaceIcon race={player.race} size={26} />
        <span className="goth text-[24px] leading-none text-orc-bright">{player.name}</span>
        <span className="flex-1" />
        {onBarrel ? (
          <span className="num text-right text-[15px] leading-tight text-gold-light">
            НУЖНО {need}
            <span className="tiny block text-[12px] text-lamp">
              ОСТАЛОСЬ {sipsLeft} {plural(sipsLeft, SIPS).toUpperCase()}
            </span>
          </span>
        ) : !player.entered ? (
          <span className="num text-[15px] leading-none text-parch-dim">
            В ОБЩАК ОТ {settings.entryScore}
          </span>
        ) : (
          <span className="num text-[15px] leading-none text-parch-dim">
            ДО СУНДУКА {settings.targetScore - player.score}
          </span>
        )}
      </div>

      {/* ── Табло ── */}
      <div className="frame-thin surf-parch mb-2 flex items-center gap-2 px-2 py-1.5">
        <span className="tiny text-[12px] leading-tight text-ink/60">ЗА ХОД</span>
        <span className="num flex-1 text-right text-[46px] leading-none text-ink">{total}</span>
        <Coin size={24} />
        <button
          type="button"
          className="btn h-11 w-11 text-[18px] leading-none"
          onClick={act(padClear)}
          disabled={total <= 0}
          aria-label="Стереть набранное"
        >
          ✕
        </button>
      </div>

      {/* ── Номиналы: крупные, под палец ── */}
      <div className="mb-2 grid grid-cols-5 gap-1.5">
        {QUICK.map((v) => (
          <button
            key={v}
            type="button"
            className="btn num py-5 text-[24px] leading-none"
            onClick={act(() => padAdd(v))}
          >
            +{v}
          </button>
        ))}
      </div>

      {/* ── Уловы ── */}
      <div className="mb-2 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          className="btn py-2.5 text-[16px] leading-tight"
          onClick={act(() => padAdd(settings.streets.small))}
        >
          {TERMS.streetSmall}
          <span className="num block text-[14px] leading-tight text-gold-light">
            +{settings.streets.small}
          </span>
        </button>
        <button
          type="button"
          className="btn py-2.5 text-[16px] leading-tight"
          onClick={act(() => padAdd(settings.streets.big))}
        >
          {TERMS.streetBig}
          <span className="num block text-[14px] leading-tight text-gold-light">
            +{settings.streets.big}
          </span>
        </button>
      </div>

      {/* ── ГЛАВНОЕ ДЕЙСТВИЕ ── */}
      <button
        type="button"
        className={`mb-1.5 w-full py-6 text-[30px] leading-none ${
          winning ? 'btn btn-chest' : 'btn btn-gold'
        }`}
        onClick={act(writeScore, winning ? 'success' : 'medium')}
        disabled={!canWrite}
      >
        {winning ? TERMS.win : `ЗАПИСАТЬ${total > 0 ? ` ${total}` : ''}`}
      </button>

      {/* ── Провал хода: на бочке эта кнопка особенно нужна ── */}
      <button
        type="button"
        className="btn btn-blood mb-2 w-full py-5 text-[24px] leading-none"
        onClick={act(writeBolt, 'error')}
      >
        {TERMS.bolt.toUpperCase()}
        {onBarrel && total > 0 && total < need && (
          <span className="tiny block text-[12px] leading-tight text-bone/80">
            МАЛО ДЛЯ СУНДУКА — ГЛОТОК СГОРИТ
          </span>
        )}
      </button>

      {/* ── Редкие штрафы: нарочно мелко ── */}
      <div className="grid grid-cols-2 gap-1">
        {[
          ['mud', TERMS.foulMud],
          ['crooked', TERMS.foulCrooked],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            className="btn-foul px-1 py-1.5 text-[11px] leading-tight"
            onClick={act(() => writeFoul(k), 'warning')}
          >
            {label.toUpperCase()}
            <span className="block text-[10px] text-blood-bright">КРЮЧОК</span>
          </button>
        ))}
      </div>
    </section>
  )
}
