/**
 * Toast.jsx — ВОПЛИ БУХТЫ
 * Короткие реплики на события партии и служебные сообщения журнала.
 * Висят долго: их читают между бросками, а не ловят краем глаза.
 */
import { useEffect, useState } from 'react'
import { on } from '../audio/bus.js'
import { reactionFor } from '../data/lore.js'
import { useGameStore } from '../store/gameStore.js'

/** Столько держим реплику на экране. */
const LIFETIME = 3800

/** События, ради которых стоит открывать рот. */
const LOUD = new Set([
  'gameStart', 'bolt', 'boltPenalty', 'foul', 'barrelSit', 'barrelMiss', 'barrelFall',
  'knockOff', 'wagon', 'backstab', 'overshoot', 'noEntry', 'win', 'undo', 'score', 'bigScore', 'finale',
])

export default function Toast() {
  const [msg, setMsg] = useState(null)
  const storeToast = useGameStore((s) => s.toast)
  const setToast = useGameStore((s) => s.setToast)

  // реплики на события движка
  useEffect(
    () =>
      on((e) => {
        let key = e.type
        if (key === 'score' && e.points >= 300) key = 'bigScore'
        if (!LOUD.has(key)) return
        const text = reactionFor(key)
        if (text) setMsg({ text, kind: key === 'win' ? 'win' : 'event', at: Date.now() })
      }),
    [],
  )

  // служебные сообщения журнала
  useEffect(() => {
    if (!storeToast) return
    setMsg({ ...storeToast, at: Date.now() })
    setToast(null)
  }, [storeToast, setToast])

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), LIFETIME)
    return () => clearTimeout(t)
  }, [msg])

  if (!msg) return null

  const tone =
    msg.kind === 'error'
      ? 'bg-blood text-bone'
      : msg.kind === 'win'
        ? 'bg-gold text-ink-deep'
        : 'surf-parch text-ink'

  return (
    <div
      // Садится вплотную над пультом: не закрывает ни счёт, ни кнопки.
      className="pointer-events-none fixed inset-x-3 z-40 flex justify-center"
      // Заметно выше пульта: реплику читают между бросками, и она не должна
      // липнуть к кнопкам. На экранах без пульта держимся ещё выше.
      style={{ bottom: 'max(calc(var(--pad-h, 0px) + 34px), 150px)' }}
      role="status"
      aria-live="polite"
    >
      <p className={`frame toast-in max-w-[94%] px-3 py-2 text-center text-[17px] leading-tight ${tone}`}>
        {msg.text}
      </p>
    </div>
  )
}
