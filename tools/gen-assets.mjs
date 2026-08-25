/**
 * gen-assets.mjs — МАСТЕРСКАЯ ХУДОЖНИКА
 * ------------------------------------------------------------------
 * Рисует все pixel-art ассеты процедурно и кладёт готовые PNG в public/.
 * Никаких внешних библиотек: PNG собирается вручную из zlib.
 *
 *   textures/parchment.png  — бесшовная морская карта (свитки счёта)
 *   textures/wood.png       — бесшовная мокрая палубная доска
 *   textures/linen.png      — тёмный трюм с искрами планктона (фон)
 *   textures/ribbon.png     — красная тряпка на вывеску
 *   textures/hook.png       — ржавый крючок (пустой бросок)
 *   icons/coin.png          — золотой
 *   icons/icon-192.png      — Главный Сундук
 *   icons/icon-512.png
 *   icons/maskable-512.png  — с полями под маску Android
 *   favicon.png
 *
 * Запуск: node tools/gen-assets.mjs
 */
import { deflateSync } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PALETTE, BUSTS, PROPS, FIRE_FRAMES } from './sprites.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ═══════════════════════ PNG ═══════════════════════

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** Собрать PNG из RGBA-буфера (w*h*4). */
function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0 // фильтр None — пиксель-арт и так жмётся отлично
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ═══════════════════════ ХОЛСТ ═══════════════════════

class Canvas {
  constructor(w, h) {
    this.w = w
    this.h = h
    this.data = Buffer.alloc(w * h * 4)
  }
  set(x, y, [r, g, b, a = 255]) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const i = (y * this.w + x) * 4
    if (a === 255) {
      this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b; this.data[i + 3] = 255
      return
    }
    // альфа-смешение поверх того, что уже есть
    const sa = a / 255
    const da = this.data[i + 3] / 255
    const oa = sa + da * (1 - sa)
    if (oa === 0) return
    this.data[i] = Math.round((r * sa + this.data[i] * da * (1 - sa)) / oa)
    this.data[i + 1] = Math.round((g * sa + this.data[i + 1] * da * (1 - sa)) / oa)
    this.data[i + 2] = Math.round((b * sa + this.data[i + 2] * da * (1 - sa)) / oa)
    this.data[i + 3] = Math.round(oa * 255)
  }
  rect(x, y, w, h, c) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c)
  }
  fill(c) { this.rect(0, 0, this.w, this.h, c) }
  /** Увеличить в n раз ближайшим соседом — сохраняет пиксельность. */
  scale(n) {
    const out = new Canvas(this.w * n, this.h * n)
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 4
        const c = [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]]
        out.rect(x * n, y * n, n, n, c)
      }
    }
    return out
  }
  async save(path) {
    const full = resolve(ROOT, path)
    await mkdir(dirname(full), { recursive: true })
    const png = encodePng(this.w, this.h, this.data)
    await writeFile(full, png)
    console.log(`  ✓ ${path} — ${this.w}×${this.h}, ${(png.length / 1024).toFixed(1)} КБ`)
  }
}

// ═══════════════════════ ШУМ ═══════════════════════

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const smooth = (t) => t * t * (3 - 2 * t)

/** Бесшовный value-noise: решётка cells×cells замыкается по краям. */
function tileNoise(size, cells, seed) {
  const rnd = mulberry32(seed)
  const lat = Array.from({ length: cells * cells }, () => rnd())
  const at = (cx, cy) => lat[((cy % cells) + cells) % cells * cells + (((cx % cells) + cells) % cells)]
  const step = size / cells
  const out = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = x / step, gy = y / step
      const x0 = Math.floor(gx), y0 = Math.floor(gy)
      const fx = smooth(gx - x0), fy = smooth(gy - y0)
      const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1)
      out[y * size + x] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
    }
  }
  return out
}

