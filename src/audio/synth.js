/**
 * synth.js — КУЗНИЦА ЗВУКА
 * ------------------------------------------------------------------
 * Процедурные звуки на WebAudio. Ни одного внешнего файла: лязг мечей,
 * стук деревянных кружек, скрип пера, грохот телеги и рог победы
 * собираются из шума и осцилляторов прямо в браузере.
 *
 * Каждая функция: (ctx, out, t0) => void, где out — общий выход с громкостью.
 */

function noiseBuffer(ctx, seconds = 1) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return buf
}

let cachedNoise = null
function noise(ctx, dur) {
  if (!cachedNoise || cachedNoise.ctx !== ctx) {
    cachedNoise = { ctx, buf: noiseBuffer(ctx, 2) }
  }
  const src = ctx.createBufferSource()
  src.buffer = cachedNoise.buf
  src.loop = true
  return src
}

/** Огибающая: атака — мгновенная, спад — экспоненциальный. */
function env(ctx, t0, peak, decay, attack = 0.004) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay)
  return g
}

function band(ctx, type, freq, q = 1) {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  return f
}

function tone(ctx, out, t0, { type = 'sine', from, to, peak = 0.3, decay = 0.2, attack = 0.004 }) {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(from, t0)
  if (to && to !== from) o.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + decay)
  const g = env(ctx, t0, peak, decay, attack)
  o.connect(g).connect(out)
  o.start(t0)
  o.stop(t0 + decay + attack + 0.05)
}

function hit(ctx, out, t0, { freq, q = 1, peak = 0.3, decay = 0.1, type = 'bandpass' }) {
  const n = noise(ctx, decay)
  const f = band(ctx, type, freq, q)
  const g = env(ctx, t0, peak, decay)
  n.connect(f).connect(g).connect(out)
  n.start(t0)
  n.stop(t0 + decay + 0.06)
}

// ────────────────────────────── ГОЛОСА ──────────────────────────────

/** Лязг мечей — штраф, удар в спину, сброс с бочки. */
export function swordClang(ctx, out, t0) {
  hit(ctx, out, t0, { freq: 3200, q: 0.7, peak: 0.32, decay: 0.28 })
  // негармоничные призвуки железа
  ;[1870, 2490, 3310, 4620].forEach((f, i) => {
    tone(ctx, out, t0 + i * 0.006, {
      type: 'triangle',
      from: f,
      to: f * 0.94,
      peak: 0.14 - i * 0.025,
      decay: 0.45 - i * 0.06,
    })
  })
  tone(ctx, out, t0, { type: 'sine', from: 180, to: 90, peak: 0.18, decay: 0.12 })
}

/** Стук деревянных кружек — успех, начало партии. */
export function mugThud(ctx, out, t0) {
  tone(ctx, out, t0, { type: 'sine', from: 150, to: 62, peak: 0.42, decay: 0.16 })
  hit(ctx, out, t0, { freq: 820, q: 2.5, peak: 0.3, decay: 0.06 })
  hit(ctx, out, t0 + 0.045, { freq: 1400, q: 3, peak: 0.14, decay: 0.05 })
  // плеснуло через край
  hit(ctx, out, t0 + 0.07, { freq: 5200, q: 0.6, peak: 0.06, decay: 0.18, type: 'highpass' })
}

/** Скрип пера по пергаменту — запись в свиток. */
export function quill(ctx, out, t0) {
  const n = noise(ctx, 0.3)
  const f = band(ctx, 'bandpass', 2400, 1.4)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  // перо скребёт неровно
  for (let i = 0; i < 6; i++) {
    const t = t0 + i * 0.035
    g.gain.exponentialRampToValueAtTime(0.06 + Math.random() * 0.05, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.012, t + 0.03)
  }
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26)
  n.connect(f).connect(g).connect(out)
  n.start(t0)
  n.stop(t0 + 0.3)
}

/** Перестук костей в стакане — кураж, переброс. */
export function diceRoll(ctx, out, t0) {
  const n = 5 + Math.floor(Math.random() * 3)
  for (let i = 0; i < n; i++) {
    const t = t0 + i * (0.03 + Math.random() * 0.05)
    hit(ctx, out, t, { freq: 1600 + Math.random() * 1800, q: 2.2, peak: 0.16, decay: 0.05 })
    tone(ctx, out, t, { type: 'square', from: 320 + Math.random() * 200, to: 140, peak: 0.05, decay: 0.04 })
  }
}

