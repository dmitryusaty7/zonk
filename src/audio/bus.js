/**
 * bus.js — ГОНЕЦ
 * Крошечная шина событий между стором и всем, что должно на них отзываться
 * (звук, всплывающие реплики, тряска экрана). Стор не знает про React,
 * React не знает про WebAudio — знает только гонец.
 */
const listeners = new Set()

export function on(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function emit(event) {
  listeners.forEach((fn) => {
    try {
      fn(event)
    } catch (err) {
      console.warn('[bus] слушатель споткнулся', err)
    }
  })
}
