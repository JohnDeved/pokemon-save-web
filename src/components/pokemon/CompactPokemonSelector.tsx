import { cn } from '../../lib/utils'
import { usePokemonStore } from '@/stores'
import { Card } from '../common'

interface CompactPokemonSelectorProps {}

export const CompactPokemonSelector: React.FC<CompactPokemonSelectorProps> = () => {
  const { partyList, activePokemonId, setActivePokemonId } = usePokemonStore()
  const selectedPokemon = partyList.find(p => p.id === activePokemonId)
  if (!selectedPokemon) return null

  return (
    <Card className="p-3 lg:hidden">
      <div className="flex items-center gap-3 mb-3">
        <img
          src={selectedPokemon.spriteUrl}
          className="w-12 h-12 [image-rendering:pixelated]"
          alt={selectedPokemon.data.nickname}
        />
        <div>
          <h3 className="text-white font-semibold">{selectedPokemon.data.nickname}</h3>
          <span className="text-slate-300 text-sm">Lv.{selectedPokemon.data.level}</span>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {partyList.map(pokemon => (
          <button
            key={pokemon.id}
            onClick={() => setActivePokemonId(pokemon.id)}
            className={cn(
              'flex-shrink-0 w-12 h-12 rounded border-2 transition-colors',
              pokemon.id === selectedPokemon.id
                ? 'border-cyan-400 bg-cyan-500/20'
                : 'border-slate-600 hover:border-slate-500',
            )}
          >
            <img
              src={pokemon.spriteUrl}
              className="w-full h-full [image-rendering:pixelated]"
              alt={pokemon.data.nickname}
            />
          </button>
        ))}
      </div>
    </Card>
  )
}
