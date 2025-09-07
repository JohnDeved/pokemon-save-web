import { useEffect, useMemo, useState } from 'react'
import { IoCaretDown, IoCaretUp } from 'react-icons/io5'
import { ScrollableContainer } from '@/components/common'
import { calculateTotalStatsDirect, statAbbreviations } from '@/lib/parser/core/utils'
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
  const ivs = useMemo(() => pokemon?.data.ivs ?? [0, 0, 0, 0, 0, 0], [pokemon?.data?.ivs])
  const evs = useMemo(() => pokemon?.data.evs ?? [0, 0, 0, 0, 0, 0], [pokemon?.data?.evs])
  const displayBaseStats = useMemo(() => {
    if (megaPreviewEnabled && megaBaseStats && megaBaseStats.length === 6) return megaBaseStats
    return baseStats
  }, [megaPreviewEnabled, megaBaseStats, baseStats])
  const baseTotals = useMemo(() => {
    if (!displayBaseStats) return pokemon?.data?.stats ?? [0, 0, 0, 0, 0, 0]
    return calculateTotalStatsDirect(displayBaseStats, ivs, evs, level, nature)
  }, [displayBaseStats, ivs, evs, level, nature, pokemon?.data?.stats])

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
          <div className="mt-0.5 flex flex-col divide-y divide-zinc-800/50">
            {[1, 2, 3, 4, 5].map(i => {
              const abbr = statAbbreviations[i]!
              const base = baseTotals[i] ?? 0
              const stage = stages[i] ?? 0
              const mult = stageMultiplier(stage)
              const effective = Math.floor(base * mult)
              const delta = effective - base
              return (
                <div key={`boost-sbx-${i}`} className="py-0.5 flex items-center gap-2">
                  <div className="w-12 text-white font-pixel text-[11px] leading-none">{abbr}</div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex flex-col overflow-hidden rounded-md border border-zinc-700/70">
                      <button type="button" className="bg-zinc-900/40 text-zinc-200 h-6 w-6 flex items-center justify-center hover:bg-zinc-800/60 cursor-pointer" onClick={() => inc(i, +1)} aria-label={`Increase ${abbr}`}>
                        <IoCaretUp />
                      </button>
                      <button type="button" className="bg-zinc-900/40 text-zinc-200 h-6 w-6 flex items-center justify-center hover:bg-zinc-800/60 border-t border-zinc-700/70 cursor-pointer" onClick={() => inc(i, -1)} aria-label={`Decrease ${abbr}`}>
                        <IoCaretDown />
                      </button>
                    </div>
                    <div className="flex flex-col items-center leading-none min-w-[40px]">
                      {(() => {
                        let stageCls = 'bg-zinc-800/40 text-zinc-300 border border-zinc-700/70'
                        if (stage > 0) stageCls = 'bg-emerald-900/30 text-emerald-300 border border-emerald-700/60'
                        else if (stage < 0) stageCls = 'bg-rose-900/30 text-rose-300 border border-rose-700/60'
                        return <span className={`px-1 py-0.5 mb-0.5 rounded-md text-[9px] tabular-nums ${stageCls}`}>{stage > 0 ? `+${stage}` : stage}</span>
                      })()}
                      <span className="mt-0 text-[10px] text-zinc-400">×{mult.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="ml-auto grid grid-cols-[auto_auto_auto] items-baseline gap-x-3 gap-y-0 text-[11px] geist-font pr-1">
                    <div className="text-zinc-500">Base</div>
                    <div className="text-right text-zinc-300 tabular-nums w-14 leading-none">{base}</div>
                    <div />
                    <div className="text-zinc-500">Result</div>
                    {(() => {
                      let effCls = 'text-zinc-300'
                      let deltaCls = 'text-zinc-500'
                      if (delta > 0) {
                        effCls = 'text-emerald-300'
                        deltaCls = 'text-emerald-300'
                      } else if (delta < 0) {
                        effCls = 'text-rose-300'
                        deltaCls = 'text-rose-300'
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
