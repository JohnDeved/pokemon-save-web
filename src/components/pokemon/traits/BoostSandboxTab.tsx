import { useEffect, useMemo, useState } from 'react'
import { IoCaretDown, IoCaretUp } from 'react-icons/io5'
import { ScrollableContainer } from '@/components/common'
import { statAbbreviations } from '@/lib/parser/core/utils'
import { computeTotalsWithHeldItem } from '@/lib/battle'
import { usePokemonStore, useSaveFileStore } from '@/stores'
import { useMegaPreview } from '@/hooks'

// Helpers
const clampStage = (v: number) => Math.max(-6, Math.min(6, Math.trunc(v)))
const stageMultiplier = (stage: number) => (stage >= 0 ? (2 + clampStage(stage)) / 2 : 2 / (2 - clampStage(stage)))
const fmtDelta = (n: number) => {
  if (n === 0) return '±0'
  if (n > 0) return `+${n}`
  return `${n}`
}

export const BoostSandboxTab: React.FC = () => {
  const pokemon = usePokemonStore(s => s.partyList.find(p => p.id === s.activePokemonId))
  const activePokemonId = pokemon?.id ?? -1
  const saveSessionId = useSaveFileStore(s => s.saveSessionId)
  const { megaPreviewEnabled, megaBaseStats } = useMegaPreview()
  const baseStats = pokemon?.details?.baseStats
  const level = pokemon?.data.level ?? 1
  const nature = pokemon?.data.nature ?? 'Serious'
  const itemIdName = pokemon?.data.itemIdName
  const speciesIdName = pokemon?.data.nameId
  const ivs = useMemo(() => pokemon?.data.ivs ?? [0, 0, 0, 0, 0, 0], [pokemon?.data?.ivs])
  const evs = useMemo(() => pokemon?.data.evs ?? [0, 0, 0, 0, 0, 0], [pokemon?.data?.evs])
  const displayBaseStats = useMemo(() => {
    if (megaPreviewEnabled && megaBaseStats && megaBaseStats.length === 6) return megaBaseStats
    return baseStats
  }, [megaPreviewEnabled, megaBaseStats, baseStats])
  const baseTotals = useMemo(() => {
    if (!displayBaseStats) return pokemon?.data?.stats ?? [0, 0, 0, 0, 0, 0]
    return computeTotalsWithHeldItem(displayBaseStats, ivs, evs, level, nature, itemIdName, speciesIdName) ?? (pokemon?.data?.stats as number[] | undefined) ?? [0, 0, 0, 0, 0, 0]
  }, [displayBaseStats, ivs, evs, level, nature, pokemon?.data?.stats, itemIdName, speciesIdName])

  const [stages, setStages] = useState<number[]>([0, 0, 0, 0, 0, 0])
  useEffect(() => {
    setStages([0, 0, 0, 0, 0, 0])
  }, [activePokemonId, saveSessionId])

  const setStage = (i: number, value: number) => setStages(prev => prev.map((v, idx) => (idx === i ? clampStage(value) : v)))
  const inc = (i: number, d: number) => setStage(i, (stages[i] ?? 0) + d)

  return (
    <div className="flex-1 flex flex-col">
      <div className="relative flex-1">
        <ScrollableContainer className="absolute inset-0 px-4 pb-4 overflow-y-auto custom-scrollbar">
          <div className="mt-0.5 flex flex-col divide-y divide-border/50">
            {[1, 2, 3, 4, 5].map(i => {
              const abbr = statAbbreviations[i]!
              const base = baseTotals[i] ?? 0
              const stage = stages[i] ?? 0
              const mult = stageMultiplier(stage)
              const effective = Math.floor(base * mult)
              const delta = effective - base
              return (
                <div key={`boost-sbx-${i}`} className="py-0.5 flex items-center gap-2">
                  <div className="w-12 text-foreground font-pixel text-[11px] leading-none">{abbr}</div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex flex-col overflow-hidden rounded-md border border-border/70">
                      <button type="button" className="bg-background/40 text-foreground/80 h-6 w-6 flex items-center justify-center hover:bg-background/60 cursor-pointer" onClick={() => inc(i, +1)} aria-label={`Increase ${abbr}`}>
                        <IoCaretUp />
                      </button>
                      <button type="button" className="bg-background/40 text-foreground/80 h-6 w-6 flex items-center justify-center hover:bg-background/60 border-t border-border/70 cursor-pointer" onClick={() => inc(i, -1)} aria-label={`Decrease ${abbr}`}>
                        <IoCaretDown />
                      </button>
                    </div>
                    <div className="flex flex-col items-center leading-none min-w-[40px]">
                      {(() => {
                        let stageCls = 'bg-card/50 text-muted-foreground border border-border/70'
                        if (stage > 0) stageCls = 'dark:bg-emerald-900/30 bg-emerald-100 dark:text-emerald-300 text-emerald-800 border dark:border-emerald-700/60 border-emerald-300'
                        else if (stage < 0) stageCls = 'dark:bg-rose-900/30 bg-rose-100 dark:text-rose-300 text-rose-800 border dark:border-rose-700/60 border-rose-300'
                        return <span className={`px-1 py-0.5 mb-0.5 rounded-md text-[9px] tabular-nums ${stageCls}`}>{stage > 0 ? `+${stage}` : stage}</span>
                      })()}
                      <span className="mt-0 text-[10px] text-muted-foreground">×{mult.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="ml-auto grid grid-cols-[auto_auto_auto] items-baseline gap-x-3 gap-y-0 text-[11px] geist-font pr-1">
                    <div className="text-muted-foreground">Base</div>
                    <div className="text-right text-muted-foreground tabular-nums w-14 leading-none">{base}</div>
                    <div />
                    <div className="text-muted-foreground">Result</div>
                    {(() => {
                      let effCls = 'text-muted-foreground'
                      let deltaCls = 'text-muted-foreground'
                      if (delta > 0) {
                        effCls = 'dark:text-emerald-300 text-emerald-700'
                        deltaCls = 'dark:text-emerald-300 text-emerald-700'
                      } else if (delta < 0) {
                        effCls = 'dark:text-rose-300 text-rose-700'
                        deltaCls = 'dark:text-rose-300 text-rose-700'
                      }
                      return (
                        <>
                          <div className={`text-right tabular-nums w-14 leading-none ${effCls}`}>{effective}</div>
                          <div className={`tabular-nums text-right w-[5ch] whitespace-nowrap leading-none ${deltaCls}`}>{fmtDelta(delta)}</div>
                        </>
                      )
                    })()}
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollableContainer>
      </div>
    </div>
  )
}
