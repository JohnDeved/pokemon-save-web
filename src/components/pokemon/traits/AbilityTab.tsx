import { ScrollableContainer, Skeleton } from '@/components/common'
import { usePokemonStore } from '@/stores'

export const AbilityTab: React.FC = () => {
  const { partyList, activePokemonId, setAbilitySlot } = usePokemonStore()
  const pokemon = partyList.find(p => p.id === activePokemonId)
  const ability = !pokemon?.details ? null : pokemon.details.abilities.find(a => a.slot === pokemon.data.abilityNumber + 1)

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-4 pt-3 flex-shrink-0">
        <div className="text-white mb-2">
          <Skeleton.Text className="font-pixel text-base sm:text-lg">{ability?.name ?? 'Ability'}</Skeleton.Text>
        </div>
        {/* Ability choices (if multiple) */}
        {!!pokemon?.details?.abilities?.length && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {pokemon.details.abilities
              .sort((a, b) => a.slot - b.slot)
              .map(opt => {
                const isActive = opt.slot === pokemon.data.abilityNumber + 1
                return (
                  <button
                    key={`ability-${opt.slot}`}
                    type="button"
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors duration-150 cursor-pointer ${isActive ? 'border-cyan-400/60 bg-cyan-900/20 text-cyan-200' : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-200'}`}
                    onClick={() => setAbilitySlot(pokemon.id, opt.slot)}
                  >
                    <span className="font-sans text-xs">{opt.name}</span>
                  </button>
                )
              })}
          </div>
        )}
      </div>
      <div className="relative flex-1">
        <ScrollableContainer className="absolute inset-0 px-4 pb-4 text-xs text-slate-400 leading-relaxed overflow-y-auto custom-scrollbar">
          <Skeleton.Text>{ability?.description ?? 'This is a placeholder ability description that shows how the text will be laid out when the actual content loads. It mimics the typical length and structure of Pokemon ability descriptions.'}</Skeleton.Text>
        </ScrollableContainer>
      </div>
    </div>
  )
}
