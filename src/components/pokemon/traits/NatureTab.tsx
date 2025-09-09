import { useEffect, useState } from 'react'
import { IoCaretDown, IoCaretUp } from 'react-icons/io5'
import { ScrollableContainer, Skeleton } from '@/components/common'
import { PokemonNatureCombobox } from '@/components/pokemon/PokemonNatureCombobox'
import { findNatureForEffects, getStatAbbr, statAbbreviations } from '@/lib/parser/core/utils'
import { computeTotalsWithHeldItem } from '@/lib/battle'
import { usePokemonStore, useSaveFileStore } from '@/stores'

export const NatureTab: React.FC = () => {
  const pokemon = usePokemonStore(s => s.partyList.find(p => p.id === s.activePokemonId))
  const activePokemonId = pokemon?.id ?? -1
  const setNature = usePokemonStore(s => s.setNature)
  const saveSessionId = useSaveFileStore(s => s.saveSessionId)
  const natureName = pokemon?.data.nature ?? 'Unknown'
  const natureMods = pokemon?.data.natureModifiers
  const incIndex = natureMods?.increased ?? -1
  const decIndex = natureMods?.decreased ?? -1
  const isNeutralNature = !natureMods || (incIndex === -1 && decIndex === -1)
  const [chooseMode, setChooseMode] = useState<null | 'raise' | 'lower'>(null)
  const [hoveredStat, setHoveredStat] = useState<number | null>(null)

  // Exit editing mode when switching to a different Pokemon
  useEffect(() => {
    setChooseMode(null)
    setHoveredStat(null)
  }, [activePokemonId, saveSessionId])

  function handleSelectCounterpart(index: number) {
    if (!pokemon || !natureMods) return
    if (index === 0) return // HP unaffected by nature
    if (chooseMode === 'raise') {
      const newNature = findNatureForEffects(index, decIndex >= 0 ? decIndex : 1)
      setNature(pokemon.id, newNature)
    } else if (chooseMode === 'lower') {
      const newNature = findNatureForEffects(incIndex >= 0 ? incIndex : 1, index)
      setNature(pokemon.id, newNature)
    }
    setChooseMode(null)
  }

  // Calculate nature-only deltas for increased/decreased stats
  const baseStats = pokemon?.details?.baseStats
  const ivs = pokemon?.data?.ivs
  const evs = pokemon?.data?.evs
  const level = pokemon?.data?.level ?? 100
  const currentTotalsRaw = pokemon?.data?.stats ?? []
  const itemIdName = pokemon?.data?.itemIdName
  const speciesIdName = pokemon?.data?.nameId

  // Neutral totals (no nature effects). Computed directly for React Compiler friendliness.
  const neutralTotals = baseStats && ivs && evs ? computeTotalsWithHeldItem(baseStats, ivs, evs, level, 'Serious', itemIdName, speciesIdName) : null

  const currentTotals = baseStats && ivs && evs ? computeTotalsWithHeldItem(baseStats, ivs, evs, level, natureName, itemIdName, speciesIdName) : currentTotalsRaw

  // Current raised/lowered deltas from nature
  let raisedDelta = 0
  let loweredDelta = 0
  if (natureMods && neutralTotals && currentTotals) {
    const inc = incIndex
    const dec = decIndex
    if (inc > 0) {
      raisedDelta = Math.max(0, (currentTotals[inc] ?? 0) - (neutralTotals[inc] ?? 0))
    }
    if (dec > 0) {
      loweredDelta = Math.max(0, (neutralTotals[dec] ?? 0) - (currentTotals[dec] ?? 0))
    }
  }

  function getPreviewDelta(index: number): number | null {
    if (!chooseMode || !natureMods || !baseStats || !ivs || !evs) return null
    if (index === 0) return null
    const incCurrent = natureMods.increased >= 0 ? natureMods.increased : 1
    const decCurrent = natureMods.decreased >= 0 ? natureMods.decreased : 1
    const inc = chooseMode === 'raise' ? index : incCurrent
    const dec = chooseMode === 'lower' ? index : decCurrent
    if (inc === dec) return 0
    const nextNature = findNatureForEffects(inc, dec)
    const newTotals = computeTotalsWithHeldItem(baseStats, ivs, evs, level, nextNature, itemIdName, speciesIdName)
    const delta = ((newTotals?.[index] ?? 0) as number) - (currentTotals?.[index] ?? 0)
    return delta
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="relative flex-1">
        <ScrollableContainer className="absolute inset-0 px-4 pt-3 pb-4 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col gap-3">
            <div className="text-foreground">
              {pokemon ? <PokemonNatureCombobox value={pokemon.data.nature} onChange={nature => setNature(pokemon.id, nature)} asText triggerClassName="font-pixel text-xl text-foreground" /> : <Skeleton.Text className="font-pixel text-xl">{natureName}</Skeleton.Text>}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {incIndex >= 0 && (
                <button
                  type="button"
                  onClick={() => setChooseMode(prev => (prev === 'raise' ? null : 'raise'))}
                  title="Click to change raised stat"
                  aria-pressed={chooseMode === 'raise'}
                  className={`inline-flex items-center gap-1 rounded-md border dark:border-emerald-700/60 border-emerald-300 dark:bg-emerald-900/30 bg-emerald-100 dark:text-emerald-300 text-emerald-800 px-2 py-1 text-xs transition-all duration-150 ease-out cursor-pointer hover:ring-1 hover:dark:ring-emerald-300/40 hover:ring-emerald-400/40 ${
                    chooseMode === 'raise' ? 'ring-2 ring-emerald-400/60 hover:ring-2 hover:ring-emerald-400/60 animate-glow-emerald' : ''
                  }`}
                >
                  <IoCaretUp className="text-emerald-300" /> Raises {getStatAbbr(incIndex)}
                  {raisedDelta > 0 && <span className="ml-1 dark:text-emerald-200/90 text-emerald-700/80">+{raisedDelta}</span>}
                </button>
              )}
              {decIndex >= 0 && (
                <button
                  type="button"
                  onClick={() => setChooseMode(prev => (prev === 'lower' ? null : 'lower'))}
                  title="Click to change lowered stat"
                  aria-pressed={chooseMode === 'lower'}
                  className={`inline-flex items-center gap-1 rounded-md border dark:border-rose-700/60 border-rose-300 dark:bg-rose-900/30 bg-rose-100 dark:text-rose-300 text-rose-800 px-2 py-1 text-xs transition-all duration-150 ease-out cursor-pointer hover:ring-1 hover:dark:ring-rose-300/40 hover:ring-rose-400/40 ${
                    chooseMode === 'lower' ? 'ring-2 ring-rose-400/60 hover:ring-2 hover:ring-rose-400/60 animate-glow-rose' : ''
                  }`}
                >
                  <IoCaretDown className="text-rose-300" /> Lowers {getStatAbbr(decIndex)}
                  {loweredDelta > 0 && <span className="ml-1 dark:text-rose-200/90 text-rose-700/80">-{loweredDelta}</span>}
                </button>
              )}
              {isNeutralNature && <div className="inline-flex items-center gap-1 rounded-md border bg-card/40 text-muted-foreground px-2 py-1 text-xs">Neutral nature</div>}
            </div>

            <div className="mt-2">
              {(() => {
                let headerText = 'Affected Stats'
                if (chooseMode === 'raise') headerText = 'Select stat to Raise'
                else if (chooseMode === 'lower') headerText = 'Select stat to Lower'
                return <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{headerText}</div>
              })()}
              <div className="flex flex-wrap gap-1.5">
                {statAbbreviations.map((abbr, i) => {
                  const isUp = incIndex === i
                  const isDown = decIndex === i
                  const base = 'relative px-2 py-1 rounded-md border text-xs leading-none transition-[padding] duration-200 ease-out'
                  let color = 'bg-card/50 border text-muted-foreground'
                  if (isUp) color = 'dark:bg-emerald-900/30 bg-emerald-100 dark:border-emerald-700/60 border-emerald-300 dark:text-emerald-300 text-emerald-800'
                  else if (isDown) color = 'dark:bg-rose-900/30 bg-rose-100 dark:border-rose-700/60 border-rose-300 dark:text-rose-300 text-rose-800'

                  let interactive = false
                  if (chooseMode === 'raise') interactive = i !== 0 && i !== decIndex
                  if (chooseMode === 'lower') interactive = i !== 0 && i !== incIndex

                  let ringColor = 'hover:ring-ring/30'
                  if (chooseMode === 'raise') ringColor = 'hover:ring-emerald-300/40'
                  else if (chooseMode === 'lower') ringColor = 'hover:ring-rose-300/40'

                  let interactiveCls = 'transition-all duration-150 ease-out'
                  if (chooseMode) {
                    interactiveCls = interactive ? `cursor-pointer hover:ring-1 ${ringColor} transition-all duration-150 ease-out` : 'opacity-40 cursor-not-allowed'
                  }

                  const preview = hoveredStat === i ? getPreviewDelta(i) : null
                  let displayDelta: number | null = null
                  if (chooseMode && hoveredStat === i) {
                    if (preview === 0) {
                      if (chooseMode === 'raise' && incIndex === i && raisedDelta > 0) {
                        displayDelta = raisedDelta
                      } else if (chooseMode === 'lower' && decIndex === i && loweredDelta > 0) {
                        displayDelta = -loweredDelta
                      }
                    } else if (typeof preview === 'number' && preview !== 0) {
                      displayDelta = preview
                    }
                  }
                  const padAnimCls = chooseMode && interactive ? 'hover:pr-7' : ''
                  return (
                    <div
                      key={`nature-stat-${i}`}
                      className={`${base} ${color} ${interactiveCls} ${padAnimCls}`}
                      onClick={() => chooseMode && interactive && handleSelectCounterpart(i)}
                      onMouseEnter={() => (chooseMode && interactive ? setHoveredStat(i) : undefined)}
                      onMouseLeave={() => (hoveredStat === i ? setHoveredStat(null) : undefined)}
                      role={chooseMode ? 'button' : undefined}
                      aria-disabled={chooseMode && !interactive ? true : undefined}
                    >
                      {abbr}
                      <span className={`pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 whitespace-nowrap text-right transition-opacity duration-150 ease-out select-none ${displayDelta !== null ? 'opacity-100' : 'opacity-0'}`} aria-hidden={displayDelta === null ? true : undefined}>
                        {displayDelta !== null && <span className={displayDelta > 0 ? 'dark:text-emerald-200/90 text-emerald-700/80' : 'dark:text-rose-200/90 text-rose-700/80'}>{displayDelta > 0 ? `+${displayDelta}` : `${displayDelta}`}</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </ScrollableContainer>
      </div>
    </div>
  )
}
