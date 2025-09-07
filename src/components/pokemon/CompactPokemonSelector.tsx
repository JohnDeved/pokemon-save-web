import { cn } from '@/lib/utils'
import { usePokemonStore } from '@/stores'
import { Card } from '@/components/common'
import { useMegaPreview } from '@/hooks'

export const CompactPokemonSelector: React.FC = () => {
  const partyList = usePokemonStore(s => s.partyList)
  const activePokemonId = usePokemonStore(s => s.activePokemonId)
  const setActivePokemonId = usePokemonStore(s => s.setActivePokemonId)
  const { megaPreviewEnabled, megaSpriteAniUrl, megaSpritePngUrl } = useMegaPreview()
  const selectedPokemon = partyList.find(p => p.id === activePokemonId)
  if (!selectedPokemon) return null

  return (
    <Card className="p-3 lg:hidden">
      <div className="flex items-center gap-3 mb-3">
        <img
          src={megaPreviewEnabled && megaSpriteAniUrl ? megaSpriteAniUrl : selectedPokemon.spriteUrl}
          onError={e => {
            const img = e.currentTarget
            if (img.dataset.fallbackApplied === '1') return
            if (megaPreviewEnabled && megaSpritePngUrl) {
              img.dataset.fallbackApplied = '1'
              img.src = megaSpritePngUrl
            }
          }}
          className="w-12 h-12 [image-rendering:pixelated]"
          alt={selectedPokemon.data.nickname}
        />
        <div>
          <h3 className="text-white font-semibold">{selectedPokemon.data.nickname}</h3>
          <span className="text-zinc-300 text-sm">Lv.{selectedPokemon.data.level}</span>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {partyList.map(pokemon => (
          <button key={pokemon.id} onClick={() => setActivePokemonId(pokemon.id)} className={cn('flex-shrink-0 w-12 h-12 rounded border-2 transition-colors', pokemon.id === selectedPokemon.id ? 'border-cyan-400 bg-cyan-500/20' : 'border-zinc-600 hover:border-zinc-500')}>
            <img
              src={pokemon.id === selectedPokemon.id && megaPreviewEnabled && megaSpriteAniUrl ? megaSpriteAniUrl : pokemon.spriteUrl}
              onError={e => {
                const img = e.currentTarget
                if (img.dataset.fallbackApplied === '1') return
                if (pokemon.id === selectedPokemon.id && megaPreviewEnabled && megaSpritePngUrl) {
                  img.dataset.fallbackApplied = '1'
                  img.src = megaSpritePngUrl
                }
              }}
              className="w-full h-full [image-rendering:pixelated]"
              alt={pokemon.data.nickname}
            />
          </button>
        ))}
      </div>
    </Card>
  )
}
