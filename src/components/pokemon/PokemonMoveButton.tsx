import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Crosshair } from 'lucide-react'
import { useRef } from 'react'
import { usePokemonStore } from '@/stores'
import { ScrollableContainer } from '@/components/common'
import { CursorFollowHint } from '@/components/common/CursorFollowHint'
import { PokemonTypeBadge } from '@/components/pokemon/PokemonTypeBadge'
import { useSmoothWheelScroll } from '@/hooks/useSmoothWheelScroll'
import { useMegaPreview } from '@/hooks'
import { cn } from '@/lib/utils'
import type { MoveWithDetails } from '@/types'
import { computeMovePowerPreview } from '@/lib/battle'

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
  onClick?: () => void
}

// Component for a single move in the list
export const PokemonMoveButton: React.FC<MoveButtonProps> = ({ move, isExpanded, opensUpward, onHoverStart, onHoverEnd, onClick }) => {
  const popoverDirectionClass = opensUpward ? 'bottom-full mb-1' : 'top-full mt-1'
  const animationY = opensUpward ? 10 : -10
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { onWheel } = useSmoothWheelScroll(scrollRef, { enabled: isExpanded })
  const baseTypes = usePokemonStore(s => s.partyList.find(p => p.id === s.activePokemonId)?.details?.types ?? [])
  const activePokemon = usePokemonStore(s => s.partyList.find(p => p.id === s.activePokemonId))
  const heldItemIdName = activePokemon?.data.itemIdName
  const { megaPreviewEnabled, megaTypes, megaAbilities } = useMegaPreview()
  const effectiveTypes = megaPreviewEnabled && Array.isArray(megaTypes) && megaTypes.length > 0 ? megaTypes : baseTypes
  // Determine effective ability name (prefer Mega ability if previewing)
  const effectiveAbilityName = (() => {
    if (megaPreviewEnabled && Array.isArray(megaAbilities) && megaAbilities.length > 0) {
      const sorted = [...megaAbilities].sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
      return sorted[0]?.name
    }
    const abilities = activePokemon?.details?.abilities ?? []
    if (abilities.length === 0) return undefined
    const sorted = [...abilities].sort((a, b) => a.slot - b.slot)
    const idx = activePokemon?.data.abilityNumber ?? 0
    return sorted[idx]?.name ?? sorted[0]?.name
  })()
  const { finalPower, boosted: showBoost } = computeMovePowerPreview({
    basePower: move.power,
    moveType: move.type,
    userTypes: effectiveTypes,
    abilityName: effectiveAbilityName,
    itemIdName: heldItemIdName,
    currentHp: activePokemon?.data.currentHp,
    maxHp: activePokemon?.data.maxHp,
  })
  // Human-friendly label for move target
  const targetLabel = move.target
    ? move.target
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, c => c.toUpperCase())
    : '—'

  return (
    <div ref={rootRef} className="relative" onWheel={onWheel}>
      <div className={cn('w-full text-left p-3 rounded-lg bg-card/50 group-hover:bg-card/70 border shadow-lg transition-all duration-200 cursor-pointer select-none')} onClick={onClick} onMouseEnter={onHoverStart} onMouseLeave={onHoverEnd} role="button" tabIndex={0}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground truncate w-full block">{move.name}</span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <PokemonTypeBadge type={move.type} />
          <span className="text-xs text-muted-foreground">{move.pp}/--</span>
        </div>
        {/* Hint rendered outside this block to ensure correct absolute positioning */}
      </div>
      <CursorFollowHint anchorRef={rootRef} targetRef={scrollRef} enabled={isExpanded} />
      <AnimatePresence>
        {isExpanded && (
          <motion.div layout initial={{ opacity: 0, y: animationY }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: animationY }} className={cn('absolute left-0 right-0 z-50 p-3 bg-popover border rounded-lg shadow-xl text-xs', popoverDirectionClass)}>
            <div className="flex justify-between text-muted-foreground mb-2 pb-2 border-b border-border/50 -mx-3 px-3">
              <div>
                <div>
                  Power:
                  <div className="text-foreground flex items-center gap-1">
                    {(() => {
                      const dc = move.damageClass
                      const isKnown = dc === 'physical' || dc === 'special' || dc === 'status'
                      return isKnown ? <img src={damageClassIcons[dc]} alt={dc} className="w-3 h-3" /> : null
                    })()}
                    {typeof move.power === 'number' && showBoost ? (
                      <>
                        <span>{move.power}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <span className="text-green-500">{finalPower}</span>
                      </>
                    ) : (
                      <span>{move.power ?? '—'}</span>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <div>
                  Accuracy: <div className="text-foreground">{move.accuracy ? `${move.accuracy}%` : '—'}</div>
                </div>
              </div>
            </div>
            <ScrollableContainer ref={scrollRef} className="max-h-[100px] overflow-y-auto mt-2 custom-scrollbar text-muted-foreground leading-relaxed text-xs">
              <div className="flex items-center gap-1 text-foreground mb-1">
                <Crosshair className="w-3 h-3 text-muted-foreground" />
                <span>Target: {targetLabel}</span>
              </div>
              {move.description || 'Loading description...'}
            </ScrollableContainer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
