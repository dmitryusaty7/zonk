/**
 * RulesScreen.jsx — СВОД ПРАВИЛ
 * ------------------------------------------------------------------
 * Справочник, а не настройки: что сколько стоит и какие комбинации
 * заставляют перебрасывать. Каждая комбинация показана костями —
 * так за столом быстрее свериться, чем читать текст.
 *
 * Числа берутся из Кодекса, где они настраиваемые: общак, крючки,
 * гарпун и уловы здесь ровно те, по которым идёт партия.
 */
import { useGameStore } from '../store/gameStore.js'
import { TERMS } from '../data/lore.js'
import { tap, Dice, Coin, Ribbon } from './ui.jsx'

/** Ряд таблицы комбинаций. */
function Combo({ dice, name, value, note }) {
  return (
    <li className="frame-thin surf-parch flex items-center gap-2 px-2 py-2">
      <span className="flex w-[106px] shrink-0 flex-wrap items-start gap-1">
        <Dice values={dice} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="goth block text-[18px] leading-tight text-ink">{name}</span>
        {note && <span className="tiny block text-[11px] leading-tight text-ink/60">{note}</span>}
      </span>
      <span className="num shrink-0 text-right text-[22px] leading-none text-ink">{value}</span>
    </li>
  )
}

/** Ряд таблицы особых правил. */
function Rule({ name, when, effect }) {
  return (
    <li className="frame-thin surf-board px-2 py-2">
      <span className="goth block text-[19px] leading-tight text-gold">{name}</span>
      <span className="block text-[14px] leading-tight text-parch-dim">{when}</span>
      <span className="mt-0.5 block text-[14px] leading-tight text-orc-bright">{effect}</span>
    </li>
  )
}

function Head({ children }) {
  return (
    <h2 className="goth mb-2 mt-5 text-[23px] leading-none text-orc-bright uppercase first:mt-0">
      {children}
    </h2>
  )
}

export default function RulesScreen() {
  const toMenu = useGameStore((s) => s.toMenu)
  const s = useGameStore((st) => st.settings)

  return (
    <div className="pad-tg-top flex h-dvh flex-col">
      <header className="surf-orc frame-gold mx-2 px-3 py-3 text-center">
        <h1 className="goth text-[32px] leading-none text-gold">ПРАВИЛА</h1>
        <p className="tiny mt-1 text-[12px] leading-none text-parch-dim">ИГРА НА ПЯТИ КОСТЯХ</p>
      </header>

      <main className="surf-board frame mx-2 mt-1 flex-1 overflow-y-auto px-3 py-3">
        <Head>Что сколько стоит</Head>
        <ul className="space-y-1.5">
          <Combo dice={[1]} name="Одна единица" value="10" note="одиночная результативная кость" />
          <Combo dice={[5]} name="Одна пятёрка" value="5" note="одиночная результативная кость" />
          <Combo dice={[1, 1, 1]} name="Три единицы" value="100" />
          <Combo
            dice={[2, 2, 2]}
            name="Три одинаковых (2–6)"
            value="×10"
            note="номинал × 10: 20 / 30 / 40 / 50 / 60"
          />
          <Combo
            dice={[6, 6, 6, 6]}
            name="Четыре одинаковых"
            value="×2"
            note="удвоение тройки: четыре шестёрки = 120"
          />
          <Combo
            dice={[6, 6, 6, 6, 6]}
            name="Пять одинаковых (2–6)"
            value="×2"
            note="удвоение четвёрки: пять шестёрок = 240"
          />
          <Combo
            dice={[1, 1, 1, 1, 1]}
            name="Пять единиц"
            value="1000"
            note="особый максимум"
          />
          <Combo
            dice={[1, 2, 3, 4, 5]}
            name={TERMS.streetSmall}
            value={String(s.streets.small)}
            note="обязательный переброс всех пяти"
          />
          <Combo
            dice={[2, 3, 4, 5, 6]}
            name={TERMS.streetBig}
            value={String(s.streets.big)}
            note="обязательный переброс всех пяти"
          />
        </ul>

        <p className="tiny mt-2 text-[11px] leading-tight text-parch-dark">
          ПОЛНОГО СТРИТА В ИГРЕ НА ПЯТИ КОСТЯХ НЕТ.
        </p>

        <Head>Особые правила</Head>
        <ul className="space-y-1.5">
          <Rule
            name="Дубль на двух костях"
            when="Осталось две кости и выпали любые одинаковые"
            effect="Переброс всех пяти, очки суммируются"
          />
          <Rule
            name="Улов"
            when="Выпал малый или большой улов"
            effect="Переброс всех пяти, очки суммируются"
          />
          <Rule
            name={TERMS.entry}
            when="Первая запись в свиток"
            effect={`Минимум ${s.entryScore} золота за раунд`}
          />
          <Rule
            name={`Серия зонков · ${TERMS.boltPenalty}`}
            when={`${s.bolts.perPenalty} промаха подряд`}
            effect={`Штраф −${s.bolts.penalty} из общего счёта`}
          />
          <Rule
            name={TERMS.backstab}
            when="Твой счёт сравнялся со счётом соперника"
            effect={`Соперник теряет −${s.backstab.penalty}`}
          />
          <Rule
            name={TERMS.barrel}
            when={`Дошёл до ${s.barrels.map((b) => b.value).join(' / ') || '—'} или перевалил`}
            effect="Садишься ровно на бочку, лишнее пропадает. Уйти — только к сундуку"
          />
          <Rule
            name={TERMS.wagon}
            when={s.wagon.enabled ? `Ровно ${s.wagon.value}` : 'Правило отключено'}
            effect={s.wagon.enabled ? `Весь груз на дно: счёт в ${s.wagon.resetTo}` : '—'}
          />
          <Rule
            name="Финал"
            when={`Кто-то собрал ${s.targetScore}`}
            effect="У остальных один последний ход, чтобы догнать. Кто успел — тоже победитель, первый помечается отдельно"
          />
        </ul>

        <Ribbon className="mt-5">
          СОБЕРИ {s.targetScore} — ЗАБЕРИ СУНДУК
        </Ribbon>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[14px] text-parch-dark">
          золото считает писарь <Coin size={14} />
        </p>
      </main>

      <footer className="pad-tg-bottom mx-2 mb-2 mt-1">
        <button
          type="button"
          className="btn btn-gold w-full py-5 text-[26px] leading-none"
          onClick={() => {
            tap()
            toMenu()
          }}
        >
          НА ПРИЧАЛ
        </button>
      </footer>
    </div>
  )
}
