import type { PokemonType } from '@/types'

// Central mapping of item id_names to the move type they boost
export const TYPE_BOOST_ITEMS: Record<string, PokemonType> = {
  // Type-boosting items
  charcoal: 'FIRE',
  magnet: 'ELECTRIC',
  'mystic-water': 'WATER',
  'miracle-seed': 'GRASS',
  'never-melt-ice': 'ICE',
  nevermeltice: 'ICE',
  'black-belt': 'FIGHTING',
  'poison-barb': 'POISON',
  'soft-sand': 'GROUND',
  'sharp-beak': 'FLYING',
  twistedspoon: 'PSYCHIC',
  'silver-powder': 'BUG',
  'hard-stone': 'ROCK',
  'spell-tag': 'GHOST',
  'dragon-fang': 'DRAGON',
  'black-glasses': 'DARK',
  'metal-coat': 'STEEL',
  'silk-scarf': 'NORMAL',
  // Plates (Arceus / general type boost)
  'flame-plate': 'FIRE',
  'splash-plate': 'WATER',
  'zap-plate': 'ELECTRIC',
  'meadow-plate': 'GRASS',
  'icicle-plate': 'ICE',
  'fist-plate': 'FIGHTING',
  'toxic-plate': 'POISON',
  'earth-plate': 'GROUND',
  'sky-plate': 'FLYING',
  'mind-plate': 'PSYCHIC',
  'insect-plate': 'BUG',
  'stone-plate': 'ROCK',
  'spooky-plate': 'GHOST',
  'draco-plate': 'DRAGON',
  'dread-plate': 'DARK',
  'iron-plate': 'STEEL',
  'pixie-plate': 'FAIRY',
  // Incense variants that boost move types
  'sea-incense': 'WATER',
  'wave-incense': 'WATER',
  'rose-incense': 'GRASS',
  'odd-incense': 'PSYCHIC',
  'rock-incense': 'ROCK',
}

// Per request: use +20% for boosting items
export const TYPE_BOOST_MULTIPLIER = 1.2

export function getTypeBoostMultiplier(itemIdName: string | undefined | null, moveType: PokemonType): number {
  if (!itemIdName) return 1
  const boostedType = TYPE_BOOST_ITEMS[itemIdName.toLowerCase()]
  if (boostedType && boostedType === moveType) return TYPE_BOOST_MULTIPLIER
  return 1
}
