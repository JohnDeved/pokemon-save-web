import React, { useEffect, useState } from 'react'
import { Skeleton } from '@/components/common'
import { PokemonMoveButton } from '@/components/pokemon/PokemonMoveButton'
import { PokemonMovePlaceholder } from '@/components/pokemon/PokemonMovePlaceholder'
import { useActivePokemonLoading } from '@/hooks'
import { usePokemonStore } from '@/stores'
import type { MoveWithDetails } from '@/types'

const EMPTY_MOVE: MoveWithDetails = {
  id: 0,
  name: 'None',
  pp: 0,
  type: 'UNKNOWN' as const,
  description: 'No move assigned.',
  power: null,
  accuracy: null,
}

export const PokemonMovesSection: React.FC = () => {
  const pokemon = usePokemonStore(s => s.partyList.find(p => p.id === s.activePokemonId))
  const activePokemonId = pokemon?.id ?? -1
  const isLoading = useActivePokemonLoading()
  const moves = pokemon?.details?.moves ?? []

  const [expandedMoveIndex, setExpandedMoveIndex] = useState<number | null>(null)
  useEffect(() => {
    setExpandedMoveIndex(null)
  }, [activePokemonId])

  const totalSlots = 4
  return (
    <Skeleton.LoadingProvider loading={isLoading}>
      <div className="p-3 grid grid-cols-2 gap-2">
        {Array.from({ length: totalSlots }).map((_, i) => {
          const move = moves[i] ?? EMPTY_MOVE
          if (!isLoading && move.id === 0) {
            // Show placeholder for empty slot or move id 0
            return (
              <div key={i} className="group cursor-default">
                <PokemonMovePlaceholder />
              </div>
            )
          }
          return (
            <div key={i} className="group">
              {isLoading ? (
                <div className="w-full text-left p-3 rounded-lg bg-card/50 group-hover:bg-card/70 backdrop-blur-sm border shadow-lg transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <Skeleton.Text className="text-sm text-foreground">Move Name</Skeleton.Text>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="inline-flex items-center justify-center gap-1.5 rounded-md text-foreground bg-gradient-to-br px-2 py-1 text-[8px] shadow-md">
                      <Skeleton.Image className="w-3 h-3" />
                      <Skeleton.Text>TYPE</Skeleton.Text>
                    </div>
                    <Skeleton.Text className="text-xs text-muted-foreground">25/25</Skeleton.Text>
                  </div>
                </div>
              ) : (
                <PokemonMoveButton move={move} isExpanded={expandedMoveIndex === i} opensUpward={i < totalSlots / 2} onHoverStart={() => setExpandedMoveIndex(i)} onHoverEnd={() => setExpandedMoveIndex(null)} />
              )}
            </div>
          )
        })}
      </div>
    </Skeleton.LoadingProvider>
  )
}
