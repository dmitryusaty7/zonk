/**
 * Toast.jsx — ВОПЛИ ВНЕ ПАРТИИ
 * За столом реплики вылетают прямо с кнопки (см. InputPad), а на причале
 * и в кодексе кнопки редкие — там сообщение показывается плашкой.
 */
import { useReaction } from './useReaction.js'

export default function Toast() {
  const msg = useReaction()
  if (!msg) return null

  const tone =
    msg.kind === 'error'
      ? 'bg-blood text-bone'
      : msg.kind === 'win'
        ? 'bg-gold text-ink-deep'
        : 'surf-parch text-ink'

  return (
    <div
      className="pointer-events-none fixed inset-x-3 z-40 flex justify-center"
      style={{ bottom: 'max(calc(var(--tg-bottom) + 96px), 110px)' }}
      role="status"
      aria-live="polite"
    >
      <p className={`frame toast-in max-w-[94%] px-3 py-2 text-center text-[17px] leading-tight ${tone}`}>
        {msg.text}
      </p>
    </div>
  )
}
