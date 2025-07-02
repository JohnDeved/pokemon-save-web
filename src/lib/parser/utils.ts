/**
 * Integration utilities for Pokemon Save Parser
 * Converts parsed save data to formats expected by the existing app
 */

import charmapData from './pokemon_charmap.json';
import { PokemonData } from './pokemonSaveParser';

// Convert charmap keys from strings to numbers for faster lookup
const charmap: { [key: number]: string } = {};
for (const [key, value] of Object.entries(charmapData)) {
  charmap[parseInt(key, 10)] = value;
}

/**
 * Convert byte array to string using Pokemon GBA character encoding
 * Uses the external charmap.json for accurate character conversion
 * See: https://bulbapedia.bulbagarden.net/wiki/Character_encoding_in_Generation_III
 */
export function bytesToGbaString(bytes: Uint8Array): string {
  let result = '';
  
  // Pokemon strings are fixed-length fields padded with 0xFF bytes at the end
  // We need to find the end of the actual string content by looking for trailing 0xFF bytes
  let endIndex = bytes.length;
  
  // Find the last non-0xFF byte to determine actual string length
  for (let i = bytes.length - 1; i >= 0; i--) {
    if (bytes[i] !== 0xFF) {
      endIndex = i + 1;
      break;
    }
  }
  
  // Process only the actual string content (before padding)
  for (let i = 0; i < endIndex; i++) {
    const byte = bytes[i];
    
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

export const natures = [
  'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty',
  'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
  'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive',
  'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
  'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky'
] as const;
/**
 * Get Pokemon nature from the first byte of the personality value
 * Pokemon nature is determined by (personality & 0xFF) % 25
 */
export function getPokemonNature(personality: number): string {

  // Use only the first byte of the personality value
  return natures[(personality & 0xFF) % 25];
}

export const natureEffects: { [key: string]: { increased: number, decreased: number } } = {
  'Lonely': { increased: 1, decreased: 2 }, 'Brave': { increased: 1, decreased: 3 }, 'Adamant': { increased: 1, decreased: 4 }, 'Naughty': { increased: 1, decreased: 5 },
  'Bold': { increased: 2, decreased: 1 }, 'Relaxed': { increased: 2, decreased: 3 }, 'Impish': { increased: 2, decreased: 4 }, 'Lax': { increased: 2, decreased: 5 },
  'Timid': { increased: 3, decreased: 1 }, 'Hasty': { increased: 3, decreased: 2 }, 'Jolly': { increased: 3, decreased: 4 }, 'Naive': { increased: 3, decreased: 5 },
  'Modest': { increased: 4, decreased: 1 }, 'Mild': { increased: 4, decreased: 2 }, 'Quiet': { increased: 4, decreased: 3 }, 'Rash': { increased: 4, decreased: 5 },
  'Calm': { increased: 5, decreased: 1 }, 'Gentle': { increased: 5, decreased: 2 }, 'Sassy': { increased: 5, decreased: 3 }, 'Careful': { increased: 5, decreased: 4 },
};
/**
 * Get nature modifier for a given stat
 * @param nature The Pokemon's nature
 * @param statIndex The index of the stat (0: HP, 1: Atk, 2: Def, 3: Spe, 4: SpA, 5: SpD)
 * @returns The stat modifier (1.1, 0.9, or 1.0)
 */
export function getNatureModifier(nature: string, statIndex: number): number {

  const effect = natureEffects[nature];
  if (effect) {
    if (statIndex === effect.increased) return 1.1;
    if (statIndex === effect.decreased) return 0.9;
  }
  return 1.0;
}

/**
 * Calculate total stats based on base stats, IVs, EVs, level, and nature
 * @param pokemon The Pokemon data object
 * @param baseStats The array of base stats in the order: HP, Atk, Def, Spe, SpA, SpD
 * @returns An array of calculated total stats
 */
export function calculateTotalStats(pokemon: PokemonData, baseStats: number[]): number[] {
  const { level, ivs, evs, nature } = pokemon;

  // HP calculation
  const hp = Math.floor(((2 * baseStats[0] + ivs[0] + Math.floor(evs[0] / 4)) * level) / 100) + level + 10;

  // Stat order: [HP, Atk, Def, Spe, SpA, SpD]
  // Calculate non-HP stats (Atk, Def, Spe, SpA, SpD)
  const statIndices = [1, 2, 3, 4, 5];
  const otherStats = statIndices.map((i) => {
    const base = baseStats[i];
    const iv = ivs[i];
    const ev = evs[i];
    const natureMod = getNatureModifier(nature, i);
    const stat = Math.floor((Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5) * natureMod);
    return stat;
  });

  // Return in order: HP, Atk, Def, Spe, SpA, SpD
  return [hp, ...otherStats];
}


export default {
  formatPlayTime,
  getPokemonNature,
  calculateTotalStats,
};