/** Многооктавный бесшовный шум. */
function fbm(size, octaves, seed) {
  const out = new Float32Array(size * size)
  let amp = 1, total = 0
  octaves.forEach((cells, i) => {
    const n = tileNoise(size, cells, seed + i * 977)
    for (let k = 0; k < out.length; k++) out[k] += n[k] * amp
    total += amp
    amp *= 0.5
  })
  for (let k = 0; k < out.length; k++) out[k] /= total
  return out
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
const clamp01 = (v) => Math.max(0, Math.min(1, v))
/** Ступенчатая квантизация — тот самый «строгий пиксель», без градиентной каши. */
const quant = (v, steps) => Math.round(v * (steps - 1)) / (steps - 1)

// ═══════════════════════ ПЕРГАМЕНТ ═══════════════════════

// Старая морская карта: жёлтая, в разводах от воды и пролитого рома.
// Пятна сдержанные — по ней ведут счёт.
const PARCH = {
  light: [222, 208, 171],
  mid: [201, 184, 145],
  dark: [170, 152, 114],
  stain: [110, 106, 70], // солёная вода
  burn: [82, 66, 38], // копоть фонаря
}

async function parchment(size = 256) {
  const c = new Canvas(size, size)
  const base = fbm(size, [4, 8, 16, 32], 20240824)
  const grain = fbm(size, [32, 64], 1337)
  const stains = fbm(size, [4, 8], 909)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      // основной тон — 5 ступеней, чтобы читалось как пиксель-арт
      let t = quant(clamp01(base[i] * 0.75 + grain[i] * 0.25), 5)
      let col = t < 0.3 ? mix(PARCH.dark, PARCH.mid, t / 0.3)
        : t < 0.7 ? mix(PARCH.mid, PARCH.light, (t - 0.3) / 0.4)
          : PARCH.light

      // пятна от вина и сырости — сдержанно: по пергаменту идут цифры
      const s = stains[i]
      if (s > 0.68) col = mix(col, PARCH.stain, quant(clamp01((s - 0.68) / 0.32), 4) * 0.34)
      if (s < 0.16) col = mix(col, PARCH.burn, quant(clamp01((0.16 - s) / 0.16), 3) * 0.18)

      // волокна пергамента — редкие тёмные точки
      if (grain[i] > 0.86 && (x * 7 + y * 13) % 11 === 0) col = mix(col, PARCH.stain, 0.35)

      c.set(x, y, [...col, 255])
    }
  }
  await c.save('public/textures/parchment.png')
}

// ═══════════════════════ ДУБОВАЯ ДОСКА ═══════════════════════

// Палуба и столы: доски, мокрые от соли. Холодные, с зеленоватым отливом.
const WOOD = {
  dark: [22, 35, 42],
  mid: [36, 51, 58],
  light: [53, 74, 82],
  edge: [13, 22, 27],
}

async function wood(size = 128) {
  const c = new Canvas(size, size)
  // растянутый по горизонтали шум = продольная свиль
  const grain = fbm(size, [8, 16, 64], 4242)
  // Контраст намеренно низкий: по доске идёт мелкий текст, и жёсткая
  // свиль превращала бы строки в зачёркнутые. Дерево должно читаться
  // фактурой, а не рисунком.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const stretched = grain[(y * size + ((x / 6) | 0) * 6) % (size * size)]
      const rings = Math.abs(Math.sin((y * 0.55 + stretched * 9) * 1.1))
      const t = quant(clamp01(rings * 0.6 + stretched * 0.4), 4)
      let col = mix(mix(WOOD.dark, WOOD.mid, 0.55), mix(WOOD.mid, WOOD.light, 0.35), t)
      // стык досок — один на 64 пикселя, мягкий
      if (y % 64 === 0) col = mix(col, WOOD.dark, 0.75)
      if (y % 64 === 1) col = mix(col, WOOD.light, 0.25)
      // редкие заклёпки по стыку
      if ((x % 64 === 6 || x % 64 === 41) && y % 64 === 2) col = [126, 106, 74]
      c.set(x, y, [...col, 255])
    }
  }
  await c.save('public/textures/wood.png')
}

