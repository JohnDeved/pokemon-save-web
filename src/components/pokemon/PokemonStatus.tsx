import { useEffect, useState } from 'react'
import { Card } from '@/components/common'
import { getItemSpriteUrl } from '@/lib/parser/core/utils'
import { cn } from '@/lib/utils'
import type { Pokemon } from '@/types'
import { useMegaPreview } from '@/hooks'

// Health percentage thresholds for color coding
const HP_THRESHOLDS = {
  HIGH: 50,
  LOW: 20,
} as const

// Props for PokemonStatus
export interface PokemonStatusProps {
  pokemon: Pokemon
  isActive: boolean
}

const useGifFrame = (gifUrl: string) => {
  const [staticFrameSrc, setStaticFrameSrc] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Reset state if the URL changes
    setIsLoading(true)
    setStaticFrameSrc(null)

    if (!gifUrl) {
      setIsLoading(false)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.addEventListener('load', () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const context = canvas.getContext('2d')
      if (context) {
        context.drawImage(img, 0, 0)
        setStaticFrameSrc(canvas.toDataURL('image/png'))
      } else {
        setStaticFrameSrc(gifUrl) // fallback if context is null
      }
      setIsLoading(false)
    })

    img.addEventListener('error', () => {
      console.error('Failed to load GIF for processing.')
      setStaticFrameSrc(gifUrl) // Fallback to original on error
      setIsLoading(false)
    })

    img.src = gifUrl
  }, [gifUrl]) // Re-run the effect if the gifUrl changes.

  return { staticFrameSrc, isLoading }
}

// Sprite display component
const PokemonSprite: React.FC<{
  src: string
  fallbackSrc: string
  alt?: string
  paused?: boolean
  children?: React.ReactNode
}> = ({ src, fallbackSrc, alt, paused, children }) => {
  // Determine if the src is a GIF
  const isGif = src && src.toLowerCase().endsWith('.gif')
  // Use the useGifFrame hook only for GIFs
  const { staticFrameSrc } = useGifFrame(isGif ? src : '')
  // If paused and GIF, show static frame; else show src
  const displaySrc = paused && isGif && staticFrameSrc ? staticFrameSrc : src
  const [imgSrc, setImgSrc] = useState(displaySrc)
  useEffect(() => setImgSrc(displaySrc), [displaySrc])
  const handleError = () => setImgSrc(fallbackSrc)

  return (
    <div className="w-20 h-20 flex-shrink-0 mr-2 flex items-center justify-center relative select-none">
      {/* Blurred background image, not upscaled */}
      <img src={imgSrc} className={cn('absolute z-0 opacity-80 blur-md object-contain', '[image-rendering:pixelated]', 'max-w-[96px] max-h-[96px]')} onError={handleError} aria-hidden="true" draggable={false} onDragStart={e => e.preventDefault()} />
      {/* Main sprite image, not upscaled */}
      <img src={imgSrc} className={cn('z-10 object-contain transition-transform duration-300', '[image-rendering:pixelated]', 'max-w-[96px] max-h-[96px]', 'drop-shadow-[2px_2px_2px_black]')} onError={handleError} alt={alt} draggable={false} onDragStart={e => e.preventDefault()} />
      {children}
    </div>
  )
}

// Component for a single Pokémon's status display on the left
export const PokemonStatus: React.FC<PokemonStatusProps> = ({ pokemon, isActive }) => {
  const hpPercentage = (pokemon.data.currentHp / pokemon.data.maxHp) * 100
  const { megaPreviewEnabled, megaSpriteAniUrl, megaSpritePngUrl } = useMegaPreview()

  // Fix nested ternary
  let hpColor: string
  if (hpPercentage > HP_THRESHOLDS.HIGH) {
    hpColor = 'from-green-400 to-emerald-500'
  } else if (hpPercentage > HP_THRESHOLDS.LOW) {
    hpColor = 'from-yellow-400 to-amber-500'
  } else {
    hpColor = 'from-red-500 to-rose-600'
  }

  const containerClasses = isActive ? 'bg-card/80 ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/30' : 'hover:bg-card/80'

  return (
    <Card className={cn('flex items-center p-3 transition-all duration-300', containerClasses)}>
      <PokemonSprite src={isActive && megaPreviewEnabled && megaSpriteAniUrl ? megaSpriteAniUrl : pokemon.spriteAniUrl} fallbackSrc={isActive && megaPreviewEnabled && megaSpritePngUrl ? megaSpritePngUrl : pokemon.spriteUrl} alt={pokemon.data.nickname} paused={!isActive}>
        <img
          src={pokemon.data.itemIdName ? getItemSpriteUrl(pokemon.data.itemIdName) : '/pokemon_item_placeholder_32x32.png'}
          alt={pokemon.data.itemIdName ?? 'No item'}
          className="absolute bottom-0 right-0 z-20 w-5 h-5 rounded-sm border border-border shadow-md image-pixelate bg-card/80 select-none"
          draggable={false}
          onDragStart={e => e.preventDefault()}
          onError={e => {
            const img = e.currentTarget
            if (img.dataset.fallbackApplied === '1') return
            img.dataset.fallbackApplied = '1'
            img.src = '/pokemon_item_placeholder_32x32.png'
          }}
        />
      </PokemonSprite>
      <div className="flex-grow">
        <div className="flex justify-between items-center text-sm">
          <h3 className="text-foreground">{pokemon.data.nickname}</h3>
          <span className="text-muted-foreground">Lv.{pokemon.data.level}</span>
        </div>
        <div className="w-full bg-background/30 border border-border border-x-2 rounded-sm h-2.5 mt-2 overflow-hidden">
          <div className={cn('bg-gradient-to-r h-full transition-all duration-500', hpColor)} style={{ width: `${hpPercentage}%` }} />
        </div>
        <p className="text-right text-xs mt-1 text-muted-foreground">
          {pokemon.data.currentHp}/{pokemon.data.maxHp}
        </p>
      </div>
    </Card>
  )
}
