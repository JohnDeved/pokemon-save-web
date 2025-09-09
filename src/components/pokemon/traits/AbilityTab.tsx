import { ScrollableContainer, Skeleton } from '@/components/common'
import { usePokemonStore } from '@/stores'
import { useMegaPreview } from '@/hooks'

export const AbilityTab: React.FC = () => {
  const pokemon = usePokemonStore(s => s.partyList.find(p => p.id === s.activePokemonId))
  const setAbilitySlot = usePokemonStore(s => s.setAbilitySlot)
  const { megaPreviewEnabled, megaAbilities } = useMegaPreview()
  const baseAbility = !pokemon?.details ? null : pokemon.details.abilities.find(a => a.slot === pokemon.data.abilityNumber + 1)
  const isMega = Boolean(megaPreviewEnabled && megaAbilities && megaAbilities.length)
  const ability = isMega ? megaAbilities![0]! : baseAbility

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-4 pt-3 flex-shrink-0">
        <div className="text-foreground mb-2">
          <Skeleton.Text className="font-pixel text-lg">{ability?.name ?? 'Ability'}</Skeleton.Text>
        </div>
        {/* Ability choices (if multiple) */}
        {!!pokemon?.details?.abilities?.length && !isMega && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {pokemon.details.abilities
              .sort((a, b) => a.slot - b.slot)
              .map((opt: { slot: number; name: string }) => {
                const isActive = opt.slot === pokemon.data.abilityNumber + 1
                return (
                  <button
                    key={`ability-${opt.slot}`}
                    type="button"
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors duration-150 cursor-pointer ${
                      isActive ? 'dark:bg-cyan-900/20 bg-cyan-100 dark:text-cyan-200 text-cyan-800 dark:border-cyan-700/60 border-cyan-300' : 'bg-card/50 text-muted-foreground hover:dark:text-cyan-200 hover:text-cyan-700 hover:dark:border-cyan-700/40 hover:border-cyan-300/60'
                    }`}
                    onClick={() => setAbilitySlot(pokemon.id, opt.slot)}
                  >
                    <span className="font-sans text-xs">{opt.name}</span>
                  </button>
                )
              })}
          </div>
        )}
        {isMega && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {megaAbilities!.map(opt => (
              <span key={`mega-ability-${opt.slot}`} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs dark:border-cyan-700/60 border-cyan-300 dark:bg-cyan-900/20 bg-cyan-100 dark:text-cyan-200 text-cyan-800">
                <span className="font-sans text-xs">{opt.name}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="relative flex-1">
        <ScrollableContainer className="absolute inset-0 px-4 pb-4 text-xs text-muted-foreground leading-relaxed overflow-y-auto custom-scrollbar">
          <Skeleton.Text>{ability?.description ?? 'This is a placeholder ability description that shows how the text will be laid out when the actual content loads. It mimics the typical length and structure of Pokemon ability descriptions.'}</Skeleton.Text>
        </ScrollableContainer>
      </div>
    </div>
  )
}