// ═══════════════════════ ДУБОВЫЙ КОЗЛОВОЙ СТОЛ ═══════════════════════

// Тёплый дуб: столешница, за которой играют. Доски широкие, со свилью,
// стыки глубокие, сучки редкие. Контраст умеренный — по столу идёт текст.
const OAK = {
  dark: [74, 48, 24],
  mid: [107, 72, 36],
  light: [140, 100, 54],
  seam: [44, 28, 14],
  knot: [58, 36, 18],
}

async function oak(size = 128) {
  const c = new Canvas(size, size)
  const grain = fbm(size, [8, 16, 64], 8801)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // свиль тянется вдоль доски — шум растянут по горизонтали
      const stretched = grain[(y * size + ((x / 7) | 0) * 7) % (size * size)]
      const rings = Math.abs(Math.sin((y * 0.5 + stretched * 7) * 1.15))
      const t = quant(clamp01(rings * 0.55 + stretched * 0.45), 4)
      let col = t < 0.5 ? mix(OAK.dark, OAK.mid, t / 0.5) : mix(OAK.mid, OAK.light, (t - 0.5) / 0.5)

      // стык досок: глубокая тёмная борозда и светлая фаска под ней
      const inPlank = y % 42
      if (inPlank === 0 || inPlank === 1) col = OAK.seam
      else if (inPlank === 2) col = mix(col, OAK.light, 0.35)

      // сучки
      const kx = x % 64, ky = y % 42
      const kd = Math.hypot(kx - 22, ky - 26)
      if (kd < 3) col = kd < 1.6 ? OAK.knot : mix(col, OAK.knot, 0.55)

      c.set(x, y, [...col, 255])
    }
  }
  await c.save('public/textures/oak.png')
}

// ═══════════════════════ ЗАПЛЕСНЕВЕЛЫЙ КИРПИЧ ═══════════════════════

// Стена подвала: серый камень, известковый шов, пятна плесени и сырости.
const BRICK = {
  stone: [62, 66, 62],
  stoneHi: [82, 86, 80],
  stoneLo: [46, 50, 47],
  mortar: [38, 41, 38],
  moss: [66, 100, 54],
  damp: [44, 58, 60],
}

async function brick(size = 128) {
  const c = new Canvas(size, size)
  const rough = fbm(size, [16, 32, 64], 3311)
  const mold = fbm(size, [4, 8], 7717)
  const BW = 32 // ширина кирпича
  const BH = 16 // высота ряда

  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / BH)
    const shift = row % 2 ? BW / 2 : 0 // перевязка вразбежку
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const bx = (x + shift) % BW
      const by = y % BH
      const isMortar = bx < 2 || by < 2

      let col
      if (isMortar) {
        col = mix(BRICK.mortar, BRICK.stoneLo, quant(rough[i], 3) * 0.4)
      } else {
        const t = quant(clamp01(rough[i]), 4)
        col = t < 0.4 ? mix(BRICK.stoneLo, BRICK.stone, t / 0.4)
          : mix(BRICK.stone, BRICK.stoneHi, (t - 0.4) / 0.6)
        // фаска: верх кирпича светлее, низ темнее
        if (by === 2) col = mix(col, BRICK.stoneHi, 0.4)
        if (by === BH - 1) col = mix(col, BRICK.stoneLo, 0.5)
      }

      /*
       * Плесень и сырость. Шум fbm жмётся к середине диапазона, поэтому
       * порог с мягким набором почти ничего не давал: растягиваем вручную,
       * иначе стена остаётся просто серой.
       */
      const m = mold[i]
      const moss = quant(clamp01((m - 0.5) * 3.2), 4)
      if (moss > 0) col = mix(col, BRICK.moss, moss * 0.85)
      const damp = quant(clamp01((0.46 - m) * 3.2), 3)
      if (damp > 0) col = mix(col, BRICK.damp, damp * 0.6)
      // тёмные споры по краю пятна
      if (moss > 0.3 && (x * 5 + y * 9) % 6 === 0) col = mix(col, [34, 58, 32], 0.75)

      c.set(x, y, [...col, 255])
    }
  }
  await c.save('public/textures/brick.png')
}

