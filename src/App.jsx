/**
 * App.jsx — БУХТА
 * Собирает экраны, швартуется к Telegram и будит звук при первом касании.
 */
import { useEffect } from 'react'
import { useGameStore } from './store/gameStore.js'
import { audio } from './audio/audioManager.js'
import { initTelegram, backButton } from './tma/telegram.js'
import MenuScreen from './components/MenuScreen.jsx'
import CodexScreen from './components/CodexScreen.jsx'
import RulesScreen from './components/RulesScreen.jsx'
import GameScreen from './components/GameScreen.jsx'
import VictoryScreen from './components/VictoryScreen.jsx'
import Toast from './components/Toast.jsx'
import { HangingLantern, FlyBy } from './components/Scene.jsx'

/** Цвета хрома Telegram — под тёмный трюм. */
const CHROME = { header: '#12302f', background: '#070d10' }

export default function App() {
  const screen = useGameStore((s) => s.screen)
  const muted = useGameStore((s) => s.muted)
  const voicePack = useGameStore((s) => s.voicePack)
  const toMenu = useGameStore((s) => s.toMenu)
  const toShore = useGameStore((s) => s.toShore)
  const hydrateGlory = useGameStore((s) => s.hydrateGlory)

  // Швартовка к клиенту Telegram. В обычном браузере просто ничего не делает.
  useEffect(() => {
    initTelegram(CHROME)
    hydrateGlory()
  }, [hydrateGlory])

  // Звук слушает шину событий всю жизнь приложения
  useEffect(() => audio.listen(), [])

  // Браузер даёт звук только после настоящего касания
  useEffect(() => {
    const wake = () => {
      audio.unlock()
      if (audio.ctx?.state === 'running') {
        window.removeEventListener('pointerdown', wake)
        window.removeEventListener('keydown', wake)
      }
    }
    window.addEventListener('pointerdown', wake)
    window.addEventListener('keydown', wake)
    return () => {
      window.removeEventListener('pointerdown', wake)
      window.removeEventListener('keydown', wake)
    }
  }, [])

  useEffect(() => audio.setMuted(muted), [muted])
  useEffect(() => audio.setVoicePack(voicePack), [voicePack])

  // Кнопка «назад» в шапке Telegram ведёт туда же, куда и по смыслу экрана
  useEffect(() => {
    if (screen === 'menu') return backButton(false)
    const back = screen === 'codex' || screen === 'rules' ? toMenu : toShore
    return backButton(true, back)
  }, [screen, toMenu, toShore])

  return (
    <>
      {screen === 'menu' && <MenuScreen />}
      {screen === 'codex' && <CodexScreen />}
      {screen === 'rules' && <RulesScreen />}
      {screen === 'game' && <GameScreen />}
      {screen === 'victory' && <VictoryScreen />}
      {/* За столом фонарь только мешал бы кнопкам в балке */}
      {screen !== 'game' && <HangingLantern />}
      <FlyBy />
      <Toast />
    </>
  )
}
