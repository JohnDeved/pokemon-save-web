import { ScrollableContainer, Skeleton } from '@/components/common'
import { usePokemonStore } from '@/stores'

export const AbilityTab: React.FC = () => {
  const { partyList, activePokemonId } = usePokemonStore()
  const pokemon = partyList.find(p => p.id === activePokemonId)
  const ability = !pokemon?.details ? null : pokemon.details.abilities.find(a => a.slot === pokemon.data.abilityNumber + 1)

  return (
    <div className="flex-1 flex flex-col">
      <div className="geist-font px-4 py-3 flex-shrink-0">
        <div className="text-white">
          <Skeleton.Text className="font-pixel text-base sm:text-lg">{ability?.name ?? 'Ability Name'}</Skeleton.Text>
        </div>
      </div>
      <div className="relative flex-1">
        <ScrollableContainer className="absolute inset-0 px-4 pb-4 text-xs text-slate-400 leading-relaxed overflow-y-auto custom-scrollbar">
          <Skeleton.Text>{ability?.description ?? 'This is a placeholder ability description that shows how the text will be laid out when the actual content loads. It mimics the typical length and structure of Pokemon ability descriptions.'}</Skeleton.Text>
        </ScrollableContainer>
      </div>
    </div>
  )
}