// ═══════════════════════ МЕШКОВИНА ═══════════════════════

async function linen(size = 64) {
  const c = new Canvas(size, size)
  const n = fbm(size, [16, 32], 77)
  const glow = fbm(size, [8], 5150)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      // доска трюма: грубая, тёмная, сырая
      const weave = (x % 4 < 2 ? 1 : 0) ^ (y % 4 < 2 ? 1 : 0)
      const t = quant(clamp01(n[i] * 0.6 + weave * 0.4), 3)
      let col = mix([7, 13, 16], [22, 33, 39], t)
      // магический планктон — редкие холодные искры
      if (glow[i] > 0.83 && (x * 5 + y * 11) % 23 === 0) {
        col = mix(col, [63, 240, 208], 0.55)
      }
      c.set(x, y, [...col, 255])
    }
  }
  await c.save('public/textures/linen.png')
}

// ═══════════════════════ РЖАВЫЙ КРЮЧОК ═══════════════════════

/**
 * Пустой бросок в свитке рисуется крючком, а не прочерком.
 * Форма набрана вручную: ушко, прямое цевьё, изгиб и жало вверх.
 */
const HOOK_ART = [
  '...##...',
  '..#..#..',
  '..#..#..',
  '...##...',
  '....##..',
  '....##..',
  '....##..',
  '....##..',
  '....##..',
  '#...##..',
  '##..##..',
  '.#..##..',
  '.#..##..',
  '..#..#..',
  '..#..#..',
  '...##...',
]

async function hook() {
  const w = HOOK_ART[0].length
  const h = HOOK_ART.length
  const c = new Canvas(w, h)
  const IRON = [122, 98, 66]
  const IRON_D = [74, 58, 38]
  const RUST = [138, 74, 42]
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (HOOK_ART[y][x] !== '#') continue
      // ржавчина проступает пятнами, блик — по левой кромке
      const rusty = (x * 7 + y * 5) % 9 < 3
      const lit = HOOK_ART[y][x - 1] !== '#'
      c.set(x, y, [...(rusty ? RUST : lit ? IRON : IRON_D), 255])
    }
  }
  await c.scale(2).save('public/textures/hook.png')
}

// ═══════════════════════ КРАСНАЯ ЛЕНТА ═══════════════════════

/** Рваная красная тряпка — орки вешают такие над стойкой и на щиты. */
async function ribbon(w = 64, h = 16) {
  const c = new Canvas(w, h)
  const n = fbm(Math.max(w, h), [8, 16], 313)
  const RED = { dark: [110, 24, 18], mid: [168, 40, 30], light: [201, 56, 43] }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = quant(clamp01(n[(y * Math.max(w, h) + x) % (Math.max(w, h) ** 2)]), 3)
      let col = mix(RED.mid, RED.light, t)
      // тень по краям — ткань провисает
      if (y <= 1 || y >= h - 2) col = mix(col, RED.dark, 0.7)
      // нитяная основа
      if (x % 3 === 0) col = mix(col, RED.dark, 0.22)
      c.set(x, y, [...col, 255])
    }
  }
  await c.save('public/textures/ribbon.png')
}

// ═══════════════════════ ЗЛАТОЙ ═══════════════════════

/** Монета 16×16 — валюта кабака. Рисуется по окружности, без сглаживания. */
async function coin(size = 16) {
  const c = new Canvas(size, size)
  const r = size / 2 - 0.5
  const cx = (size - 1) / 2
  const GOLD = { dark: [122, 92, 16], mid: [201, 162, 39], light: [244, 216, 122], edge: [20, 16, 8] }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cx)
      if (d > r) continue
      let col
      if (d > r - 1) col = GOLD.edge
      else if (d > r - 2) col = GOLD.dark
      else {
        // блик слева сверху, тень справа снизу
        const l = (x - cx) * 0.5 + (y - cx) * 0.5
        col = l < -2 ? GOLD.light : l > 2 ? GOLD.dark : GOLD.mid
      }
      c.set(x, y, [...col, 255])
    }
  }
  // насечка посредине — чтобы монета читалась монетой
  for (let y = 5; y <= 10; y++) c.set(7, y, GOLD.dark)
  for (let y = 5; y <= 10; y++) c.set(8, y, GOLD.light)
  await c.save('public/icons/coin.png')
}

