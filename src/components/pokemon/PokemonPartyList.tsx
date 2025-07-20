import React from 'react'
import { PokemonStatus } from './PokemonStatus'
import type { Pokemon } from '../../types'
import { PokemonStatusPlaceholder } from './PokemonStatusPlaceholder'
import { CONSTANTS } from '../../lib/parser'

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
  const emptySlots = Array.from({ length: Math.max(0, CONSTANTS.MAX_PARTY_SIZE - partyList.length) })

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
