import { z } from 'zod'
import type { PokemonBase } from './lib/parser/core/PokemonBase'

export type SpriteType = 'normal' | 'shiny'

// --- Zod schemas for API validation ---
export const PokemonTypeSchema = z.enum(['NORMAL', 'FIRE', 'WATER', 'ELECTRIC', 'GRASS', 'ICE', 'FIGHTING', 'POISON', 'GROUND', 'FLYING', 'PSYCHIC', 'BUG', 'ROCK', 'GHOST', 'DRAGON', 'DARK', 'STEEL', 'FAIRY', 'UNKNOWN'])
export type PokemonType = z.infer<typeof PokemonTypeSchema>

// --- Damage Class ---
export const DamageClassSchema = z.object({
  name: z.enum(['physical', 'special', 'status']),
  url: z.string(),
})
export type DamageClass = z.infer<typeof DamageClassSchema>

export const TargetSchema = z.object({
  name: z.string(),
  url: z.string(),
})
export type Target = z.infer<typeof TargetSchema>

// --- Move/Ability/Type API schemas ---
export const PokeApiTypeSchema = z.object({
  slot: z.number(),
  type: z.object({
    name: z.string(),
    url: z.string(),
  }),
})
export type PokeApiType = z.infer<typeof PokeApiTypeSchema>

export const PokeApiStatSchema = z.object({
  base_stat: z.number(),
  effort: z.number(),
  stat: z.object({
    name: z.string(),
    url: z.string(),
  }),
})
export type PokeApiStat = z.infer<typeof PokeApiStatSchema>

export const PokeApiAbilitySchema = z.object({
  ability: z.object({
    name: z.string(),
    url: z.string(),
  }),
  is_hidden: z.boolean(),
  slot: z.number(),
})
export type PokeApiAbility = z.infer<typeof PokeApiAbilitySchema>

export const PokeApiEffectEntrySchema = z.object({
  effect: z.string(),
  language: z.object({
    name: z.string(),
    url: z.string(),
  }),
})
export type PokeApiEffectEntry = z.infer<typeof PokeApiEffectEntrySchema>

export const PokeApiVersionGroupSchema = z.object({
  name: z.string(),
  url: z.string(),
})
export type PokeApiVersionGroup = z.infer<typeof PokeApiVersionGroupSchema>

export const PokeApiFlavorTextEntrySchema = z.object({
  flavor_text: z.string(),
  language: z.object({
    name: z.string(),
    url: z.string(),
  }),
  version_group: PokeApiVersionGroupSchema,
})
export type PokeApiFlavorTextEntry = z.infer<typeof PokeApiFlavorTextEntrySchema>

export const PokemonApiResponseSchema = z
  .object({
    types: z.array(PokeApiTypeSchema),
    stats: z.array(PokeApiStatSchema),
    abilities: z.array(PokeApiAbilitySchema),
  })
  .passthrough() // Allow additional properties
export type PokemonApiResponse = z.infer<typeof PokemonApiResponseSchema>

export const MoveApiResponseSchema = z
  .object({
    name: z.string(),
    type: z
      .object({
        name: z.string(),
      })
      .optional(),
    damage_class: DamageClassSchema.optional(),
    target: TargetSchema.optional(),
    effect_entries: z.array(PokeApiEffectEntrySchema).optional(),
    flavor_text_entries: z.array(PokeApiFlavorTextEntrySchema).optional(),
    power: z.number().nullable().optional(),
    accuracy: z.number().nullable().optional(),
    effect_chance: z.number().nullable().optional(),
  })
  .passthrough()
export type MoveApiResponse = z.infer<typeof MoveApiResponseSchema>

export const AbilityApiResponseSchema = z
  .object({
    name: z.string(),
    effect_entries: z.array(PokeApiEffectEntrySchema).optional(),
  })
  .passthrough()
export type AbilityApiResponse = z.infer<typeof AbilityApiResponseSchema>

export const ItemApiResponseSchema = z
  .object({
    name: z.string(),
    effect_entries: z.array(PokeApiEffectEntrySchema).optional(),
    // Items use `text` instead of `flavor_text` in flavor entries
    flavor_text_entries: z
      .array(
        z
          .object({
            text: z.string(),
            language: z.object({ name: z.string(), url: z.string() }),
            version_group: PokeApiVersionGroupSchema,
          })
          .passthrough()
      )
      .optional(),
  })
  .passthrough()
export type ItemApiResponse = z.infer<typeof ItemApiResponseSchema>

// --- Interfaces ---
export interface BaseMove {
  name: string
  id: number
  pp: number
}

export interface Moves {
  move1: BaseMove
  move2: BaseMove
  move3: BaseMove
  move4: BaseMove
}

export interface UIPokemonData {
  readonly id: number // UI index for React keys
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
  damageClass?: DamageClass['name']
  target?: Target['name']
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
