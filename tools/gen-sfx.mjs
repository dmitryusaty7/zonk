/**
 * gen-sfx.mjs — ЗВУКОВАЯ КУЗНИЦА SFXR
 * ------------------------------------------------------------------
 * jsfxr рождает звуки случайно вокруг архетипа («монетка», «взрыв»),
 * поэтому дважды подряд получаются разные. Нам нужен постоянный звук,
 * который не меняется от сборки к сборке.
 *
 * Решение: на время генерации подменяем Math.random своим ГПСЧ с
 * фиксированным зерном, ловим получившиеся параметры и сохраняем их
 * в base58 — в том же виде, в каком звуки принято передавать в sfxr.
 * Строки уезжают в src/audio/sfx.js и с тех пор звучат одинаково.
 *
 * Запуск: node tools/gen-sfx.mjs
 */
import { writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sfxr } from 'jsfxr'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'src/audio/sfx.js')

/** Тот же ГПСЧ, что и в мастерской художника: одно зерно — один результат. */
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Какие слоты отдаём sfxr. Остальные (скрип пера, бочка, шорох отката)
 * остаются на процедурном синтезе: там нужна фактура, а не аркадный чип.
 *
 *   preset — архетип sfxr
 *   seed   — зерно, подобранное так, чтобы звук лёг в тему
 *   tweak  — правки поверх: длительность, высота, громкость
 */
const SLOTS = [
  { slot: 'coin', preset: 'pickupCoin', seed: 7, tweak: { p_base_freq: 0.52, p_env_decay: 0.28, sound_vol: 0.32 } },
  { slot: 'sword', preset: 'hitHurt', seed: 3, tweak: { p_base_freq: 0.42, p_env_decay: 0.24, sound_vol: 0.34 } },
  { slot: 'bolt', preset: 'hitHurt', seed: 11, tweak: { p_base_freq: 0.18, p_env_decay: 0.3, sound_vol: 0.3 } },
  { slot: 'crash', preset: 'explosion', seed: 5, tweak: { p_env_decay: 0.55, sound_vol: 0.34 } },
  { slot: 'horn', preset: 'powerUp', seed: 2, tweak: { p_env_sustain: 0.28, p_env_decay: 0.55, sound_vol: 0.36 } },
  { slot: 'click', preset: 'blipSelect', seed: 13, tweak: { p_base_freq: 0.42, p_env_decay: 0.08, sound_vol: 0.22 } },
  { slot: 'dice', preset: 'blipSelect', seed: 21, tweak: { p_base_freq: 0.3, p_env_decay: 0.12, sound_vol: 0.26 } },
]

const real = Math.random

function build({ preset, seed, tweak }) {
  Math.random = mulberry32(seed)
  const params = sfxr.generate(preset)
  Math.random = real
  Object.assign(params, tweak)
  return params
}

const rows = SLOTS.map((def) => {
  const params = build(def)
  const b58 = sfxr.b58encode(params)
  // сразу и проверяем: пустой или бесконечный звук нам не нужен
  const buf = sfxr.toBuffer(params)
  const seconds = buf.length / 44100
  const peak = buf.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
  if (seconds < 0.02 || seconds > 3) throw new Error(`${def.slot}: длительность ${seconds.toFixed(2)}с`)
  if (peak < 0.01) throw new Error(`${def.slot}: звук почти беззвучный`)
  console.log(`  ✓ ${def.slot.padEnd(6)} ${def.preset.padEnd(11)} ${seconds.toFixed(2)}с  пик ${peak.toFixed(2)}`)
  return { slot: def.slot, preset: def.preset, b58 }
})

const file = `/**
 * sfx.js — ЧИП-ЗВУКИ (sfxr)
 * ------------------------------------------------------------------
 * Сгенерировано tools/gen-sfx.mjs. Руками не править — перезапусти:
 *     node tools/gen-sfx.mjs
 *
 * Каждая строка — звук в формате sfxr, упакованный в base58. Разворачивается
 * в браузере в буфер и играет через общий микшер, поэтому подчиняется
 * громкости и «тишине». Файлов не требует вовсе.
 *
 * Слоты, которых здесь нет (скрип пера, удар в бочку, шорох отката),
 * остаются на процедурном синтезе из synth.js: там нужна фактура,
 * а не аркадный чип.
 */

/** слот → звук sfxr в base58 */
export const SFX = {
${rows.map((r) => `  // ${r.preset}\n  ${r.slot}: '${r.b58}',`).join('\n')}
}
`

await writeFile(OUT, file, 'utf8')
console.log(`\n${rows.length} звуков → src/audio/sfx.js`)
