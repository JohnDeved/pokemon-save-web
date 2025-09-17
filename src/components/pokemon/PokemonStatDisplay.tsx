import {
  calculateTotalStatsDirect,
  MAX_EV,
  MAX_IV,
  statAbbreviations,
} from '@/lib/parser/core/utils'
import { applyHeldItemStatBoosts, computeTotalsWithHeldItem } from '@/lib/battle'
import { usePokemonStore } from '@/stores'
import { Skeleton } from '@/components/common'
import { Slider } from '@/components/ui/slider'
import { useMemo, useRef, useState } from 'react'
import { useActivePokemonLoading, useMegaPreview } from '@/hooks'
import { CursorFollowHint } from '@/components/common/CursorFollowHint'

// Labels come from shared utils to avoid hardcoding

// Move EVSliderProps to top-level
interface EVSliderProps {
  value: number
  onChange: (newValue: number) => void
  maxVisualValue?: number
}

const EVSlider: React.FC<EVSliderProps> = ({ value, onChange, maxVisualValue }) => {
  const handleValueChange = (val: number[]) => {
    onChange(val[0]!)
  }
  return (
    <Slider
      value={[value]}
      max={MAX_EV}
      onValueChange={handleValueChange}
      className="[&_[data-slot=slider-track]]:bg-input/30 [&_[data-slot=slider-range]]:bg-gradient-to-r [&_[data-slot=slider-range]]:from-cyan-500 [&_[data-slot=slider-range]]:to-blue-500"
      maxVisualValue={maxVisualValue}
    />
  )
}

