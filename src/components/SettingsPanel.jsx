/**
 * SettingsPanel.jsx — ПРАВИЛА БУХТЫ
 * Все правила партии настраиваются здесь. Панель одна и та же
 * до начала игры и во время неё (из меню).
 */
import { useGameStore } from '../store/gameStore.js'
import { RULE_HINTS } from '../data/lore.js'
import { Rubric, Stepper, Latch, tap } from './ui.jsx'

export default function SettingsPanel({ locked = false }) {
  const s = useGameStore((st) => st.settings)
  const setSetting = useGameStore((st) => st.setSetting)
  const addBarrel = useGameStore((st) => st.addBarrel)
  const removeBarrel = useGameStore((st) => st.removeBarrel)
  const updateBarrel = useGameStore((st) => st.updateBarrel)
  const resetSettings = useGameStore((st) => st.resetSettings)

  return (
    <div className="pb-4">
      {locked && (
        <p className="frame-thin mb-3 bg-blood/35 px-2 py-2 text-[15px] leading-tight text-bone">
          Партия идёт. Правки вступят в силу немедленно — на записанное в свитках они не влияют.
        </p>
      )}

      {/* ── ЦЕЛЬ ── */}
      <Rubric hint={RULE_HINTS.targetScore}>Главный Сундук</Rubric>
      <Stepper label="Собрать золота" value={s.targetScore} onChange={(v) => setSetting('targetScore', v)} step={50} min={100} max={9999} />

      {/* ── ПОДАТЬ ── */}
      <Rubric hint={RULE_HINTS.entryScore}>Общак</Rubric>
      <Stepper label="Башлять от" value={s.entryScore} onChange={(v) => setSetting('entryScore', v)} step={5} min={0} max={500} />
      <Latch label="Не башлянул — ржавый крючок" checked={s.entryFailIsBolt} onChange={(v) => setSetting('entryFailIsBolt', v)} />

      {/* ── БОЧКИ ── */}
      <Rubric hint={RULE_HINTS.barrels}>Бочки с пойлом</Rubric>
      <div className="space-y-2">
        {s.barrels.map((b, i) => (
          <div key={i} className="frame-thin surf-board px-2 py-2">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="goth text-[20px] leading-none text-gold">Бочка №{i + 1}</span>
              <span className="flex-1" />
              <button
                type="button"
                className="btn btn-blood h-9 px-2.5 text-[14px] leading-none"
                onClick={() => {
                  tap()
                  removeBarrel(i)
                }}
                aria-label={`Убрать бочку ${b.value}`}
              >
                Убрать
              </button>
            </div>
            <div className="space-y-1.5">
              <Stepper label="Стоит на" value={b.value} onChange={(v) => updateBarrel(i, { value: v })} step={5} min={5} max={s.targetScore - 5} />
              <Stepper label="Глотков" value={b.attempts} onChange={(v) => updateBarrel(i, { attempts: v })} step={1} min={1} max={9} />
              <Stepper label="Падение стоит" value={b.fallPenalty} onChange={(v) => updateBarrel(i, { fallPenalty: v })} step={10} min={0} max={1000} />
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-orc mt-2 w-full py-3 text-[17px]"
        onClick={() => {
          tap()
          addBarrel()
        }}
      >
        + Выкатить ещё бочку
      </button>
      <div className="mt-2">
        <Latch label="Соперник спихивает с бочки" checked={s.barrelKnockOff} onChange={(v) => setSetting('barrelKnockOff', v)} hint={RULE_HINTS.barrelKnockOff} />
        <Latch label="...в том числе при игре вдвоём" checked={s.barrelKnockOffInDuel} onChange={(v) => setSetting('barrelKnockOffInDuel', v)} hint="По обычаю кабака — нельзя. Включи, если играете иначе." />
      </div>

      {/* ── ТЕЛЕГА ── */}
      <Rubric hint={RULE_HINTS.wagon}>Дырявая лодка</Rubric>
      <Latch label="Правило в силе" checked={s.wagon.enabled} onChange={(v) => setSetting('wagon.enabled', v)} />
      {s.wagon.enabled && (
        <div className="space-y-1.5">
          <Stepper label="Роковое число" value={s.wagon.value} onChange={(v) => setSetting('wagon.value', v)} step={5} min={5} max={s.targetScore - 5} />
          <Stepper label="Откатиться до" value={s.wagon.resetTo} onChange={(v) => setSetting('wagon.resetTo', v)} step={50} min={0} max={s.targetScore - 5} />
        </div>
      )}

      {/* ── ТРАКТЫ ── */}
      <Rubric hint={RULE_HINTS.streets}>Уловы</Rubric>
      <Stepper label="Малый улов" value={s.streets.small} onChange={(v) => setSetting('streets.small', v)} step={5} min={5} max={1000} />
      <Stepper label="Большой улов" value={s.streets.big} onChange={(v) => setSetting('streets.big', v)} step={5} min={5} max={1000} />

      {/* ── УДАР В СПИНУ ── */}
      <Rubric hint={RULE_HINTS.backstab}>Гарпун в спину</Rubric>
      <Latch label="Равенство наказуемо" checked={s.backstab.enabled} onChange={(v) => setSetting('backstab.enabled', v)} />
      {s.backstab.enabled && (
        <Stepper label="Соперник теряет" value={s.backstab.penalty} onChange={(v) => setSetting('backstab.penalty', v)} step={5} min={0} max={500} />
      )}

      {/* ── БОЛТЫ ── */}
      <Rubric hint={RULE_HINTS.bolts}>Ржавые крючки</Rubric>
      <Stepper label="Крючков до рваной сети" value={s.bolts.perPenalty} onChange={(v) => setSetting('bolts.perPenalty', v)} step={1} min={0} max={9} />
      <Stepper label="Рваная сеть стоит" value={s.bolts.penalty} onChange={(v) => setSetting('bolts.penalty', v)} step={10} min={0} max={1000} />
      <Latch
        label="Пускать счёт ниже нуля"
        checked={s.allowNegative}
        onChange={(v) => setSetting('allowNegative', v)}
        hint={RULE_HINTS.allowNegative}
      />

      {/* ── СУД КОРЧМАРЯ ── */}
      <Rubric hint={RULE_HINTS.fouls}>Суд Хозяина Бухты</Rubric>
      {['mud', 'crooked'].map((key) => (
        <div key={key} className="frame-thin surf-board mb-2 flex items-center gap-2 px-2 py-2">
          <div className="min-w-0 flex-1">
            <span className="goth block text-[20px] leading-none text-gold">{s.fouls[key].label}</span>
            <span className="block text-[14px] leading-tight text-parch-dark">
              {key === 'mud' ? 'Кость улетела со стола за борт.' : 'Кость встала на кость.'}
            </span>
          </div>
          <span className="tiny shrink-0 text-[12px] leading-tight text-blood-bright">
            ОДИН
            <br />
            КРЮЧОК
          </span>
        </div>
      ))}

      <button
        type="button"
        className="btn mt-4 w-full py-3 text-[17px]"
        onClick={() => {
          tap()
          resetSettings()
        }}
      >
        Вернуть кодекс по обычаю
      </button>
    </div>
  )
}
