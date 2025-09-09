import { z } from 'zod'
import type { PokemonBase } from './lib/parser/core/PokemonBase'

export type SpriteType = 'normal' | 'shiny'

// --- Zod schemas for API validation ---
export const PokemonTypeSchema = z.enum(['NORMAL', 'FIRE', 'WATER', 'ELECTRIC', 'GRASS', 'ICE', 'FIGHTING', 'POISON', 'GROUND', 'FLYING', 'PSYCHIC', 'BUG', 'ROCK', 'GHOST', 'DRAGON', 'DARK', 'STEEL', 'FAIRY', 'UNKNOWN'])
export type PokemonType = z.infer<typeof PokemonTypeSchema>

// Narrowed damage class name that UI cares about; used for icons and labels
export type DamageClassName = 'physical' | 'special' | 'status'

// --- Interfaces ---
export interface BaseMove {
  name: string
  id: number
  pp: number
}

export interface UIPokemonData {
  readonly id: number // Stable UI id (Pokemon personality)
  readonly spriteUrl: string // UI sprite URL
  readonly spriteAniUrl: string // UI animated sprite URL
  readonly data: PokemonBase
  details?: PokemonDetails // Optional, for loaded details (types, abilities, moves, baseStats)
}

export type Pokemon = UIPokemonData

export interface MoveWithDetails extends BaseMove {
  type: PokemonType
  description: string
  power: number | null
  accuracy: number | null
  damageClass?: DamageClassName
  target?: string
}

export interface Ability {
  slot: number
  name: string
  description: string
}

export interface PokemonDetails {
  types: PokemonType[]
  abilities: Ability[]
  moves: MoveWithDetails[]
  baseStats: number[]
  item?: { name: string; description: string }
}