export const PokemonStatDisplay: React.FC = () => {
  const pokemon = usePokemonStore(s => s.partyList.find(p => p.id === s.activePokemonId))
  const setEvIndex = usePokemonStore(s => s.setEvIndex)
  const setIvIndex = usePokemonStore(s => s.setIvIndex)
  const getRemainingEvs = usePokemonStore(s => s.getRemainingEvs)
  const isLoading = useActivePokemonLoading()
  const { megaBaseStats, megaPreviewEnabled } = useMegaPreview()
  const ivs = pokemon?.data.ivs
  const evs = pokemon?.data.evs
  const baseStats = pokemon?.details?.baseStats
  const natureModifier = pokemon?.data.natureModifiersArray
  const level = pokemon?.data.level ?? 1
  const nature = pokemon?.data.nature ?? 'Serious'
  const itemIdName = pokemon?.data.itemIdName
  const speciesIdName = pokemon?.data.nameId

  // Track which IV is being hovered for preview
  const [hoveredIvIndex, setHoveredIvIndex] = useState<number | null>(null)
  const ivCellRefs = useRef<(HTMLDivElement | null)[]>([])

  // Helper to adapt stored element to a RefObject that CursorFollowHint expects
  const getIvAnchorRef = (idx: number): React.RefObject<HTMLElement | null> => {
    return {
      current: (ivCellRefs.current[idx] ?? null) as HTMLElement | null,
    } as React.RefObject<HTMLElement | null>
  }
  // moved to store via useMegaPreview

  // Handler for EV changes - update parent state immediately
  function handleEvChange(statIndex: number, newValue: number) {
    if (typeof pokemon?.id !== 'number') return
    setEvIndex(pokemon.id, statIndex, newValue)
  }

  // Handler for IV clicks - toggle between max (31) and 0
  function handleIvClick(statIndex: number, currentIv: number) {
    if (typeof pokemon?.id !== 'number') return
    const nextIv = currentIv !== MAX_IV ? MAX_IV : 0
    setIvIndex(pokemon.id, statIndex, nextIv)
  }

  // Determine which base stats to display (normal vs mega)
  const displayBaseStats = useMemo(() => {
    if (megaPreviewEnabled && megaBaseStats && megaBaseStats.length === 6) return megaBaseStats
    return baseStats
  }, [megaPreviewEnabled, megaBaseStats, baseStats])

  // Calculate full totals for the current display base stats

  const displayTotals = useMemo(() => {
    const totals = computeTotalsWithHeldItem(
      displayBaseStats,
      ivs,
      evs,
      level,
      nature,
      itemIdName,
      speciesIdName
    )
    return totals ?? pokemon?.data.stats
  }, [displayBaseStats, ivs, evs, level, nature, pokemon?.data.stats, itemIdName, speciesIdName])

  // Calculate what the total stat would be when previewing a target IV value
  function calculatePreviewStat(statIndex: number, targetIv: number) {
    if (!pokemon?.data || !displayBaseStats) return null
    // Create a copy of IVs with the selected stat set to targetIv
    const currentIvs = [...pokemon.data.ivs]
    if (currentIvs[statIndex] === targetIv) return null
    currentIvs[statIndex] = targetIv
    // Use calculateTotalStatsDirect for stat calculation
    const newStats = calculateTotalStatsDirect(
      displayBaseStats,
      currentIvs,
      pokemon.data.evs,
      pokemon.data.level,
      pokemon.data.nature
    )
    const boosted = applyHeldItemStatBoosts(newStats, itemIdName, speciesIdName)
    return boosted?.[statIndex] ?? null
  }

  return (
    <Skeleton.LoadingProvider loading={isLoading}>
      <div className="p-4 space-y-2 text-xs w-full">
        {/* Mega preview controls moved to PokemonHeader to prevent layout shift */}
        <div className="grid grid-cols-10 gap-2 text-muted-foreground">
          <div className="col-span-1">STAT</div>
          <div className="col-span-5 text-end">EV</div>
          <div className="text-center">IV</div>
          <div className="text-center">BASE</div>
          <div className="text-right col-span-2">TOTAL</div>
        </div>
        {statAbbreviations.map((statName, index) => {
          const iv = ivs?.[index] ?? 0
          const base = displayBaseStats?.[index] ?? baseStats?.[index] ?? 0
          const total = displayTotals?.[index] ?? 0
          const natureMod = natureModifier?.[index] ?? 1
          let statClass = 'text-muted-foreground'
          if (natureMod > 1) statClass = 'text-green-400/50 font-bold'
          else if (natureMod < 1) statClass = 'text-red-400/50 font-bold'
          // IV color: bright cyan for max IV (31), slightly dimmed for non-max
          const ivClass = iv === MAX_IV ? 'text-cyan-400' : 'text-cyan-800'
          // Calculate preview stat if this IV is hovered and not at max
          const isHovered = hoveredIvIndex === index
          const previewTotal = isHovered
            ? iv !== MAX_IV
              ? calculatePreviewStat(index, MAX_IV)
              : calculatePreviewStat(index, 0)
            : null
          const isShowingPreview = isHovered && previewTotal !== null
          // Calculate how many more EVs can be assigned to this stat
          let maxVisualValue = MAX_EV
          if (
            pokemon?.id !== null &&
            pokemon?.id !== undefined &&
            typeof getRemainingEvs === 'function'
          ) {
            const remainingTotalEvs = getRemainingEvs(pokemon.id)
            maxVisualValue = Math.min(MAX_EV, (evs?.[index] ?? 0) + remainingTotalEvs)
          }

          return (
            <div key={statName} className="grid grid-cols-10 gap-2 items-center">
              <div className="text-foreground">{statName}</div>
              <div className="col-span-5 flex items-center gap-2">
                <EVSlider
                  value={evs?.[index] ?? 0}
                  onChange={newValue => {
                    handleEvChange(index, newValue)
                  }}
                  maxVisualValue={maxVisualValue}
                />
                <span className="text-foreground w-8 text-right text-xs flex-shrink-0">
                  {evs?.[index] ?? 0}
                </span>
              </div>
              <div
                className={`relative text-center text-sm ${ivClass} cursor-pointer hover:text-cyan-300 transition-colors`}
                onClick={() => handleIvClick(index, iv)}
                onMouseEnter={() => setHoveredIvIndex(index)}
                onMouseLeave={() => setHoveredIvIndex(null)}
                ref={el => {
                  ivCellRefs.current[index] = el
                }}
              >
                {isHovered ? (iv !== MAX_IV ? MAX_IV : 0) : iv}
                <CursorFollowHint
                  anchorRef={getIvAnchorRef(index)}
                  enabled={isHovered}
                  requireOverflow={false}
                  once={false}
                  label={iv !== MAX_IV ? `Click to set to max (${MAX_IV})` : 'Click to set to 0'}
                  offsetY={-10}
                />
              </div>
              <div className="text-muted-foreground text-center text-sm">
                <Skeleton.Text>{isLoading ? 255 : base}</Skeleton.Text>
              </div>
              <div
                className={`col-span-2 text-right text-sm ${isShowingPreview ? 'text-cyan-300' : statClass} transition-colors`}
              >
                {isShowingPreview && previewTotal !== null ? (
                  <span>
                    {(() => {
                      const delta = (previewTotal ?? 0) - total
                      const deltaClass = delta >= 0 ? 'text-green-400' : 'text-red-400'
                      const deltaText = delta >= 0 ? `+${delta}` : `${delta}`
                      return (
                        <>
                          <span className={deltaClass}>{deltaText}</span> {previewTotal}
                        </>
                      )
                    })()}
                  </span>
                ) : (
                  total
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Skeleton.LoadingProvider>
  )
}
