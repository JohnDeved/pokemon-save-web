import { AnimatePresence, motion } from 'framer-motion'
import React from 'react'
import { cn } from '../../lib/utils'
import type { MoveWithDetails } from '../../types'
import { ScrollableContainer } from '../common'
import { PokemonTypeBadge } from './PokemonTypeBadge'

const damageClassIcons: Record<'physical' | 'special' | 'status', string> = {
  physical: '/damage-type-icons/physical.png',
  special: '/damage-type-icons/special.png',
  status: '/damage-type-icons/status.png',
}

// Props for PokemonMoveButton
export interface MoveButtonProps {
  move: MoveWithDetails
  isExpanded: boolean
  opensUpward: boolean
}

// Component for a single move in the list
export const PokemonMoveButton: React.FC<MoveButtonProps> = ({ move, isExpanded, opensUpward }) => {
  const popoverDirectionClass = opensUpward ? 'bottom-full mb-1' : 'top-full mt-1'
  const animationY = opensUpward ? 10 : -10

  return (
    <div className="relative">
      <div className="w-full text-left p-3 rounded-lg bg-slate-800/50 group-hover:bg-slate-700/70 border border-slate-700 shadow-lg transition-all duration-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white truncate w-full block" title={move.name}>{move.name}</span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <PokemonTypeBadge type={move.type}/>
          <span className="text-xs text-slate-300">{move.pp}/--</span>
        </div>
      </div>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            layout
            initial={{ opacity: 0, y: animationY }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: animationY }}
            className={cn('absolute left-0 right-0 z-50 p-3 bg-slate-900 border border-slate-800 rounded-lg shadow-xl text-xs', popoverDirectionClass)}
          >
            <div className="flex justify-between text-slate-400 mb-2 pb-2 border-b border-slate-700/50">
              <div>
                <div>
                  Power:
                  <div className="text-white flex items-center gap-1">
                    {move.damageClass && <img src={damageClassIcons[move.damageClass]} alt={move.damageClass} className="w-3 h-3"/>}
                    {move.power ?? '—'}
                  </div>
                </div>
              </div>
              <div>
                <div>Accuracy: <div className="text-white">{move.accuracy ? `${move.accuracy}%` : '—'}</div></div>
              </div>
            </div>
            <ScrollableContainer className="max-h-[100px] overflow-y-auto mt-2 custom-scrollbar text-slate-400 leading-relaxed text-xs">
              Targets: {move.target ?? ''} <br/>
              {move.description || 'Loading description...'}
            </ScrollableContainer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