// ═══════════════════════ ГЕРБ ПРИЛОЖЕНИЯ ═══════════════════════

const PAL = {
  k: [9, 15, 18],
  wood: [36, 51, 58],
  woodD: [22, 35, 42],
  gold: [232, 185, 60],
  goldL: [255, 233, 160],
  goldD: [138, 106, 20],
  blood: [192, 57, 43],
  bloodD: [110, 24, 18],
  bone: [222, 208, 171],
  boneD: [176, 164, 132],
  chest: [92, 61, 30],
  chestD: [58, 39, 18],
  iron: [106, 122, 130],
  ironD: [58, 70, 76],
  neon: [63, 240, 208],
  lamp: [224, 145, 58],
}

/** Полуширина сундука на строке y: 8..15 — крышка-купол, 16..27 — короб. */
function chestHalf(y) {
  if (y < 8 || y > 27) return -1
  if (y >= 16) return 11
  const t = (15 - y) / 7
  return Math.round(11 * Math.sqrt(Math.max(0, 1 - t * t * 0.86)))
}

/** Главный Сундук: окован железом, замок золотой, из щели сыплется золото. */
function drawChest(c, ox = 0, oy = 0) {
  const cx = 16
  for (let y = 8; y <= 27; y++) {
    const half = chestHalf(y)
    if (half < 0) continue
    for (let dx = -half; dx <= half; dx++) {
      const x = cx + dx
      const edge = dx === -half || dx === half || y === 8 || y === 27
      // железные полосы по бокам и посередине
      const band = Math.abs(dx) === 7 || Math.abs(dx) === 8
      const lid = y <= 15
      let col
      if (edge) col = PAL.k
      else if (band) col = lid ? PAL.iron : PAL.ironD
      else col = lid ? PAL.chest : PAL.chestD
      c.set(x + ox, y + oy, col)
    }
  }
  // щель между крышкой и коробом
  for (let dx = -11; dx <= 11; dx++) c.set(cx + dx + ox, 16 + oy, PAL.k)

  // замок
  for (let y = 15; y <= 20; y++) {
    for (let x = -2; x <= 2; x++) {
      const border = y === 15 || y === 20 || Math.abs(x) === 2
      c.set(cx + x + ox, y + oy, border ? PAL.goldD : PAL.gold)
    }
  }
  c.set(cx - 1 + ox, 17 + oy, PAL.goldL)
  c.set(cx + ox, 18 + oy, PAL.k)

  // золото сыплется поверх крышки
  const spill = [[-6, 6], [-4, 5], [-2, 6], [4, 5], [6, 6], [2, 5]]
  spill.forEach(([dx, y], i) => {
    c.set(cx + dx + ox, y + oy, i % 2 ? PAL.gold : PAL.goldL)
    c.set(cx + dx + ox, y + 1 + oy, PAL.goldD)
  })

  // холодные искры планктона по углам
  ;[[2, 3], [29, 4], [3, 29], [28, 28]].forEach(([x, y]) => c.set(x + ox, y + oy, PAL.neon))
}

/** Фон герба: мокрая палубная доска с тёмной каймой. */
function drawPlank(c, size) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ring = Math.abs(Math.sin(y * 0.7 + Math.sin(x * 0.12) * 1.4))
      c.set(x, y, ring > 0.72 ? PAL.woodD : PAL.wood)
    }
  }
  for (let i = 0; i < size; i++) {
    c.set(i, 0, PAL.k); c.set(i, size - 1, PAL.k)
    c.set(0, i, PAL.k); c.set(size - 1, i, PAL.k)
  }
}

