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
    type: string;
    isLarge?: boolean;
}

export interface PokemonStatusProps {
    pokemon: Pokemon;
    isActive: boolean;
}

export interface MoveWithDetails extends BaseMove {
    type: string;
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
    types: string[];
    ability: Ability;
    moves: MoveWithDetails[];
    baseStats: number[];
}

export interface DetailedCache {
    [speciesId: number]: PokemonDetails;
}

export interface PokeApiAbility {
    ability: {
        name: string;
        url: string;
    };
    is_hidden: boolean;
    slot: number;
}

export interface PokeApiType {
    slot: number;
    type: {
        name: string;
        url: string;
    };
}

export interface PokeApiStat {
    base_stat: number;
    effort: number;
    stat: {
        name: string;
        url: string;
    };
}

export interface PokeApiEffectEntry {
    effect: string;
    language: {
        name: string;
        url: string;
    };
}
