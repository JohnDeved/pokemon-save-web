import { z } from 'zod'
import type { PokemonBase } from './lib/parser/core/PokemonBase'

export type SpriteType = 'normal' | 'shiny'

// --- Zod schemas for API validation ---
export const PokemonTypeSchema = z.enum([
  'NORMAL',
  'FIRE',
  'WATER',
  'ELECTRIC',
  'GRASS',
  'ICE',
  'FIGHTING',
  'POISON',
  'GROUND',
  'FLYING',
  'PSYCHIC',
  'BUG',
  'ROCK',
  'GHOST',
  'DRAGON',
  'DARK',
  'STEEL',
  'FAIRY',
  'UNKNOWN',
])
export type PokemonType = z.infer<typeof PokemonTypeSchema>

// Narrowed damage class name that UI cares about; used for icons and labels
export const DamageClassNameSchema = z.enum(['physical', 'special', 'status'])
export type DamageClassName = z.infer<typeof DamageClassNameSchema>

// --- Interfaces ---
export const BaseMoveSchema = z.object({
  name: z.string(),
  id: z.number(),
  pp: z.number(),
})
export type BaseMove = z.infer<typeof BaseMoveSchema>

export const MovesSchema = z.object({
  move1: BaseMoveSchema,
  move2: BaseMoveSchema,
  move3: BaseMoveSchema,
  move4: BaseMoveSchema,
})
export type Moves = z.infer<typeof MovesSchema>

export interface UIPokemonData {
  readonly id: number // Stable UI id (Pokemon personality)
  readonly spriteUrl: string // UI sprite URL
  readonly spriteAniUrl: string // UI animated sprite URL
  readonly data: PokemonBase
  details?: PokemonDetails // Optional, for loaded details (types, abilities, moves, baseStats)
}

export type Pokemon = UIPokemonData

export const MoveWithDetailsSchema = BaseMoveSchema.extend({
  type: PokemonTypeSchema,
  description: z.string(),
  power: z.number().nullable(),
  accuracy: z.number().nullable(),
  damageClass: DamageClassNameSchema.optional(),
  target: z.string().optional(),
})
export type MoveWithDetails = z.infer<typeof MoveWithDetailsSchema>

export const AbilitySchema = z.object({
  slot: z.number(),
  name: z.string(),
  description: z.string(),
})
export type Ability = z.infer<typeof AbilitySchema>

export const PokemonDetailsSchema = z.object({
  types: z.array(PokemonTypeSchema),
  abilities: z.array(AbilitySchema),
  moves: z.array(MoveWithDetailsSchema),
  baseStats: z.array(z.number()),
  item: z
    .object({
      name: z.string(),
      description: z.string(),
    })
    .optional(),
})
export type PokemonDetails = z.infer<typeof PokemonDetailsSchema>
