import { usePokemonStore } from '@/stores'
import { FaHashtag, FaWandMagicSparkles } from 'react-icons/fa6'
import { IoSparkles } from 'react-icons/io5'
import { Skeleton } from '@/components/common'
// import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PokemonTypeBadge } from '@/components/pokemon/PokemonTypeBadge'
// Nature editing moved to Traits section's Nature tab

interface PokemonHeaderProps {
  isLoading?: boolean
}

export const PokemonHeader: React.FC<PokemonHeaderProps> = ({ isLoading = false }) => {
  const { partyList, activePokemonId } = usePokemonStore()
  const pokemon = partyList.find(p => p.id === activePokemonId)
  return (
    <Skeleton.LoadingProvider loading={isLoading}>
      <div className="p-3 border-b border-slate-800">
        {/* Row 1: Name and Dex ID */}
        <div className="flex items-center justify-between">
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
          <div className="bg-cyan-900/50 text-cyan-300 text-xs px-2 py-1 rounded-md flex items-center gap-1.5 border border-cyan-800">
            <FaHashtag size={12} />
            <span>{String(pokemon?.data.speciesId).padStart(3, '0')}</span>
          </div>
        </div>
        {/* Row 2: Typing and Nature */}
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