async function icons() {
  // База 32×32 — делится и в 192 (×6), и в 512 (×16) без искажений
  const base = new Canvas(32, 32)
  drawPlank(base, 32)
  drawChest(base)
  await base.scale(6).save('public/icons/icon-192.png')
  await base.scale(16).save('public/icons/icon-512.png')

  // Маскируемая: сундук меньше, вокруг поля под обрезку
  const mask = new Canvas(32, 32)
  drawPlank(mask, 32)
  const inner = new Canvas(32, 32)
  drawChest(inner)
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      const sx = Math.round((x * 31) / 19), sy = Math.round((y * 31) / 19)
      const i = (sy * 32 + sx) * 4
      const a = inner.data[i + 3]
      if (a > 0) mask.set(x + 6, y + 6, [inner.data[i], inner.data[i + 1], inner.data[i + 2], a])
    }
  }
  await mask.scale(16).save('public/icons/maskable-512.png')

  // Фавиконка 32×32 — сундук без доски, на прозрачном
  const fav = new Canvas(32, 32)
  drawChest(fav)
  await fav.save('public/favicon.png')
}

// ═══════════════════════ СПРАЙТЫ ТАВЕРНЫ ═══════════════════════

/**
 * Рисунки живут в отдельном альбоме — tools/sprites.mjs. Здесь только
 * укладка их в PNG: портреты лентой по два кадра, реквизит поштучно,
 * очаг лентой по три.
 */

/** Нарисовать спрайт по строковой карте. Кривая строка роняет сборку. */
function drawSprite(c, rows, ox = 0, oy = 0, name = '?') {
  const w = rows[0].length
  rows.forEach((row, y) => {
    if (row.length !== w) {
      throw new Error(`Спрайт «${name}»: строка ${y} длиной ${row.length}, ждали ${w}`)
    }
  })
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = PALETTE[row[x]]
      if (col) c.set(x + ox, y + oy, [...col, 255])
    }
  })
}

async function sprites() {
  // Портреты: два кадра в ленту, покачивание крутит фон
  for (const [name, frames] of Object.entries(BUSTS)) {
    const size = frames[0].length
    const c = new Canvas(size * frames.length, size)
    frames.forEach((rows, i) => drawSprite(c, rows, i * size, 0, `${name}#${i}`))
    await c.save(`public/sprites/${name}.png`)
  }
  // Реквизит
  for (const [name, rows] of Object.entries(PROPS)) {
    const c = new Canvas(rows[0].length, rows.length)
    drawSprite(c, rows, 0, 0, name)
    await c.save(`public/sprites/${name}.png`)
  }
  // Очаг
  const fire = new Canvas(48, 16)
  FIRE_FRAMES.forEach((rows, i) => drawSprite(fire, rows, i * 16, 0, `fire#${i}`))
  await fire.save('public/sprites/fire.png')

  await spriteStyles()
}

/**
 * Стили спрайтов пишутся отсюда же.
 * Руками этот список вести нельзя: однажды я добавил фонарь с попугаем,
 * а классы забыл — и половина таверны просто не отрисовалась.
 */
async function spriteStyles() {
  const names = [...Object.keys(BUSTS), ...Object.keys(PROPS)].sort()
  const css = `/* СПРАЙТЫ ТАВЕРНЫ — сгенерировано tools/gen-assets.mjs.
 * Руками не править: перезапусти  node tools/gen-assets.mjs
 */

@layer components {
${names.map((n) => `  .sprite-${n} { background-image: url('/sprites/${n}.png'); }`).join('\n')}
}
`
  const out = resolve(ROOT, 'src/styles/sprites.css')
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, css, 'utf8')
  console.log(`  ✓ src/styles/sprites.css — ${names.length} классов`)
}

// ═══════════════════════ ЗАПУСК ═══════════════════════

console.log('Мастерская художника открыта.')
await parchment()
await wood()
await oak()
await brick()
await linen()
await ribbon()
await coin()
await hook()
await sprites()
await icons()
console.log('Ассеты готовы.')
