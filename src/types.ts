import { z } from 'zod';

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

export interface Pokemon {
    personality: number;
    otId: number;
    nickname: string;
    otName: string;
    currentHp: number;
    speciesId: number;
    item: number;
    move1: number;
    move2: number;
    move3: number;
    move4: number;
    pp1: number;
    pp2: number;
    pp3: number;
    pp4: number;
    hpEV: number;
    atkEV: number;
    defEV: number;
    speEV: number;
    spaEV: number;
    spdEV: number;
    ivs: number[];
    level: number;
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    spAttack: number;
    spDefense: number;
    moves: Moves;
    evs: number[];
    baseStats: number[];
    id: number;
    spriteUrl: string;
}

export interface TypeBadgeProps {
    type: PokemonType;
    isLarge?: boolean;
}

export interface PokemonStatusProps {
    pokemon: Pokemon;
    isActive: boolean;
}

export interface MoveWithDetails extends BaseMove {
    type: PokemonType;
    description: string;
    power: number | null;
    accuracy: number | null;
}

export interface MoveButtonProps {
    move: MoveWithDetails;
    isExpanded: boolean;
    opensUpward: boolean;
}

export interface StatDisplayProps {
    ivs: number[];
    evs: number[];
    baseStats: number[];
}

export interface Ability {
    name: string;
    description: string;
}

export interface PokemonDetails {
    types: PokemonType[];
    ability: Ability;
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
    type: z.object({
        name: z.string()
    }).optional(),
    effect_entries: z.array(PokeApiEffectEntrySchema).optional(),
    power: z.number().nullable().optional(),
    accuracy: z.number().nullable().optional(),
    effect_chance: z.number().optional()
}).passthrough(); // Allow additional properties

export const AbilityApiResponseSchema = z.object({
    name: z.string(),
    effect_entries: z.array(PokeApiEffectEntrySchema).optional(),
    effect_chance: z.number().optional()
}).passthrough(); // Allow additional properties
