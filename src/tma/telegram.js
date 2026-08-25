/**
 * telegram.js — ШВАРТОВКА К TELEGRAM
 * ------------------------------------------------------------------
 * Тонкая обёртка над window.Telegram.WebApp. Всё, что умеет клиент
 * Telegram, спрятано здесь; остальное приложение про него не знает
 * и одинаково работает в обычном браузере, в PWA и внутри мессенджера.
 *
 * Каждый вызов защищён: старые клиенты бросают исключение на методах,
 * которых у них нет («method is not supported in version 6.0»).
 */

const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null

/** Мы действительно внутри Telegram, а не просто подключили скрипт. */
export const insideTelegram = !!tg && (!!tg.initData || (tg.platform && tg.platform !== 'unknown'))

/** Вызвать метод клиента, не роняя приложение на старых версиях. */
function safe(fn, label) {
  try {
    return fn()
  } catch (err) {
    if (import.meta.env?.DEV) console.info(`[tma] ${label} недоступен:`, err?.message)
    return undefined
  }
}

const atLeast = (v) => {
  try {
    return !!tg?.isVersionAtLeast?.(v)
  } catch {
    return false
  }
}

/** Отступы Telegram уезжают в CSS-переменные — вёрстка про них уже знает. */
function applyInsets() {
  if (!tg) return
  const root = document.documentElement
  const safeArea = tg.safeAreaInset || {}
  const content = tg.contentSafeAreaInset || {}
  const top = (safeArea.top || 0) + (content.top || 0)
  const bottom = (safeArea.bottom || 0) + (content.bottom || 0)
  root.style.setProperty('--tg-top', `${top}px`)
  root.style.setProperty('--tg-bottom', `${bottom}px`)
  if (tg.viewportStableHeight) {
    root.style.setProperty('--tg-height', `${tg.viewportStableHeight}px`)
  }
}

/**
 * Пришвартоваться. Возвращает описание клиента — его показываем в «Кодексе».
 * @param {{ header: string, background: string }} colors цвета под нашу палитру
 */
export function initTelegram(colors) {
  if (!tg) return { inside: false, platform: 'browser', version: '—' }

  // Скрипт SDK грузится всегда, но вне мессенджера объект пустой и
  // отвечает «не поддерживается в версии 6.0» на каждый вызов.
  // Снаружи просто не трогаем его — и консоль остаётся чистой.
  if (!insideTelegram) {
    return { inside: false, platform: tg.platform || 'browser', version: tg.version || '—' }
  }

  safe(() => tg.ready(), 'ready')
  safe(() => tg.expand(), 'expand')

  // Свайп вниз закрывает мини-приложение — а у нас свитки листаются
  // пальцем сверху вниз. Отключаем, иначе игра будет закрываться сама.
  if (atLeast('7.7')) safe(() => tg.disableVerticalSwipes(), 'disableVerticalSwipes')

  // Хром клиента красим под трюм: иначе сверху висит светлая полоса
  if (atLeast('6.1')) {
    safe(() => tg.setHeaderColor(colors.header), 'setHeaderColor')
    safe(() => tg.setBackgroundColor(colors.background), 'setBackgroundColor')
  }
  if (atLeast('7.10')) safe(() => tg.setBottomBarColor(colors.background), 'setBottomBarColor')

  applyInsets()
  safe(() => tg.onEvent('viewportChanged', applyInsets), 'viewportChanged')
  if (atLeast('8.0')) {
    safe(() => tg.onEvent('safeAreaChanged', applyInsets), 'safeAreaChanged')
    safe(() => tg.onEvent('contentSafeAreaChanged', applyInsets), 'contentSafeAreaChanged')
  }

  return {
    inside: insideTelegram,
    platform: tg.platform || 'unknown',
    version: tg.version || '—',
    user: tg.initDataUnsafe?.user || null,
  }
}

/**
 * Отклик в руку. В Telegram — родная вибрация, в браузере — Vibration API.
 * @param {'light'|'medium'|'heavy'|'rigid'|'soft'|'success'|'error'|'warning'} kind
 */
export function haptic(kind = 'light') {
  const h = insideTelegram ? tg?.HapticFeedback : null
  if (h) {
    if (kind === 'success' || kind === 'error' || kind === 'warning') {
      safe(() => h.notificationOccurred(kind), 'notificationOccurred')
    } else {
      safe(() => h.impactOccurred(kind), 'impactOccurred')
    }
    return
  }
  if (navigator.vibrate) {
    navigator.vibrate(kind === 'heavy' ? 40 : kind === 'medium' ? 22 : 12)
  }
}

/** Кнопка «назад» в шапке клиента. Возвращает функцию отписки. */
export function backButton(visible, handler) {
  const b = insideTelegram ? tg?.BackButton : null
  if (!b) return () => {}
  if (!visible) {
    safe(() => b.hide(), 'BackButton.hide')
    return () => {}
  }
  safe(() => b.onClick(handler), 'BackButton.onClick')
  safe(() => b.show(), 'BackButton.show')
  return () => {
    safe(() => b.offClick(handler), 'BackButton.offClick')
    safe(() => b.hide(), 'BackButton.hide')
  }
}

/** Закрыть мини-приложение (кнопка «Сойти на берег»). */
export function closeApp() {
  safe(() => tg?.close(), 'close')
}

export { tg }
