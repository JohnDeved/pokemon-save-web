/**
 * TypeScript type definitions for Pokemon save file parsing
 * Port of poke_types.py with modern TypeScript features
 */

import type { PokemonData } from "./pokemonSaveParser";

// Core data structures
export interface PlayTimeData {
  hours: number;
  minutes: number;
  seconds: number;
}

export interface PokemonStats {
  readonly hp: number;
  readonly attack: number;
  readonly defense: number;
  readonly speed: number;
  readonly sp_attack: number;
  readonly sp_defense: number;
}

export interface MoveData {
  readonly id: number;
  readonly pp: number;
}

export interface PokemonMoves {
  readonly move1: MoveData;
  readonly move2: MoveData;
  readonly move3: MoveData;
  readonly move4: MoveData;
}

export interface PokemonEVs {
  readonly hp: number;
  readonly attack: number;
  readonly defense: number;
  readonly speed: number;
  readonly sp_attack: number;
  readonly sp_defense: number;
}

export interface PokemonIVs {
  readonly hp: number;
  readonly attack: number;
  readonly defense: number;
  readonly speed: number;
  readonly sp_attack: number;
  readonly sp_defense: number;
}

// Sector information
export interface SectorInfo {
  readonly id: number;
  readonly checksum: number;
  readonly counter: number;
  readonly valid: boolean;
}

// Complete save data structure
export interface SaveData {
  readonly party_pokemon: readonly PokemonData[];
  readonly player_name: string;
  readonly play_time: PlayTimeData;
  readonly active_slot: number;
  readonly sector_map: ReadonlyMap<number, number>;
  readonly rawSaveData: Uint8Array; // Add raw save data for rehydration
}

// Constants
export const CONSTANTS = {
  SECTOR_SIZE: 4096,
  SECTOR_DATA_SIZE: 3968,
  SECTOR_FOOTER_SIZE: 12,
  SAVEBLOCK1_SIZE: 3968 * 4, // SECTOR_DATA_SIZE * 4
  EMERALD_SIGNATURE: 0x08012025,
  SECTORS_PER_SLOT: 18,
  TOTAL_SECTORS: 32,
  PARTY_START_OFFSET: 0x6A8,
  PARTY_POKEMON_SIZE: 104,
  MAX_PARTY_SIZE: 6,
  POKEMON_NICKNAME_LENGTH: 10,
  POKEMON_TRAINER_NAME_LENGTH: 7,
} as const;

// Helper functions for data creation
export const createMoveData = (id: number, pp: number): MoveData => ({ id, pp });

export const createPokemonMoves = (
  move1_id: number, move2_id: number, move3_id: number, move4_id: number,
  pp1: number, pp2: number, pp3: number, pp4: number
): PokemonMoves => ({
  move1: createMoveData(move1_id, pp1),
  move2: createMoveData(move2_id, pp2),
  move3: createMoveData(move3_id, pp3),
  move4: createMoveData(move4_id, pp4),
});

export const createPokemonEVs = (
  hp: number, attack: number, defense: number,
  speed: number, sp_attack: number, sp_defense: number
): PokemonEVs => ({ hp, attack, defense, speed, sp_attack, sp_defense });

export const createPokemonIVs = (
  hp: number, attack: number, defense: number,
  speed: number, sp_attack: number, sp_defense: number
): PokemonIVs => ({ hp, attack, defense, speed, sp_attack, sp_defense });

export const createPokemonStats = (
  hp: number, attack: number, defense: number,
  speed: number, sp_attack: number, sp_defense: number
): PokemonStats => ({ hp, attack, defense, speed, sp_attack, sp_defense });

// Utility functions for working with structured data
export const pokemonEVsToArray = (evs: PokemonEVs): readonly number[] => 
  [evs.hp, evs.attack, evs.defense, evs.speed, evs.sp_attack, evs.sp_defense];

export const pokemonIVsToArray = (ivs: PokemonIVs): readonly number[] => 
  [ivs.hp, ivs.attack, ivs.defense, ivs.speed, ivs.sp_attack, ivs.sp_defense];

export const pokemonStatsToArray = (stats: PokemonStats): readonly number[] => 
  [stats.hp, stats.attack, stats.defense, stats.speed, stats.sp_attack, stats.sp_defense];

export const getTotalEVs = (evs: PokemonEVs): number => 
  evs.hp + evs.attack + evs.defense + evs.speed + evs.sp_attack + evs.sp_defense;

export const getTotalIVs = (ivs: PokemonIVs): number => 
  ivs.hp + ivs.attack + ivs.defense + ivs.speed + ivs.sp_attack + ivs.sp_defense;

export const getMoveIds = (moves: PokemonMoves): readonly number[] => 
  [moves.move1.id, moves.move2.id, moves.move3.id, moves.move4.id];

export const getPPValues = (moves: PokemonMoves): readonly number[] => 
  [moves.move1.pp, moves.move2.pp, moves.move3.pp, moves.move4.pp];
