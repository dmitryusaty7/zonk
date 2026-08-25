/**
 * audioManager.js — КОРЧМАРЬ У БОЧКИ С ЗВУКОМ
 * ------------------------------------------------------------------
 * Слушает шину событий и озвучивает партию.
 *
 * Два слоя:
 *   1. ЗВУКИ — лязг мечей, стук кружек, скрип пера. По умолчанию звучат
 *      процедурно (synth.js). Если положить файл в public/sounds/<слот>.mp3 —
 *      менеджер подхватит его и будет играть вместо синтеза.
 *   2. ГОЛОСА — реплики (в т.ч. орочьи из Warcraft III). Файлов в поставке нет:
 *      это чужое добро. Пак описан в data/lore.js; кладёшь файлы в
 *      public/sounds/voice/<пак>/ — они начинают звучать. Нет файла — тишина,
 *      без единой ошибки в консоли.
 */
import { SYNTHS } from './synth.js'
import { VOICE_PACKS } from '../data/lore.js'
import { on } from './bus.js'

/** Событие движка → звуковой слот, голосовой слот, сила тряски экрана. */
export const EVENT_MAP = {
  gameStart: { sound: 'mug', voice: 'gameStart' },
  score: { sound: 'quill', voice: 'score' },
  bigScore: { sound: 'mug', voice: 'bigScore', shake: 1 },
  bolt: { sound: 'bolt', voice: 'bolt' },
  boltPenalty: { sound: 'sword', voice: 'boltPenalty', shake: 2 },
  foul: { sound: 'sword', voice: 'foul', shake: 1 },
  barrelSit: { sound: 'barrel', voice: 'barrelSit', shake: 1 },
  barrelMiss: { sound: 'bolt', voice: 'barrelMiss' },
  barrelFall: { sound: 'crash', voice: 'barrelFall', shake: 2 },
  knockOff: { sound: 'sword', voice: 'knockOff', shake: 2 },
  wagon: { sound: 'crash', voice: 'wagon', shake: 3 },
  backstab: { sound: 'sword', voice: 'backstab', shake: 2 },
  overshoot: { sound: 'bolt', voice: 'overshoot' },
  noEntry: { sound: 'bolt', voice: 'noEntry' },
  win: { sound: 'horn', voice: 'win', shake: 2 },
  finale: { sound: 'barrel', shake: 2 },
  undo: { sound: 'scrape' },
  click: { sound: 'click' },
}

/** Порог, после которого бросок считается славным. */
const BIG_SCORE = 300

class AudioManager {
  constructor() {
    this.ctx = null
    this.master = null
    this.muted = false
    this.volume = 0.7
    this.voicePack = 'pirate'
    this.samples = new Map() // slot -> AudioBuffer | null (null = файла нет)
    this.voices = new Map() // url -> AudioBuffer | null
    this.lastVoiceAt = 0
    this.unsub = null
  }

  /** Разбудить звук. Вызывать из обработчика реального касания. */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return false
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : this.volume
      this.master.connect(this.ctx.destination)
      this.preloadSamples()
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
    return true
  }

  setMuted(muted) {
    this.muted = muted
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.02)
    }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v))
    if (this.master && !this.muted) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02)
    }
  }

  setVoicePack(id) {
    this.voicePack = id
  }

  /**
   * Можно ли вообще ходить за файлами. Страница, открытая как файл
   * (один лист на телефоне), живёт в «пустом» источнике — браузер режет
   * ей любой fetch. Стучаться незачем: процедурные звуки и так на месте.
   */
  get canLoadFiles() {
    const p = globalThis.location?.protocol
    return p === 'http:' || p === 'https:'
  }

  /** Попытаться загрузить файл; вернуть буфер либо null, если файла нет. */
  async load(url) {
    if (!this.canLoadFiles) return null
    try {
      const res = await fetch(url, { cache: 'force-cache' })
      if (!res.ok) return null
      const type = res.headers.get('content-type') || ''
      // dev-сервер на несуществующий файл отдаёт index.html — это не звук
      if (type.includes('text/html')) return null
      const buf = await res.arrayBuffer()
      if (buf.byteLength < 64) return null
      return await this.ctx.decodeAudioData(buf)
    } catch {
      return null
    }
  }

  /** Подменить процедурные звуки файлами, если их положили в public/sounds. */
  async preloadSamples() {
    if (!this.canLoadFiles) return
    Object.keys(SYNTHS).forEach(async (slot) => {
      if (this.samples.has(slot)) return
      this.samples.set(slot, null)
      const buf = await this.load(`/sounds/${slot}.mp3`)
      if (buf) this.samples.set(slot, buf)
    })
  }

  playBuffer(buf, gain = 1, when = 0) {
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    const g = this.ctx.createGain()
    g.gain.value = gain
    src.connect(g).connect(this.master)
    src.start(this.ctx.currentTime + when)
    return src
  }

  /** Сыграть слот: файл, если есть, иначе процедурный звук. */
  play(slot, { gain = 1 } = {}) {
    if (!this.ctx || this.muted) return
    if (this.ctx.state === 'suspended') this.ctx.resume()
    const sample = this.samples.get(slot)
    if (sample) {
      this.playBuffer(sample, gain)
      return
    }
    const synth = SYNTHS[slot]
    if (!synth) return
    const out = this.ctx.createGain()
    out.gain.value = gain
    out.connect(this.master)
    synth(this.ctx, out, this.ctx.currentTime + 0.001)
  }

  /** Реплика из голосового пака. Молчит, если файлов нет. */
  async speak(voiceSlot) {
    if (!this.ctx || this.muted || !voiceSlot) return
    const pack = VOICE_PACKS[this.voicePack]
    if (!pack?.dir) return
    const lines = pack.lines[voiceSlot]
    if (!lines?.length) return
    // не тараторить: не чаще раза в 1.2 секунды
    const now = performance.now()
    if (now - this.lastVoiceAt < 1200) return
    this.lastVoiceAt = now

    const file = lines[Math.floor(Math.random() * lines.length)]
    const url = pack.dir + file
    if (!this.voices.has(url)) {
      this.voices.set(url, null)
      const buf = await this.load(url)
      this.voices.set(url, buf)
    }
    const buf = this.voices.get(url)
    if (buf) this.playBuffer(buf, 0.9, 0.12)
  }

  /** Обработать событие из шины. */
  handle(event) {
    if (!event?.type) return
    let key = event.type
    if (key === 'score' && event.points >= BIG_SCORE) key = 'bigScore'
    const rule = EVENT_MAP[key]
    if (!rule) return
    this.play(rule.sound)
    this.speak(rule.voice)
    if (rule.shake) shakeScreen(rule.shake)
  }

  /** Подписаться на шину. Возвращает функцию отписки. */
  listen() {
    this.unsub?.()
    this.unsub = on((e) => this.handle(e))
    return this.unsub
  }
}

export const audio = new AudioManager()

/** Тряска экрана — визуальный аналог удара. */
export function shakeScreen(force = 1) {
  const root = document.documentElement
  root.style.setProperty('--shake-force', String(force))
  root.classList.remove('is-shaking')
  // перезапуск анимации
  void root.offsetWidth
  root.classList.add('is-shaking')
  window.setTimeout(() => root.classList.remove('is-shaking'), 420)
  if (navigator.vibrate) navigator.vibrate(force === 1 ? 20 : force === 2 ? [30, 40, 30] : [50, 40, 60])
}
