import { cn } from '@/lib/utils'
import type { PokemonType } from '@/types'

// Props for the colored Type Badge
export interface TypeBadgeProps {
  type: PokemonType
  isLarge?: boolean
}

const TYPE_COLORS: Record<string, string> = {
  bug: 'bg-[#adbd21]',
  dark: 'bg-[#735a4a]',
  dragon: 'bg-[#7339ff]',
  electric: 'bg-[#efc621]',
  fairy: 'bg-[#ff94ad]',
  fighting: 'bg-[#c63129]',
  fire: 'bg-[#f78431]',
  flying: 'bg-[#ad94f7]',
  ghost: 'bg-[#735a9c]',
  grass: 'bg-[#7bce52]',
  ground: 'bg-[#e7c66b]',
  ice: 'bg-[#9cdede]',
  normal: 'bg-[#adad7b]',
  physical: 'bg-[#c63129]',
  poison: 'bg-[#a542a5]',
  psychic: 'bg-[#ff5a8c]',
  rock: 'bg-[#bda539]',
  special: 'bg-[#7339ff]',
  status: 'bg-[#adad7b]',
  steel: 'bg-[#bdbdd6]',
  water: 'bg-[#6b94f7]',
}

// Component for the colored Type Badge
export const PokemonTypeBadge: React.FC<TypeBadgeProps> = ({ type, isLarge = false }) => {
  const iconUrl = `/type-icons/${type.toLowerCase()}_t.png`
  const sizeClasses = isLarge ? 'text-[10px] pr-3' : 'text-[8px] pr-2'
  const iconSize = isLarge ? 'h-[23px] w-[23px]' : 'h-[20px] w-[20px]'

  return (
    <div className={`inline-flex gap-1 pl-1 rounded-md items-center justify-center shadow-md ${TYPE_COLORS[type.toLowerCase()]!}`}>
      <img key={type} src={iconUrl} className={cn('image-pixelate', iconSize)} />
      <div className="flex-1 flex">
        <span className={cn('text-white', sizeClasses)}>{type.toUpperCase()}</span>
      </div>
    </div>
  )
}
