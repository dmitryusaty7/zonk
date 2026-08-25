/**
 * races.js — СХОД НА БЕРЕГ
 * Кто сидит за столом в Пиратской Бухте. Раса даёт знак на свитке
 * и цвет метки; имя игрок вписывает сам.
 */
export const RACES = [
  { id: 'orc', label: 'Орк-рубака', short: 'ОРК', sprite: 'orc', tint: '#78af46' },
  { id: 'murloc', label: 'Мурлок-рыбак', short: 'МУРЛОК', sprite: 'murloc', tint: '#5ac8cd' },
  { id: 'goblin', label: 'Хитрый Гоблин', short: 'ГОБЛИН', sprite: 'goblin', tint: '#d6b042' },
  { id: 'troll', label: 'Тролль-корсар', short: 'ТРОЛЛЬ', sprite: 'troll', tint: '#a078d2' },
]

export const raceById = (id) => RACES.find((r) => r.id === id) || RACES[0]

/** Имена по умолчанию — на случай, если вписывать лень. */
export const DEFAULT_NAMES = {
  orc: ['Гразгар', 'Дуротан', 'Клык', 'Рубака'],
  murloc: ['Мргрлгл', 'Плавник', 'Икра', 'Тина'],
  goblin: ['Жмых', 'Барыга', 'Кривой', 'Шустрик'],
  troll: ['Зулраг', 'Костоглод', 'Одноглазый', 'Хвост'],
}

/** Свободное имя для новой расы, не совпадающее с занятыми. */
export function suggestName(raceId, taken = []) {
  const pool = DEFAULT_NAMES[raceId] || ['Салага']
  return pool.find((n) => !taken.includes(n)) || `${pool[0]} ${taken.length + 1}`
}