/** Сухой треск — грязный болт, промах. */
export function boltCrack(ctx, out, t0) {
  tone(ctx, out, t0, { type: 'triangle', from: 300, to: 78, peak: 0.28, decay: 0.22 })
  hit(ctx, out, t0, { freq: 600, q: 1.2, peak: 0.18, decay: 0.1 })
  hit(ctx, out, t0 + 0.03, { freq: 240, q: 1.5, peak: 0.12, decay: 0.14 })
}

/** Глухой удар в бочку — игрок сел на бочку. */
export function barrelDrum(ctx, out, t0) {
  tone(ctx, out, t0, { type: 'sine', from: 96, to: 52, peak: 0.5, decay: 0.34 })
  hit(ctx, out, t0, { freq: 420, q: 1.8, peak: 0.22, decay: 0.09 })
  hit(ctx, out, t0 + 0.12, { freq: 300, q: 2.4, peak: 0.1, decay: 0.12 })
}

/** Грохот разбитой телеги / падения с бочки. */
export function crash(ctx, out, t0) {
  const n = noise(ctx, 0.9)
  const f = band(ctx, 'lowpass', 4200, 0.9)
  f.frequency.setValueAtTime(4200, t0)
  f.frequency.exponentialRampToValueAtTime(260, t0 + 0.75)
  const g = env(ctx, t0, 0.38, 0.8, 0.01)
  n.connect(f).connect(g).connect(out)
  n.start(t0)
  n.stop(t0 + 0.95)
  tone(ctx, out, t0, { type: 'sine', from: 130, to: 44, peak: 0.4, decay: 0.5 })
  // доски разлетаются
  for (let i = 0; i < 5; i++) {
    hit(ctx, out, t0 + 0.08 + Math.random() * 0.4, {
      freq: 700 + Math.random() * 900, q: 3, peak: 0.12, decay: 0.07,
    })
  }
}

/** Рог победы. */
export function victoryHorn(ctx, out, t0) {
  const notes = [
    [196, 0.0, 0.34],
    [261.6, 0.3, 0.34],
    [392, 0.6, 0.8],
  ]
  notes.forEach(([f, at, dur]) => {
    const o = ctx.createOscillator()
    const o2 = ctx.createOscillator()
    o.type = 'sawtooth'
    o2.type = 'sawtooth'
    o.frequency.setValueAtTime(f, t0 + at)
    o2.frequency.setValueAtTime(f * 1.005, t0 + at)
    const lp = band(ctx, 'lowpass', 1500, 0.8)
    const g = env(ctx, t0 + at, 0.22, dur, 0.05)
    o.connect(lp)
    o2.connect(lp)
    lp.connect(g).connect(out)
    o.start(t0 + at); o.stop(t0 + at + dur + 0.1)
    o2.start(t0 + at); o2.stop(t0 + at + dur + 0.1)
  })
  // кружки в конце
  mugThud(ctx, out, t0 + 0.95)
}

/** Короткий щелчок интерфейса. */
export function click(ctx, out, t0) {
  hit(ctx, out, t0, { freq: 2600, q: 3, peak: 0.1, decay: 0.03 })
  tone(ctx, out, t0, { type: 'square', from: 640, to: 400, peak: 0.05, decay: 0.03 })
}

/** Стирание строки — откат. */
export function scrape(ctx, out, t0) {
  const n = noise(ctx, 0.35)
  const f = band(ctx, 'bandpass', 1200, 0.8)
  f.frequency.setValueAtTime(1800, t0)
  f.frequency.exponentialRampToValueAtTime(500, t0 + 0.3)
  const g = env(ctx, t0, 0.12, 0.3, 0.02)
  n.connect(f).connect(g).connect(out)
  n.start(t0)
  n.stop(t0 + 0.36)
}

export const SYNTHS = {
  sword: swordClang,
  mug: mugThud,
  quill,
  dice: diceRoll,
  bolt: boltCrack,
  barrel: barrelDrum,
  crash,
  horn: victoryHorn,
  click,
  scrape,
}
