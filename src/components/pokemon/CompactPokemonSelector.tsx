import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Pokemon } from '../../types'
import { Card } from '../common'

interface CompactPokemonSelectorProps {
  selectedPokemon?: Pokemon
  partyList: Pokemon[]
  onSelect: (id: number) => void
  onShowFullList?: () => void
}

export const CompactPokemonSelector: React.FC<CompactPokemonSelectorProps> = ({
  selectedPokemon,
  partyList,
  onSelect,
  onShowFullList,
}) => {
  if (!selectedPokemon) {
    return null
  }

  const hpPercentage = (selectedPokemon.data.currentHp / selectedPokemon.data.maxHp) * 100
  const hpColor = hpPercentage > 50
    ? 'from-green-400 to-emerald-500'
    : hpPercentage > 20
      ? 'from-yellow-400 to-amber-500'
      : 'from-red-500 to-rose-600'

  return (
    <Card className="p-3 lg:hidden">
      {/* Currently Selected Pokemon */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 flex-shrink-0 relative">
            <img
              src={selectedPokemon.spriteAniUrl}
              className="w-full h-full object-contain [image-rendering:pixelated] drop-shadow-[2px_2px_2px_black]"
              alt={selectedPokemon.data.nickname}
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.src = selectedPokemon.spriteUrl
              }}
            />
          </div>
          <div className="flex-grow min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold truncate">{selectedPokemon.data.nickname}</h3>
              <span className="text-slate-300 text-sm ml-2">Lv.{selectedPokemon.data.level}</span>
            </div>
            <div className="w-full bg-slate-900/30 border border-slate-700 rounded-sm h-2 mt-2 overflow-hidden">
              <div
                className={cn('bg-gradient-to-r h-full transition-all duration-500', hpColor)}
                style={{ width: `${hpPercentage}%` }}
              />
            </div>
            <p className="text-right text-xs mt-1 text-slate-400">
              {selectedPokemon.data.currentHp}/{selectedPokemon.data.maxHp}
            </p>
          </div>
        </div>
        {onShowFullList && (
          <button
            onClick={onShowFullList}
            className="p-2 text-slate-400 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Show full Pokemon list"
          >
            <ChevronRight className="w-5 h-5"/>
          </button>
        )}
      </div>

      {/* Quick Selection Carousel */}
      <div className="border-t border-slate-700 pt-3">
        <p className="text-slate-400 text-xs mb-2 uppercase tracking-wide">Quick Switch</p>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {partyList.map(pokemon => {
            const isSelected = pokemon.id === selectedPokemon.id
            return (
              <button
                key={pokemon.id}
                onClick={() => onSelect(pokemon.id)}
                className={cn(
                  'flex-shrink-0 w-16 h-16 rounded-lg transition-all duration-200 overflow-hidden',
                  'border-2 cursor-pointer hover:scale-105 min-w-[44px] min-h-[44px]',
                  isSelected
                    ? 'border-cyan-400 bg-cyan-500/20 shadow-lg shadow-cyan-500/30'
                    : 'border-slate-600 hover:border-slate-500 bg-slate-800/50',
                )}
                aria-label={`Select ${pokemon.data.nickname}`}
              >
                <img
                  src={pokemon.spriteUrl}
                  className="w-full h-full object-contain [image-rendering:pixelated]"
                  alt={pokemon.data.nickname}
                />
              </button>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
