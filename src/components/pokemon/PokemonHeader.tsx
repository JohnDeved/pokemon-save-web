import { FaHashtag, FaWandMagicSparkles } from 'react-icons/fa6'
import { IoSparkles } from 'react-icons/io5'
import { Skeleton } from '@/components/common'
import { PokemonTypeBadge } from '@/components/pokemon/PokemonTypeBadge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useActivePokemonLoading, useMegaPreview } from '@/hooks'
import { usePokemonStore } from '@/stores'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
// Nature editing moved to Traits section's Nature tab

export const PokemonHeader: React.FC = () => {
  const isLoading = useActivePokemonLoading()
  const pokemon = usePokemonStore(s => s.partyList.find(p => p.id === s.activePokemonId))
  const { supportsMega, hasMegaForms, megaPreviewEnabled, setMegaPreviewEnabled, forms, selectedForm, setSelectedForm, statsLoading } = useMegaPreview()
  return (
    <Skeleton.LoadingProvider loading={isLoading}>
      <div className="p-3 border-b border-slate-800">
        {/* Row 1: Name (+ Mega controls) and Dex ID */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-pixel text-lg sm:text-xl text-white leading-none flex items-center gap-2">
              {pokemon?.data.nickname}
              {pokemon?.data.isShiny && (
                <Tooltip disableHoverableContent>
                  <TooltipTrigger asChild>
                    <span>
                      <IoSparkles className="text-yellow-300/80" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Shiny</TooltipContent>
                </Tooltip>
              )}
              {pokemon?.data.isRadiant && (
                <Tooltip disableHoverableContent>
                  <TooltipTrigger asChild>
                    <span>
                      <FaWandMagicSparkles className="text-purple-400/80" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Radiant</TooltipContent>
                </Tooltip>
              )}
            </h2>
            {supportsMega && hasMegaForms && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`cursor-pointer px-1.5 py-1.5 rounded-sm border text-[10px] leading-none ${megaPreviewEnabled ? 'bg-cyan-900/50 border-cyan-800 text-cyan-300' : 'bg-slate-900/30 border-slate-800 text-slate-300'}`}
                  onClick={() => setMegaPreviewEnabled(!megaPreviewEnabled)}
                  disabled={statsLoading}
                  title={megaPreviewEnabled ? 'Disable Mega Preview' : 'Enable Mega Preview'}
                >
                  {megaPreviewEnabled ? 'Mega: ON' : 'Mega: OFF'}
                </button>
                {forms && forms.length > 1 && (
                  <Select value={selectedForm} onValueChange={val => setSelectedForm(val)} disabled={!megaPreviewEnabled || statsLoading}>
                    <SelectTrigger className="h-7 w-[150px] text-xs">
                      <SelectValue placeholder="Choose Mega Form" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {forms.map(f => (
                          <SelectItem key={f.value} value={f.value} className="text-xs">
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
          <div className="bg-cyan-900/50 text-cyan-300 text-xs px-2 py-1 rounded-md flex items-center gap-1.5 border border-cyan-800">
            <FaHashtag size={12} />
            <span>{String(pokemon?.data.speciesId).padStart(3, '0')}</span>
          </div>
        </div>
        {/* Row 2: Typing */}
        <div className="flex items-center justify-between mt-2 min-h-[25px]">
          <Skeleton.Container className="flex items-center gap-2 min-w-8">
            {isLoading && <PokemonTypeBadge type="UNKNOWN" isLarge />}
            {pokemon?.details?.types.map(type => (
              <PokemonTypeBadge key={type} type={type} isLarge />
            ))}
          </Skeleton.Container>
          <div className="flex items-center gap-2 min-w-8" />
        </div>
      </div>
    </Skeleton.LoadingProvider>
  )
}
