/**
 * ui.jsx — УТВАРЬ
 * Мелкие общие детали интерфейса: рамы, счётчики, засовы, окна.
 */
import { useEffect } from 'react'
import { audio } from '../audio/audioManager.js'
import { haptic } from '../tma/telegram.js'

/**
 * Отклик на нажатие — один на всё приложение.
 * Здесь же будим звук: браузеры пускают WebAudio только после
 * настоящего касания, и первое нажатие в игре — как раз оно.
 */
export function tap(kind = 'light') {
  audio.unlock()
  audio.play('click', { gain: 0.5 })
  haptic(kind)
}

/* ─────────────────────────── ЗАГОЛОВОК РАЗДЕЛА ─────────────────────────── */

export function Rubric({ children, hint }) {
  return (
    <div className="mb-2 mt-4 first:mt-0">
      <h3 className="goth text-[23px] leading-none text-orc-bright uppercase tracking-wide">{children}</h3>
      {hint && <p className="mt-1 text-[13px] leading-tight text-parch-dark">{hint}</p>}
    </div>
  )
}

/* ─────────────────────────── СЧЁТЧИК ─────────────────────────── */

export function Stepper({ label, value, onChange, step = 5, min = 0, max = 9999, suffix, compact }) {
  const set = (v) => {
    const next = Math.max(min, Math.min(max, v))
    if (next !== value) {
      tap()
      onChange(next)
    }
  }
  return (
    <div className={`flex items-center gap-2 ${compact ? '' : 'justify-between'}`}>
      {label && <span className="flex-1 text-[18px] leading-tight text-parch">{label}</span>}
      <div className="flex items-stretch">
        <button
          type="button"
          className="btn h-11 w-11 text-[26px] leading-none"
          onClick={() => set(value - step)}
          aria-label={`${label || 'значение'}: убавить`}
        >
          −
        </button>
        <input
          className="field num mx-1 h-11 w-[82px] text-center text-[22px]"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => {
            const v = parseInt(e.target.value.replace(/\D/g, ''), 10)
            onChange(Number.isNaN(v) ? min : Math.max(min, Math.min(max, v)))
          }}
          aria-label={label}
        />
        <button
          type="button"
          className="btn h-11 w-11 text-[26px] leading-none"
          onClick={() => set(value + step)}
          aria-label={`${label || 'значение'}: прибавить`}
        >
          +
        </button>
      </div>
      {suffix && <span className="tiny w-8 text-[12px] text-parch-dark">{suffix}</span>}
    </div>
  )
}

/* ─────────────────────────── ЗАСОВ (переключатель) ─────────────────────────── */

export function Latch({ label, checked, onChange, hint }) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 py-1.5 text-left"
      onClick={() => {
        tap()
        onChange(!checked)
      }}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`frame-thin flex h-7 w-7 shrink-0 items-center justify-center text-[16px] leading-none ${
          checked ? 'bg-orc-light text-ink-deep' : 'bg-wood-dark text-parch-dark'
        }`}
      >
        {checked ? '✓' : ''}
      </span>
      <span className="flex-1">
        <span className="block text-[17px] leading-tight text-parch">{label}</span>
        {hint && <span className="block text-[13px] leading-tight text-parch-dark">{hint}</span>}
      </span>
    </button>
  )
}

/* ─────────────────────────── ВЫБОР ИЗ НЕСКОЛЬКИХ ─────────────────────────── */

export function Choice({ label, value, options, onChange }) {
  return (
    <div className="py-1.5">
      {label && <span className="mb-1 block text-[17px] leading-tight text-parch">{label}</span>}
      <div className="flex gap-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`btn flex-1 px-2 py-2.5 text-[15px] leading-tight ${
              value === o.value ? 'btn-orc' : ''
            }`}
            onClick={() => {
              tap()
              onChange(o.value)
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────── ОКНО ─────────────────────────── */

export function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  return (
    <div className="pad-tg-top fixed inset-0 z-50 flex flex-col bg-soot/90" role="dialog" aria-modal="true">
      <div className="surf-orc frame-gold mx-2 flex items-center gap-2 px-3 py-2">
        <h2 className="goth flex-1 text-[26px] leading-none text-gold uppercase">{title}</h2>
        <button
          type="button"
          className="btn h-10 w-10 text-[20px] leading-none"
          onClick={() => {
            tap()
            onClose()
          }}
          aria-label="Закрыть"
        >
          ✕
        </button>
      </div>
      <div className="surf-board frame mx-2 mt-1 flex-1 overflow-y-auto px-3 py-3">{children}</div>
      {footer && <div className="mx-2 mb-2 mt-1">{footer}</div>}
      <div className="pad-tg-bottom" />
    </div>
  )
}

/* ─────────────────────────── ЗЛАТОЙ ─────────────────────────── */

/** Монета — знак валюты кабака. */
export function Coin({ size = 16 }) {
  return <span className="coin" style={{ width: size, height: size }} aria-hidden="true" />
}

/* ─────────────────────────── КРАСНАЯ ЛЕНТА ─────────────────────────── */

/** Полоса красной тряпки с надписью — орки вешают такие над стойкой. */
export function Ribbon({ children, className = '' }) {
  return (
    <div className={`ribbon mx-3 px-3 py-1 text-center ${className}`}>
      <span className="tiny block text-[12px] leading-tight text-bone">{children}</span>
    </div>
  )
}

/* ─────────────────────────── ГЕРБ ─────────────────────────── */

export function Emblem({ mark, size = 24, dim }) {
  return (
    <span
      className={`emblem inline-flex items-center justify-center leading-none ${dim ? "opacity-50" : ""}`}
      style={{ fontSize: size, width: size * 1.15, height: size * 1.15 }}
      aria-hidden="true"
    >
      {mark}
    </span>
  )
}
