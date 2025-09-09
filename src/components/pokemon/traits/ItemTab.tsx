import { ScrollableContainer, Skeleton } from '@/components/common'
import { getItemSpriteUrl } from '@/lib/parser/core/utils'
import { usePokemonStore } from '@/stores'
import { PokemonItemCombobox } from '@/components/pokemon/PokemonItemCombobox'
import { useQueryClient } from '@tanstack/react-query'
import { useActiveItemDetails } from '@/hooks'

export const ItemTab: React.FC = () => {
  const pokemon = usePokemonStore(s => s.partyList.find(p => p.id === s.activePokemonId))
  const setItemId = usePokemonStore(s => s.setItemId)
  const itemIdName = pokemon?.data.itemIdName
  const { itemDetails, isFetching, queryKey } = useActiveItemDetails()
  const itemName = itemDetails?.name ?? (itemIdName ? itemIdName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'None')
  const queryClient = useQueryClient()
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
              className="w-28 h-28 image-pixelate rounded-md border bg-secondary/60 p-2 shadow-lg"
              onError={e => {
                const img = e.currentTarget
                if (img.dataset.fallbackApplied === '1') return
                img.dataset.fallbackApplied = '1'
                img.src = FALLBACK_BIG
              }}
            />
            <div className="flex-1">
              <div className="text-foreground">
                {pokemon ? (
                  <PokemonItemCombobox
                    valueIdName={itemIdName}
                    onChange={sel => {
                      if (!sel) setItemId(pokemon.id, 0)
                      else setItemId(pokemon.id, sel.id)
                      // Refresh item details only for the active pokemon/item
                      void queryClient.invalidateQueries({ queryKey })
                      void queryClient.refetchQueries({ queryKey })
                    }}
                    asText
                    triggerClassName="font-pixel text-lg text-foreground"
                  />
                ) : (
                  <Skeleton.Text className="font-pixel text-lg">{itemName}</Skeleton.Text>
                )}
              </div>
              <div className="geist-font text-xs text-muted-foreground leading-relaxed mt-2">
                <Skeleton.Text loading={isFetching}>{itemDetails?.description ?? (itemIdName ? 'No description available.' : 'No held item.')}</Skeleton.Text>
              </div>
            </div>
          </div>
        </ScrollableContainer>
      </div>
    </div>
  )
}
