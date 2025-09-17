import { Reorder } from 'framer-motion'
import { useCallback, useRef, useState } from 'react'
import { PokemonStatus } from '@/components/pokemon/PokemonStatus'
import { PokemonStatusPlaceholder } from '@/components/pokemon/PokemonStatusPlaceholder'
import { QuetzalConfig } from '@/lib/parser/games/quetzal/config'
import { usePokemonStore } from '@/stores'
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
  const commitPartyReorder = usePokemonStore(s => s.commitPartyReorder)
  const emptySlots = Array.from({ length: Math.max(0, config.maxPartySize - partyList.length) })
  const constraintsRef = useRef<HTMLDivElement>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const preDragIdsRef = useRef<number[] | null>(null)

  const handleReorder = useCallback(
    (newOrder: UIPokemonData[]) => {
      // Keep object identity and ids during drag for stability
      setPartyList(newOrder)
    },
    [setPartyList]
  )

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
            onDragStart={() => {
              setDraggingId(pokemon.id)
              // Capture pre-drag UI ids in slot order for a correct undo snapshot
              preDragIdsRef.current = usePokemonStore.getState().partyList.map(p => p.id)
            }}
            onDragEnd={() => {
              setDraggingId(null)
              const ids = preDragIdsRef.current ?? undefined
              commitPartyReorder(usePokemonStore.getState().partyList, ids)
              preDragIdsRef.current = null
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
