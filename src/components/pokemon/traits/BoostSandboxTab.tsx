import { useEffect, useState } from 'react'
import { IoCaretDown, IoCaretUp } from 'react-icons/io5'
import { ScrollableContainer } from '@/components/common'
import { statAbbreviations } from '@/lib/parser/core/utils'
import { usePokemonStore } from '@/stores'

// Helpers
const clampStage = (v: number) => Math.max(-6, Math.min(6, Math.trunc(v)))
const stageMultiplier = (stage: number) => (stage >= 0 ? (2 + clampStage(stage)) / 2 : 2 / (2 - clampStage(stage)))
const fmtDelta = (n: number) => (n === 0 ? '±0' : n > 0 ? `+${n}` : `${n}`)

export const BoostSandboxTab: React.FC = () => {
  const { partyList, activePokemonId } = usePokemonStore()
  const pokemon = partyList.find(p => p.id === activePokemonId)
  const baseTotals = pokemon?.data?.stats ?? [0, 0, 0, 0, 0, 0]

  const [stages, setStages] = useState<number[]>([0, 0, 0, 0, 0, 0])
  useEffect(() => {
    setStages([0, 0, 0, 0, 0, 0])
  }, [activePokemonId])

  const setStage = (i: number, value: number) => setStages(prev => prev.map((v, idx) => (idx === i ? clampStage(value) : v)))
  const inc = (i: number, d: number) => setStage(i, (stages[i] ?? 0) + d)

  return (
    <div className="flex-1 flex flex-col">
      <div className="relative flex-1">
        <ScrollableContainer className="absolute inset-0 px-4 pb-4 overflow-y-auto custom-scrollbar">
          <div className="mt-0.5 flex flex-col divide-y divide-slate-800/50">
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
                    <div className="flex flex-col overflow-hidden rounded-md border border-slate-700/70">
                      <button type="button" className="bg-slate-900/40 text-slate-200 h-6 w-6 flex items-center justify-center hover:bg-slate-800/60" onClick={() => inc(i, +1)} aria-label={`Increase ${abbr}`}>
                        <IoCaretUp />
                      </button>
                      <button type="button" className="bg-slate-900/40 text-slate-200 h-6 w-6 flex items-center justify-center hover:bg-slate-800/60 border-t border-slate-700/70" onClick={() => inc(i, -1)} aria-label={`Decrease ${abbr}`}>
                        <IoCaretDown />
                      </button>
                    </div>
                    <div className="flex flex-col items-center leading-none min-w-[40px]">
                      <span
                        className={`px-1 py-0.5 rounded-md text-[9px] tabular-nums ${stage > 0 ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-700/60' : stage < 0 ? 'bg-rose-900/30 text-rose-300 border border-rose-700/60' : 'bg-slate-800/40 text-slate-300 border border-slate-700/70'}`}
                      >
                        {stage > 0 ? `+${stage}` : stage}
                      </span>
                      <span className="mt-0 text-[10px] text-slate-400">×{mult.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="ml-auto grid grid-cols-[auto_auto_auto] items-baseline gap-x-3 gap-y-0 text-[11px] geist-font pr-1">
                    <div className="text-slate-500">Base</div>
                    <div className="text-right text-slate-300 tabular-nums w-14 leading-none">{base}</div>
                    <div />
                    <div className="text-slate-500">Result</div>
                    <div className={`text-right tabular-nums w-14 leading-none ${delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-rose-300' : 'text-slate-300'}`}>{effective}</div>
                    <div className={`tabular-nums leading-none ${delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-rose-300' : 'text-slate-500'}`}>{fmtDelta(delta)}</div>
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
