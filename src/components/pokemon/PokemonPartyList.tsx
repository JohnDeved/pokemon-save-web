import { QuetzalConfig } from '../../lib/parser/games/quetzal/config'
import type { Pokemon } from '../../types'
import { PokemonStatus } from './PokemonStatus'
import { PokemonStatusPlaceholder } from './PokemonStatusPlaceholder'

// Use Quetzal config for constants since that's what most users will be using
const config = new QuetzalConfig()

interface PokemonPartyListProps {
  partyList: Pokemon[]
  activePokemonId: number
  onPokemonSelect: (id: number) => void
  isRenaming: boolean
  onPokemonHover?: (id: number) => void // Added prop
}

export const PokemonPartyList: React.FC<PokemonPartyListProps> = ({
  partyList,
  activePokemonId,
  onPokemonSelect,
  isRenaming,
  onPokemonHover,
}) => {
  const emptySlots = Array.from({ length: Math.max(0, config.saveLayout.maxPartySize - partyList.length) })

  return (
    <section className="flex flex-col gap-4">
      {partyList.map(pokemon => (
        <div
          key={pokemon.id}
          onClick={() => { if (!isRenaming) onPokemonSelect(pokemon.id) }}
          onMouseEnter={() => { if (onPokemonHover) onPokemonHover(pokemon.id) }} // Preload on hover
          className="cursor-pointer group"
        >
          <PokemonStatus pokemon={pokemon} isActive={pokemon.id === activePokemonId}/>
        </div>
      ))}
      {emptySlots.map((_, index) => (
        <PokemonStatusPlaceholder key={`placeholder-${index}`}/>
      ))}
    </section>
  )
}
