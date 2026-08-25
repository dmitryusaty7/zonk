/**
 * Scene.jsx — ОБСТАНОВКА ТАВЕРНЫ
 * ------------------------------------------------------------------
 * То, что висит поверх любого экрана и живёт своей жизнью:
 * фонарь на цепи под потолком и предметы, которые пролетают через
 * зал, когда за столом что-то случается.
 *
 * Ничего не перехватывает нажатия — это декорация, а не интерфейс.
 */
import { useEffect, useState } from 'react'
import { on } from '../audio/bus.js'
import { Sprite } from './ui.jsx'

/** Фонарь качается на цепи от сквозняка. */
export function HangingLantern() {
  return (
    <div className="chain" aria-hidden="true">
      <i />
      <Sprite name="lantern" size={30} />
    </div>
  )
}

/**
 * Что летит через зал на каждое событие.
 * Событий без предмета в списке нет намеренно: пусть летит не всё подряд,
 * иначе зал превращается в свалку.
 */
const FLYING = {
  wagon: 'barrel', // дырявая лодка: бочка катится через зал
  foul: 'die', // кость улетела за борт
  boltPenalty: 'fish', // рваная сеть — улов уходит
  backstab: 'bottle', // гарпун в спину: кто-то метнул бутылку
  knockOff: 'mug', // спихнули с бочки
  barrelFall: 'mug',
  win: 'skull', // сундук взят — череп на счастье
}

/** Предмет пролетает через зал и уходит за край. */
export function FlyBy() {
  const [items, setItems] = useState([])

  useEffect(
    () =>
      on((e) => {
        const sprite = FLYING[e.type]
        if (!sprite) return
        const id = `${e.type}-${Date.now()}-${Math.random()}`
        setItems((cur) => [...cur, { id, sprite, top: 24 + Math.random() * 34 }])
        // убираем, когда пролетел: анимация длится 1.1с
        setTimeout(() => setItems((cur) => cur.filter((i) => i.id !== id)), 1300)
      }),
    [],
  )

  if (!items.length) return null
  return (
    <>
      {items.map((i) => (
        <Sprite
          key={i.id}
          name={i.sprite}
          size={30}
          className={`fly-by`}
          style={{ top: `${i.top}%` }}
        />
      ))}
    </>
  )
}
