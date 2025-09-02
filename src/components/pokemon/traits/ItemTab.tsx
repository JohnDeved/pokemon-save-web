import { ScrollableContainer, Skeleton } from '@/components/common'
import { getItemSpriteUrl } from '@/lib/parser/core/utils'
import { usePokemonStore } from '@/stores'

export const ItemTab: React.FC = () => {
  const { partyList, activePokemonId } = usePokemonStore()
  const pokemon = partyList.find(p => p.id === activePokemonId)
  const itemIdName = pokemon?.data.itemIdName
  const item = pokemon?.details?.item
  const itemName = item?.name ?? (itemIdName ? itemIdName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'None')

  return (
    <div className="flex-1 flex flex-col">
      <div className="relative flex-1">
        <ScrollableContainer className="absolute inset-0 px-4 pt-3 pb-4 overflow-y-auto custom-scrollbar">
          <div className="flex items-start gap-4">
            {itemIdName && <img key={itemIdName} src={getItemSpriteUrl(itemIdName)} alt={itemName} className="w-24 h-24 sm:w-28 sm:h-28 image-pixelate rounded-md border border-slate-800 bg-slate-900/70 p-2 shadow-lg" />}
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
    </div>
  )
}
