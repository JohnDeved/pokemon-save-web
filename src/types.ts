import { z } from 'zod';
import type { PokemonData } from './lib/parser/pokemonSaveParser';

// Zod schemas for runtime validation
export const PokemonTypeSchema = z.enum([
    'NORMAL', 'FIRE', 'WATER', 'ELECTRIC', 'GRASS', 'ICE', 
    'FIGHTING', 'POISON', 'GROUND', 'FLYING', 'PSYCHIC', 'BUG', 
    'ROCK', 'GHOST', 'DRAGON', 'DARK', 'STEEL', 'FAIRY', 'UNKNOWN'
]);

export type PokemonType = z.infer<typeof PokemonTypeSchema>;

// Strong typing for Pokemon stats
export type StatName = 'hp' | 'attack' | 'defense' | 'speed' | 'special-attack' | 'special-defense';

export interface BaseMove {
    name: string;
    id: number;
    pp: number;
}

export interface Moves {
    move1: BaseMove;
    move2: BaseMove;
    move3: BaseMove;
    move4: BaseMove;
}

export interface UIPokemonData {
  readonly id: number;        // UI index for React keys
  readonly spriteUrl: string; // UI sprite URL
  readonly baseStats: readonly number[];
  readonly movesWithDetails: MoveWithDetails[]; // Optional, for detailed move info
  readonly data: PokemonData;
}

export type Pokemon = UIPokemonData;

export interface MoveWithDetails extends BaseMove {
    type: PokemonType;
    description: string;
    power: number | null;
    accuracy: number | null;
}

export interface Ability {
    slot: number;
    name: string;
    description: string;
}

export interface PokemonDetails {
    types: PokemonType[];
    abilities: Ability[];
    moves: MoveWithDetails[];
    baseStats: number[];
}

export interface DetailedCache {
    [speciesId: number]: PokemonDetails;
}

// Zod schemas for API validation
export const PokeApiTypeSchema = z.object({
    slot: z.number(),
    type: z.object({
        name: z.string(),
        url: z.string()
    })
});

export const PokeApiStatSchema = z.object({
    base_stat: z.number(),
    effort: z.number(),
    stat: z.object({
        name: z.string(),
        url: z.string()
    })
});

export const PokeApiAbilitySchema = z.object({
    ability: z.object({
        name: z.string(),
        url: z.string()
    }),
    is_hidden: z.boolean(),
    slot: z.number()
});

export const PokeApiEffectEntrySchema = z.object({
    effect: z.string(),
    language: z.object({
        name: z.string(),
        url: z.string()
    })
});

export const PokemonApiResponseSchema = z.object({
    types: z.array(PokeApiTypeSchema),
    stats: z.array(PokeApiStatSchema),
    abilities: z.array(PokeApiAbilitySchema)
}).passthrough(); // Allow additional properties

export const MoveApiResponseSchema = z.object({
    name: z.string(),
    type: z.object({
        name: z.string()
    }).optional(),
    effect_entries: z.array(PokeApiEffectEntrySchema).optional(),
    power: z.number().nullable().optional(),
    accuracy: z.number().nullable().optional(),
    effect_chance: z.number().nullable().optional()
}).passthrough(); // Allow additional properties

export const AbilityApiResponseSchema = z.object({
    name: z.string(),
    effect_entries: z.array(PokeApiEffectEntrySchema).optional(),
    effect_chance: z.number().nullable().optional()
}).passthrough(); // Allow additional properties
