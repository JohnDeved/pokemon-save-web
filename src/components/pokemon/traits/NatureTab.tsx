import { IoCaretDown, IoCaretUp } from 'react-icons/io5'
import { ScrollableContainer, Skeleton } from '@/components/common'
import { PokemonNatureCombobox } from '@/components/pokemon/PokemonNatureCombobox'
import { getStatAbbr, statAbbreviations, natureEffects } from '@/lib/parser/core/utils'
import { usePokemonStore } from '@/stores'
import { useState } from 'react'

export const NatureTab: React.FC = () => {
  const { partyList, activePokemonId, setNature } = usePokemonStore()
  const pokemon = partyList.find(p => p.id === activePokemonId)
  const natureName = pokemon?.data.nature ?? 'Unknown'
  const natureMods = pokemon?.data.natureModifiers
  const [chooseMode, setChooseMode] = useState<null | 'raise' | 'lower'>(null)


  function findNatureForEffects(increased: number, decreased: number): string {
    if (increased === decreased || increased <= 0 || decreased <= 0) return 'Serious'
    for (const [name, eff] of Object.entries(natureEffects)) {
      if (eff.increased === increased && eff.decreased === decreased) return name
    }
    return 'Serious'
  }

  function handleSelectCounterpart(index: number) {
    if (!pokemon || !natureMods) return
    if (index === 0) return // HP unaffected by nature
    if (chooseMode === 'raise') {
      const newNature = findNatureForEffects(index, natureMods.decreased >= 0 ? natureMods.decreased : 1)
      setNature(pokemon.id, newNature)
    } else if (chooseMode === 'lower') {
      const newNature = findNatureForEffects(natureMods.increased >= 0 ? natureMods.increased : 1, index)
      setNature(pokemon.id, newNature)
    }
    setChooseMode(null)
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="relative flex-1">
        <ScrollableContainer className="absolute inset-0 px-4 pt-3 pb-4 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col gap-3">
            <div className="text-white">
              {pokemon ? <PokemonNatureCombobox value={pokemon.data.nature} onChange={nature => setNature(pokemon.id, nature)} asText triggerClassName="font-pixel text-lg sm:text-xl text-white" /> : <Skeleton.Text className="font-pixel text-lg sm:text-xl">{natureName}</Skeleton.Text>}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {natureMods && natureMods.increased >= 0 && (
                <button
                  type="button"
                  onClick={() => setChooseMode(prev => (prev === 'raise' ? null : 'raise'))}
                  title="Click to change raised stat"
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-700/60 bg-emerald-900/30 text-emerald-300 px-2 py-1 text-xs hover:ring-1 hover:ring-emerald-300/40 transition-all duration-150 ease-out cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
                >
                  <IoCaretUp className="text-emerald-300" /> Raises {getStatAbbr(natureMods.increased)}
                </button>
              )}
              {natureMods && natureMods.decreased >= 0 && (
                <button
                  type="button"
                  onClick={() => setChooseMode(prev => (prev === 'lower' ? null : 'lower'))}
                  title="Click to change lowered stat"
                  className="inline-flex items-center gap-1 rounded-md border border-rose-700/60 bg-rose-900/30 text-rose-300 px-2 py-1 text-xs hover:ring-1 hover:ring-rose-300/40 transition-all duration-150 ease-out cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
                >
                  <IoCaretDown className="text-rose-300" /> Lowers {getStatAbbr(natureMods.decreased)}
                </button>
              )}
              {(!natureMods || (natureMods.increased === -1 && natureMods.decreased === -1)) && <div className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/40 text-slate-300 px-2 py-1 text-xs">Neutral nature</div>}
            </div>

            <div className="mt-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
                {chooseMode === 'raise' ? 'Select stat to Raise' : chooseMode === 'lower' ? 'Select stat to Lower' : 'Affected Stats'}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {statAbbreviations.map((abbr, i) => {
                  const isUp = natureMods?.increased === i
                  const isDown = natureMods?.decreased === i
                  const base = 'px-2 py-1 rounded-md border text-xs'
                  const color = isUp
                    ? 'bg-emerald-900/30 border-emerald-700/60 text-emerald-300'
                    : isDown
                    ? 'bg-rose-900/30 border-rose-700/60 text-rose-300'
                    : 'bg-slate-800/40 border-slate-700 text-slate-300'

                  let interactive = false
                  if (chooseMode === 'raise') interactive = i !== 0 && i !== (natureMods?.decreased ?? -1)
                  if (chooseMode === 'lower') interactive = i !== 0 && i !== (natureMods?.increased ?? -1)

                  const ringColor = chooseMode === 'raise' ? 'hover:ring-emerald-300/40' : chooseMode === 'lower' ? 'hover:ring-rose-300/40' : 'hover:ring-slate-400/30'

                  const interactiveCls = chooseMode
                    ? interactive
                      ? `cursor-pointer hover:ring-1 ${ringColor} transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md`
                      : 'opacity-40 cursor-not-allowed'
                    : 'transition-all duration-150 ease-out'

                  return (
                    <div
                      key={`nature-stat-${i}`}
                      className={`${base} ${color} ${interactiveCls}`}
                      onClick={() => chooseMode && interactive && handleSelectCounterpart(i)}
                      role={chooseMode ? 'button' : undefined}
                      aria-disabled={chooseMode && !interactive ? true : undefined}
                    >
                      {abbr}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </ScrollableContainer>
      </div>
    </div>
  )
}
