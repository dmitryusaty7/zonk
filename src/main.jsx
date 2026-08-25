import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'

// В разработке стор и звук доступны из консоли — удобно для отладки,
// снимков вёрстки и проверки, что кузница звука не сыплет ошибками.
if (import.meta.env.DEV) {
  const [{ useGameStore }, { audio }, synth] = await Promise.all([
    import('./store/gameStore.js'),
    import('./audio/audioManager.js'),
    import('./audio/synth.js'),
  ])
  window.__zonk = useGameStore
  window.__audio = audio
  window.__synths = Object.keys(synth.SYNTHS)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
