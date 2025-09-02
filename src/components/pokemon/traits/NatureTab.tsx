import { IoCaretDown, IoCaretUp } from 'react-icons/io5'
import { ScrollableContainer, Skeleton } from '@/components/common'
import { PokemonNatureCombobox } from '@/components/pokemon/PokemonNatureCombobox'
import { getStatAbbr, statAbbreviations } from '@/lib/parser/core/utils'
import { usePokemonStore } from '@/stores'

export const NatureTab: React.FC = () => {
  const { partyList, activePokemonId, setNature } = usePokemonStore()
  const pokemon = partyList.find(p => p.id === activePokemonId)
  const natureName = pokemon?.data.nature ?? 'Unknown'
  const natureMods = pokemon?.data.natureModifiers

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
                <div className="inline-flex items-center gap-1 rounded-md border border-emerald-700/60 bg-emerald-900/30 text-emerald-300 px-2 py-1 text-xs">
                  <IoCaretUp className="text-emerald-300" /> Raises {getStatAbbr(natureMods.increased)}
                </div>
              )}
              {natureMods && natureMods.decreased >= 0 && (
                <div className="inline-flex items-center gap-1 rounded-md border border-rose-700/60 bg-rose-900/30 text-rose-300 px-2 py-1 text-xs">
                  <IoCaretDown className="text-rose-300" /> Lowers {getStatAbbr(natureMods.decreased)}
                </div>
              )}
              {(!natureMods || (natureMods.increased === -1 && natureMods.decreased === -1)) && <div className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/40 text-slate-300 px-2 py-1 text-xs">Neutral nature</div>}
            </div>

            <div className="mt-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Affected Stats</div>
              <div className="flex flex-wrap gap-1.5">
                {statAbbreviations.map((abbr, i) => {
                  const isUp = natureMods?.increased === i
                  const isDown = natureMods?.decreased === i
                  const base = 'px-2 py-1 rounded-md border text-xs'
                  const cls = isUp ? 'bg-emerald-900/30 border-emerald-700/60 text-emerald-300' : isDown ? 'bg-rose-900/30 border-rose-700/60 text-rose-300' : 'bg-slate-800/40 border-slate-700 text-slate-300'
                  return (
                    <div key={`nature-stat-${i}`} className={`${base} ${cls}`}>
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
