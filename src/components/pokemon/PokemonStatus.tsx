import React from 'react'
import { cn } from '../../lib/utils'
import type { Pokemon } from '../../types'
import { Card } from '../common'

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
  const [staticFrameSrc, setStaticFrameSrc] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    // Reset state if the URL changes
    setIsLoading(true)
    setStaticFrameSrc(null)

    if (!gifUrl) {
      setIsLoading(false)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
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
    }

    img.onerror = () => {
      console.error('Failed to load GIF for processing.')
      setStaticFrameSrc(gifUrl) // Fallback to original on error
      setIsLoading(false)
    }

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
}> = ({ src, fallbackSrc, alt, paused }) => {
  // Determine if the src is a GIF
  const isGif = src && src.toLowerCase().endsWith('.gif')
  // Use the useGifFrame hook only for GIFs
  const { staticFrameSrc } = useGifFrame(isGif ? src : '')
  // If paused and GIF, show static frame; else show src
  const displaySrc = paused && isGif && staticFrameSrc ? staticFrameSrc : src
  const [imgSrc, setImgSrc] = React.useState(displaySrc)
  React.useEffect(() => setImgSrc(displaySrc), [displaySrc])
  const handleError = () => setImgSrc(fallbackSrc)

  return (
    <div className="w-20 h-20 flex-shrink-0 mr-2 flex items-center justify-center relative">
      {/* Blurred background image, not upscaled */}
      <img
        src={imgSrc}
        className={cn(
          'absolute z-0 opacity-40 blur-md object-contain',
          '[image-rendering:pixelated]',
          'max-w-[96px] max-h-[96px]',
        )}
        onError={handleError}
        aria-hidden="true"
      />
      {/* Main sprite image, not upscaled */}
      <img
        src={imgSrc}
        className={cn(
          'z-10 object-contain transition-transform duration-300',
          '[image-rendering:pixelated]',
          'max-w-[96px] max-h-[96px]',
        )}
        onError={handleError}
        alt={alt}
      />
    </div>
  )
}

// Component for a single Pokémon's status display on the left
export const PokemonStatus: React.FC<PokemonStatusProps> = ({ pokemon, isActive }) => {
  const hpPercentage = (pokemon.data.currentHp / pokemon.data.maxHp) * 100
  const hpColor = hpPercentage > HP_THRESHOLDS.HIGH
    ? 'from-green-400 to-emerald-500'
    : hpPercentage > HP_THRESHOLDS.LOW
      ? 'from-yellow-400 to-amber-500'
      : 'from-red-500 to-rose-600'

  const containerClasses = isActive
    ? 'bg-slate-800/80 ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/30'
    : 'hover:bg-slate-800/80'

  return (
    <Card className={cn('flex items-center p-3 transition-all duration-300', containerClasses)}>
      <PokemonSprite
        src={pokemon.spriteAniUrl}
        fallbackSrc={pokemon.spriteUrl}
        alt={pokemon.data.nickname}
        paused={!isActive}
      />
      <div className="flex-grow">
        <div className="flex justify-between items-center text-sm">
          <h3 className="text-white">{pokemon.data.nickname}</h3>
          <span className="text-slate-300">Lv.{pokemon.data.level}</span>
        </div>
        <div className="w-full bg-slate-900/30 border border-slate-700 border-x-2 rounded-sm h-2.5 mt-2 overflow-hidden">
          <div className={cn('bg-gradient-to-r h-full transition-all duration-500', hpColor)} style={{ width: `${hpPercentage}%` }}/>
        </div>
        <p className="text-right text-xs mt-1 text-slate-400">{pokemon.data.currentHp}/{pokemon.data.maxHp}</p>
      </div>
    </Card>
  )
}
