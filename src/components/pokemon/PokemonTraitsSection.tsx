import { usePokemonStore } from '@/stores'
import { ScrollableContainer, Skeleton } from '@/components/common'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getItemSpriteUrl, getStatAbbr, statAbbreviations } from '@/lib/parser/core/utils'
import { IoCaretDown, IoCaretUp } from 'react-icons/io5'
import { PokemonNatureCombobox } from '@/components/pokemon/PokemonNatureCombobox'

interface PokemonAbilitySectionProps {
  isLoading?: boolean
}

export const PokemonTraitsSection: React.FC<PokemonAbilitySectionProps> = ({ isLoading = false }) => {
  const { partyList, activePokemonId, setNature } = usePokemonStore()
  const pokemon = partyList.find(p => p.id === activePokemonId)
  const ability = !pokemon?.details ? null : pokemon.details.abilities.find(a => a.slot === pokemon.data.abilityNumber + 1)
  const itemIdName = pokemon?.data.itemIdName
  const item = pokemon?.details?.item
  const itemName = item?.name ?? (itemIdName ? itemIdName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'None')
  const natureName = pokemon?.data.nature ?? 'Unknown'
  const natureMods = pokemon?.data.natureModifiers
  // No sentence summary needed; chips below communicate the effect.

  return (
    <Skeleton.LoadingProvider loading={isLoading}>
      <div className="flex flex-col h-full">
        <Tabs defaultValue="ability" className="flex-1 flex flex-col">
          <div className="flex-shrink-0">
            <div className="w-full border-b border-slate-800/60">
              <div className="px-4">
                <TabsList className="px-0">
                  <TabsTrigger value="ability" className="font-pixel text-[10px] sm:text-xs">Ability</TabsTrigger>
                  <TabsTrigger value="item" className="font-pixel text-[10px] sm:text-xs">Held Item</TabsTrigger>
                  <TabsTrigger value="nature" className="font-pixel text-[10px] sm:text-xs">Nature</TabsTrigger>
                </TabsList>
              </div>
            </div>
          </div>

          <TabsContent value="ability" className="flex-1 flex flex-col">
            <div className="geist-font px-4 py-3 flex-shrink-0">
              <div className="text-white">
                <Skeleton.Text className="font-pixel text-base sm:text-lg">{ability?.name ?? 'Ability Name'}</Skeleton.Text>
              </div>
            </div>
            <div className="relative flex-1">
              <ScrollableContainer className="absolute inset-0 px-4 pb-4 text-xs text-slate-400 leading-relaxed overflow-y-auto custom-scrollbar">
                <Skeleton.Text>
                  {ability?.description ??
                    'This is a placeholder ability description that shows how the text will be laid out when the actual content loads. It mimics the typical length and structure of Pokemon ability descriptions.'}
                </Skeleton.Text>
              </ScrollableContainer>
            </div>
          </TabsContent>

          <TabsContent value="item" className="flex-1 flex flex-col">
            <div className="relative flex-1">
              <ScrollableContainer className="absolute inset-0 px-4 pt-3 pb-4 overflow-y-auto custom-scrollbar">
                <div className="flex items-start gap-4">
                  {itemIdName && (
                    <img
                      key={itemIdName}
                      src={getItemSpriteUrl(itemIdName)}
                      alt={itemName}
                      className="w-24 h-24 sm:w-28 sm:h-28 image-pixelate rounded-md border border-slate-800 bg-slate-900/70 p-2 shadow-lg"
                    />
                  )}
                  <div className="flex-1">
                    <div className="text-white">
                      <Skeleton.Text className="font-pixel text-base sm:text-lg">{itemName}</Skeleton.Text>
                    </div>
                    <div className="geist-font text-xs text-slate-400 leading-relaxed mt-2">
                      <Skeleton.Text>{item?.description ?? (itemIdName ? 'No description available.' : 'No held item.')}</Skeleton.Text>
                    </div>
                  </div>
                </div>
              </ScrollableContainer>
            </div>
          </TabsContent>

          <TabsContent value="nature" className="flex-1 flex flex-col">
            <div className="relative flex-1">
              <ScrollableContainer className="absolute inset-0 px-4 pt-3 pb-4 overflow-y-auto custom-scrollbar">
                <div className="flex flex-col gap-3">
                  <div className="text-white">
                    {pokemon ? (
                      <PokemonNatureCombobox
                        value={pokemon.data.nature}
                        onChange={nature => setNature(pokemon.id, nature)}
                        asText
                        triggerClassName="font-pixel text-lg sm:text-xl text-white"
                      />
                    ) : (
                      <Skeleton.Text className="font-pixel text-lg sm:text-xl">{natureName}</Skeleton.Text>
                    )}
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
                    {(!natureMods || (natureMods.increased === -1 && natureMods.decreased === -1)) && (
                      <div className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/40 text-slate-300 px-2 py-1 text-xs">Neutral nature</div>
                    )}
                  </div>

                  <div className="mt-2">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Affected Stats</div>
                    <div className="flex flex-wrap gap-1.5">
                      {statAbbreviations.map((abbr, i) => {
                        const isUp = natureMods?.increased === i
                        const isDown = natureMods?.decreased === i
                        const base = 'px-2 py-1 rounded-md border text-xs'
                        const cls = isUp
                          ? 'bg-emerald-900/30 border-emerald-700/60 text-emerald-300'
                          : isDown
                          ? 'bg-rose-900/30 border-rose-700/60 text-rose-300'
                          : 'bg-slate-800/40 border-slate-700 text-slate-300'
                        return (
                          <div key={`nature-stat-${i}`} className={`${base} ${cls}`}>
                            {abbr}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Summary sentence removed for a cleaner, chip-only display */}
                </div>
              </ScrollableContainer>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Skeleton.LoadingProvider>
  )
}
