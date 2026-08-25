/**
 * useReaction.js — ЧТО КРИЧАТ ЗА СТОЛОМ
 * ------------------------------------------------------------------
 * Одна подписка на шину событий для всех, кто показывает реплики.
 * Раньше это жило внутри всплывающей плашки, но плашка занимала
 * половину экрана; теперь реплика вылетает прямо с нажатой кнопки,
 * а хук общий — чтобы логика выбора текста не разъехалась по копиям.
 */
import { useEffect, useState } from 'react'
import { on } from '../audio/bus.js'
import { reactionFor } from '../data/lore.js'
import { useGameStore } from '../store/gameStore.js'

/** Сколько держим реплику на экране. */
export const REACTION_LIFETIME = 3600

/** События, ради которых стоит открывать рот. */
const LOUD = new Set([
  'gameStart', 'bolt', 'boltPenalty', 'foul', 'barrelSit', 'barrelMiss', 'barrelFall',
  'knockOff', 'wagon', 'backstab', 'overshoot', 'noEntry', 'win', 'undo', 'score',
  'bigScore', 'finale',
])

/**
 * Текущая реплика или null.
 * @returns {{text: string, kind: 'event'|'win'|'error'|'info'} | null}
 */
export function useReaction() {
  const [msg, setMsg] = useState(null)
  const storeToast = useGameStore((s) => s.toast)
  const setToast = useGameStore((s) => s.setToast)

  // вопли на события движка
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
    const t = setTimeout(() => setMsg(null), REACTION_LIFETIME)
    return () => clearTimeout(t)
  }, [msg])

  return msg
}
