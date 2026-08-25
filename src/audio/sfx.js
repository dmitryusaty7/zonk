/**
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
  // pickupCoin
  coin: '34T6Pkq2m7t9QSThFo76gauB4QfSoEK4bm1ZCadGb4DQxxDgRprhUkd446CbD4Ew4bZjknsUt2HLVhh8qsm2SXHRju1268RMdZm8RLDBxDiGbogKSfcmAdbHh',
  // hitHurt
  sword: '7BMHBGCwKV52hoY3HcB5kMWhRdvCctNQbvVbULdQnKdBiwrAJkrQepaAcWNUcfY2T4cZcp3S1iBHSjRmgYbebekYr2Lbq23Ago8vR7DGgC29j7PgbGjpepCBh',
  // hitHurt
  bolt: '34T6Pkt1EFj9SKUTGum7JpUjSEiqaFgpFMPkJkktjPyESXqkLDb2jNYmdRskaxqEsU7CvV91MiSA8ETBG7sETJcrwoxDofaeKyBzjLpADDi5fSTxoFvn2hFQb',
  // explosion
  crash: '7BMHBGPwP89qSTskvHCr39Bte3h3pDSusFPxx69Cij1Zi9dqvsmX6zMCwtQALbUcDpSFWmQiaC9jrwSbuKeEDnDtJHpRRMkpvC9t2Wczy13naheHCASzbaeKH',
  // powerUp
  horn: '34T6PkmVMpU3UHdkVBNWj4Qc2oPu1YSTgjLiHg7YQjAegmJts8GvR1evfjokqJB5wt6uPLb4Zpz8huMmC13tWX74coGkWeG6dp7BZN9sfzX6R61XaGd5rSbhq',
  // blipSelect
  click: '34T6Pky7495DQvAtQbLCT3LuNQszRVc2Jra4XrdxHie8gXRuyWXdjBzZbs9AjmELMsMQXCGc4gG7zN4WQPqLcfgm8GVUTJB2BL1xLtoSXrHSVe3ZftepoY4b9',
  // blipSelect
  dice: '111118jxR6n1tEE8HLS3T7qaXfgZKraHxhBEg5VNjavi4m9LvSR9JatZDQmMAzf6df2YPwbFYWpdBBTDcoD3QnCd69cK7fPzt9zKh7r2kAx7TaG8wxpkTkh5',
}
