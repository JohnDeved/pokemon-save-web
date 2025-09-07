import { Reorder } from 'framer-motion'
import { useCallback, useRef, useState } from 'react'
import { PokemonStatus } from '@/components/pokemon/PokemonStatus'
import { PokemonStatusPlaceholder } from '@/components/pokemon/PokemonStatusPlaceholder'
import { QuetzalConfig } from '@/lib/parser/games/quetzal/config'
import { usePokemonStore, useSaveFileStore } from '@/stores'
import { useHistoryStore } from '@/stores/useHistoryStore'
import type { UIPokemonData } from '@/types'

// Use Quetzal config for constants since that's what most users will be using
const config = new QuetzalConfig()

interface PokemonPartyListProps {
  isRenaming: boolean
  onPokemonHover?: (id: number) => void
}

export const PokemonPartyList: React.FC<PokemonPartyListProps> = ({ isRenaming, onPokemonHover }) => {
  const partyList = usePokemonStore(s => s.partyList)
  const activePokemonId = usePokemonStore(s => s.activePokemonId)
  const setActivePokemonId = usePokemonStore(s => s.setActivePokemonId)
  const setPartyList = usePokemonStore(s => s.setPartyList)
  const emptySlots = Array.from({ length: Math.max(0, config.maxPartySize - partyList.length) })
  const constraintsRef = useRef<HTMLDivElement>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)

  const handleReorder = useCallback(
    (newOrder: UIPokemonData[]) => {
      // Keep object identity and ids during drag for stability
      setPartyList(newOrder)
    },
    [setPartyList]
  )

  const syncSaveOrder = useCallback(() => {
    const currentList = usePokemonStore.getState().partyList
    const bases = currentList.map(p => p.data)
    // Snapshot before applying change for undo/redo
    try {
      useHistoryStore.getState().queueSnapshot()
    } catch {}
    useSaveFileStore.setState(state => {
      if (!state.saveData) return state
      return {
        saveData: { ...state.saveData, party_pokemon: bases, __transient__: true },
        lastUpdateTransient: true,
      }
    })
  }, [])

  return (
    <div ref={constraintsRef} className="flex flex-col gap-4">
      <Reorder.Group axis="y" values={partyList} onReorder={handleReorder} className="flex flex-col gap-4">
        {partyList.map(pokemon => (
          <Reorder.Item
            key={pokemon.id}
            value={pokemon}
            dragConstraints={constraintsRef}
            dragElastic={0.1}
            drag={!isRenaming}
            animate={draggingId === pokemon.id ? { scale: 1.05 } : { scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            onDragStart={() => setDraggingId(pokemon.id)}
            onDragEnd={() => {
              setDraggingId(null)
              syncSaveOrder()
            }}
            className="cursor-pointer group"
          >
            <div
              onMouseDown={() => {
                if (!isRenaming) setActivePokemonId(pokemon.id)
              }}
              onMouseEnter={() => {
                if (onPokemonHover) onPokemonHover(pokemon.id)
              }}
            >
              <PokemonStatus pokemon={pokemon} isActive={pokemon.id === activePokemonId} />
            </div>
          </Reorder.Item>
        ))}
      </Reorder.Group>
      {emptySlots.map((_, index) => (
        <PokemonStatusPlaceholder key={`placeholder-${index}`} />
      ))}
    </div>
  )
}
