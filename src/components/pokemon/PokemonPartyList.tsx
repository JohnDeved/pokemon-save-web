import { QuetzalConfig } from '../../lib/parser/games/quetzal/config'
import { usePokemonStore } from '@/stores'
import { PokemonStatus } from './PokemonStatus'
import { PokemonStatusPlaceholder } from './PokemonStatusPlaceholder'

// Use Quetzal config for constants since that's what most users will be using
const config = new QuetzalConfig()

interface PokemonPartyListProps {
  isRenaming: boolean
  onPokemonHover?: (id: number) => void
}

export const PokemonPartyList: React.FC<PokemonPartyListProps> = ({
  isRenaming,
  onPokemonHover,
}) => {
  const { partyList, activePokemonId, setActivePokemonId } = usePokemonStore()
  const emptySlots = Array.from({ length: Math.max(0, config.maxPartySize - partyList.length) })

  return (
    <section className='flex flex-col gap-4'>
      {partyList.map((pokemon) => (
        <div
          key={pokemon.id}
          onClick={() => {
            if (!isRenaming) setActivePokemonId(pokemon.id)
          }}
          onMouseEnter={() => {
            if (onPokemonHover) onPokemonHover(pokemon.id)
          }} // Preload on hover
          className='cursor-pointer group'
        >
          <PokemonStatus pokemon={pokemon} isActive={pokemon.id === activePokemonId} />
        </div>
      ))}
      {emptySlots.map((_, index) => <PokemonStatusPlaceholder key={`placeholder-${index}`} />)}
    </section>
  )
}
