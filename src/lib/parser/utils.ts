/**
 * Integration utilities for Pokemon Save Parser
 * Converts parsed save data to formats expected by the existing app
 */

import charmapData from './pokemon_charmap.json';

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


export default {
  formatPlayTime,
  getPokemonNature,
};
