import React, { useState } from 'react'
import type { MoveWithDetails } from '../../types'
import { Skeleton } from '../common'
import { PokemonMoveButton } from './PokemonMoveButton'
import { PokemonMovePlaceholder } from './PokemonMovePlaceholder'

interface PokemonMovesProps {
  moves?: MoveWithDetails[]
  isLoading?: boolean
}

export const PokemonMovesSection: React.FC<PokemonMovesProps> = ({
  moves = [],
  isLoading = false,
}) => {
  const [expandedMoveIndex, setExpandedMoveIndex] = useState<number | null>(null)
  const totalSlots = 4
  return (
    <Skeleton.LoadingProvider loading={isLoading}>
      <div className="p-2 sm:p-3 grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2">
        {Array.from({ length: totalSlots }).map((_, i) => {
          const move = moves[i]!
          if (!isLoading && move.id === 0) {
            // Show placeholder for empty slot or move id 0
            return (
              <div key={i} className="group cursor-default">
                <PokemonMovePlaceholder/>
              </div>
            )
          }
          return (
            <div
              key={i}
              className="group cursor-pointer"
              onMouseEnter={() => { !isLoading && setExpandedMoveIndex(i) }}
              onMouseLeave={() => { !isLoading && setExpandedMoveIndex(null) }}
            >
              {isLoading
                ? (
                  <div className="w-full text-left p-3 rounded-lg bg-slate-800/50 group-hover:bg-slate-700/70 backdrop-blur-sm border border-slate-700 shadow-lg transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <Skeleton.Text className="text-sm text-white">Move Name</Skeleton.Text>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="inline-flex items-center justify-center gap-1.5 rounded-md text-white bg-gradient-to-br px-2 py-1 text-[8px] shadow-md">
                        <Skeleton.Image className="w-3 h-3"/>
                        <Skeleton.Text>TYPE</Skeleton.Text>
                      </div>
                      <Skeleton.Text className="text-xs text-slate-300">25/25</Skeleton.Text>
                    </div>
                  </div>
                  )
                : (
                  <PokemonMoveButton
                    move={move}
                    isExpanded={expandedMoveIndex === i}
                    opensUpward={i < 2}
                  />
                  )}
            </div>
          )
        })}
      </div>
    </Skeleton.LoadingProvider>
  )
}
