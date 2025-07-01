/**
 * Integration utilities for Pokemon Save Parser
 * Converts parsed save data to formats expected by the existing app
 */

import type { Pokemon } from '../../types.js';
import type { ParsedPokemonData } from './types.js';
import { getMoveIds, getPPValues } from './types.js';
import charmapData from './pokemon_charmap.json';

// Convert charmap keys from strings to numbers for faster lookup
const charmap: { [key: number]: string } = {};
for (const [key, value] of Object.entries(charmapData)) {
  charmap[parseInt(key, 10)] = value;
}

/**
 * Convert parsed Pokemon data to the format expected by the existing app
 */
export function convertParsedPokemonToAppFormat(pokemon: ParsedPokemonData): Omit<Pokemon, 'moves' | 'baseStats' | 'id' | 'spriteUrl'> {
  const moveIds = getMoveIds(pokemon.moves_data);
  const ppValues = getPPValues(pokemon.moves_data);

  return {
    personality: pokemon.personality,
    otId: pokemon.otId,
    nickname: bytesToString(pokemon.nickname),
    otName: bytesToString(pokemon.otName),
    currentHp: pokemon.currentHp,
    speciesId: pokemon.speciesId,
    item: pokemon.item,
    move1: moveIds[0],
    move2: moveIds[1],
    move3: moveIds[2],
    move4: moveIds[3],
    pp1: ppValues[0],
    pp2: ppValues[1],
    pp3: ppValues[2],
    pp4: ppValues[3],
    hpEV: pokemon.hpEV,
    atkEV: pokemon.atkEV,
    defEV: pokemon.defEV,
    speEV: pokemon.speEV,
    spaEV: pokemon.spaEV,
    spdEV: pokemon.spdEV,
    ivs: [...pokemon.ivs],
    level: pokemon.level,
    maxHp: pokemon.maxHp,
    attack: pokemon.attack,
    defense: pokemon.defense,
    speed: pokemon.speed,
    spAttack: pokemon.spAttack,
    spDefense: pokemon.spDefense,
    evs: [...pokemon.evs],
  };
}

/**
 * Convert byte array to string using Pokemon GBA character encoding
 * Uses the external charmap.json for accurate character conversion
 * See: https://bulbapedia.bulbagarden.net/wiki/Character_encoding_in_Generation_III
 */
function bytesToString(bytes: Uint8Array): string {
  let result = '';
  for (const byte of bytes) {
    // Check for string terminators
    if (byte === 0x00 || byte === 0xFF) break;
    
    // Look up character in charmap
    const char = charmap[byte];
    if (char !== undefined) {
      // Handle special control characters
      if (char === '\\n') {
        result += '\n';
      } else if (char === '\\l' || char === '\\p') {
        // Skip line break and page break control codes
        continue;
      } else {
        result += char;
      }
    }
    // If character not found in charmap, skip it (could log for debugging)
  }
  return result.trim();
}

/**
 * Format play time as a human-readable string
 */
export function formatPlayTime(hours: number, minutes: number, seconds: number): string {
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Get Pokemon nature from personality value
 * Pokemon nature is determined by personality % 25
 */
export function getPokemonNature(personality: number): string {
  const natures = [
    'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty',
    'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
    'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive',
    'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
    'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky'
  ];
  
  return natures[personality % 25];
}

/**
 * Check if Pokemon is shiny based on personality and OT ID
 */
export function isPokemonShiny(personality: number, otId: number): boolean {
  const trainerId = otId & 0xFFFF;
  const secretId = (otId >>> 16) & 0xFFFF;
  
  const p1 = personality & 0xFFFF;
  const p2 = (personality >>> 16) & 0xFFFF;
  
  return (trainerId ^ secretId ^ p1 ^ p2) < 8;
}

/**
 * Calculate Pokemon's stats based on level, IVs, EVs, and base stats
 * This is a simplified calculation - the actual formula involves more factors
 */
export function calculateStat(
  baseStat: number,
  iv: number,
  ev: number,
  level: number,
  isHp = false,
  natureModifier = 1.0
): number {
  if (isHp) {
    // HP calculation is different
    return Math.floor(((baseStat + iv) * 2 + Math.floor(ev / 4)) * level / 100) + level + 10;
  } else {
    // Other stats calculation
    const base = Math.floor(((baseStat + iv) * 2 + Math.floor(ev / 4)) * level / 100) + 5;
    return Math.floor(base * natureModifier);
  }
}

/**
 * Validate that parsed data looks correct
 */
export function validateParsedData(pokemon: ParsedPokemonData): boolean {
  // Basic validation checks
  if (pokemon.speciesId <= 0 || pokemon.speciesId > 493) { // Gen 4 max
    return false;
  }
  
  if (pokemon.level <= 0 || pokemon.level > 100) {
    return false;
  }
  
  // Check if EVs are within valid range (0-255 each, 510 total max in newer games)
  const totalEvs = pokemon.evs.reduce((sum, ev) => sum + ev, 0);
  if (totalEvs > 510) {
    return false;
  }
  
  // Check if IVs are within valid range (0-31 each)
  if (pokemon.ivs.some(iv => iv < 0 || iv > 31)) {
    return false;
  }
  
  return true;
}

export default {
  convertParsedPokemonToAppFormat,
  formatPlayTime,
  getPokemonNature,
  isPokemonShiny,
  calculateStat,
  validateParsedData,
};
