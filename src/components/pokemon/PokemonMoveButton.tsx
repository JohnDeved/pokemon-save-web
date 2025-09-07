import { AnimatePresence, motion } from 'framer-motion'
import { useRef } from 'react'
import { cn } from '@/lib/utils'
import type { MoveWithDetails } from '@/types'
import { ScrollableContainer } from '@/components/common'
import { PokemonTypeBadge } from '@/components/pokemon/PokemonTypeBadge'
import { useSmoothWheelScroll } from '@/hooks/useSmoothWheelScroll'

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
  onHoverStart?: () => void
  onHoverEnd?: () => void
}

// Component for a single move in the list
export const PokemonMoveButton: React.FC<MoveButtonProps> = ({ move, isExpanded, opensUpward, onHoverStart, onHoverEnd }) => {
  const popoverDirectionClass = opensUpward ? 'bottom-full mb-1' : 'top-full mt-1'
  const animationY = opensUpward ? 10 : -10
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { onWheel } = useSmoothWheelScroll(scrollRef, { enabled: isExpanded })

  return (
    <div ref={rootRef} className="relative" onWheel={onWheel}>
      <div className={cn('w-full text-left p-3 rounded-lg bg-zinc-800/50 group-hover:bg-zinc-700/70 border border-zinc-700 shadow-lg transition-all duration-200')} onMouseEnter={onHoverStart} onMouseLeave={onHoverEnd}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white truncate w-full block" title={move.name}>
            {move.name}
          </span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <PokemonTypeBadge type={move.type} />
          <span className="text-xs text-zinc-300">{move.pp}/--</span>
        </div>
      </div>
      <AnimatePresence>
        {isExpanded && (
          <motion.div layout initial={{ opacity: 0, y: animationY }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: animationY }} className={cn('absolute left-0 right-0 z-50 p-3 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl text-xs', popoverDirectionClass)}>
            <div className="flex justify-between text-zinc-400 mb-2 pb-2 border-b border-zinc-700/50">
              <div>
                <div>
                  Power:
                  <div className="text-white flex items-center gap-1">
                    {(() => {
                      const dc = move.damageClass
                      const isKnown = dc === 'physical' || dc === 'special' || dc === 'status'
                      return isKnown ? <img src={damageClassIcons[dc]} alt={dc} className="w-3 h-3" /> : null
                    })()}
                    {move.power ?? '—'}
                  </div>
                </div>
              </div>
              <div>
                <div>
                  Accuracy: <div className="text-white">{move.accuracy ? `${move.accuracy}%` : '—'}</div>
                </div>
              </div>
            </div>
            <ScrollableContainer ref={scrollRef} className="max-h-[100px] overflow-y-auto mt-2 custom-scrollbar text-zinc-400 leading-relaxed text-xs">
              Targets: {move.target ?? ''} <br />
              {move.description || 'Loading description...'}
            </ScrollableContainer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
