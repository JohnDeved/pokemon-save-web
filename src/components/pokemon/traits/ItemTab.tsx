import { ScrollableContainer, Skeleton } from '@/components/common'
import { getItemSpriteUrl } from '@/lib/parser/core/utils'
import { usePokemonStore } from '@/stores'
import { PokemonItemCombobox } from '@/components/pokemon/PokemonItemCombobox'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { useSaveFileStore } from '@/stores'

export const ItemTab: React.FC = () => {
  const { partyList, activePokemonId, setItemId } = usePokemonStore()
  const saveSessionId = useSaveFileStore(s => s.saveSessionId)
  const pokemon = partyList.find(p => p.id === activePokemonId)
  const itemIdName = pokemon?.data.itemIdName
  const item = pokemon?.details?.item
  const itemName = item?.name ?? (itemIdName ? itemIdName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'None')
  const queryClient = useQueryClient()
  const isRefetching = useIsFetching({ queryKey: ['pokemon', 'details', saveSessionId, pokemon?.data.speciesId ?? 'none', String(pokemon?.id ?? -1)] }) > 0
  const FALLBACK_BIG = '/pokemon_item_placeholder_32x32.png'

  return (
    <div className="flex-1 flex flex-col">
      <div className="relative flex-1">
        <ScrollableContainer className="absolute inset-0 px-4 pt-3 pb-4 overflow-y-auto custom-scrollbar">
          <div className="flex items-start gap-4">
            <img
              key={itemIdName ?? 'none'}
              src={itemIdName ? getItemSpriteUrl(itemIdName) : FALLBACK_BIG}
              alt={itemName}
              className="w-24 h-24 sm:w-28 sm:h-28 image-pixelate rounded-md border border-slate-800 bg-slate-900/70 p-2 shadow-lg"
              onError={e => {
                const img = e.currentTarget as HTMLImageElement
                img.onerror = null
                img.src = FALLBACK_BIG
              }}
            />
            <div className="flex-1">
              <div className="text-white">
                {pokemon ? (
                  <PokemonItemCombobox
                    valueIdName={itemIdName}
                    onChange={sel => {
                      if (!sel) setItemId(pokemon.id, 0)
                      else setItemId(pokemon.id, sel.id)
                      // Refresh details to update description
                      void queryClient.invalidateQueries({ queryKey: ['pokemon', 'details', saveSessionId, pokemon.data.speciesId, String(pokemon.id)] })
                      void queryClient.refetchQueries({ queryKey: ['pokemon', 'details', saveSessionId, pokemon.data.speciesId, String(pokemon.id)] })
                    }}
                    asText
                    triggerClassName="font-pixel text-base sm:text-lg text-white"
                  />
                ) : (
                  <Skeleton.Text className="font-pixel text-base sm:text-lg">{itemName}</Skeleton.Text>
                )}
              </div>
              <div className="geist-font text-xs text-slate-400 leading-relaxed mt-2">
                <Skeleton.Text loading={isRefetching}>
                  {item?.description ?? (itemIdName ? 'No description available.' : 'No held item.')}
                </Skeleton.Text>
              </div>
            </div>
          </div>
        </ScrollableContainer>
      </div>
    </div>
  )
}
