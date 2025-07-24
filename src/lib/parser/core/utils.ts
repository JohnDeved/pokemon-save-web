/**
 * Integration utilities for Pokemon Save Parser
 * Converts parsed save data to formats expected by the existing app
 */

import charmapData from '../data/pokemon_charmap.json'
import type { PokemonDataInterface } from '../configs/GameConfig.js'

// Legacy exports for backward compatibility - these functions now require GameConfig to be passed
// For new code, use the mapping functions directly from PokemonDataInterface class

// make the mappings more type-safe by using string keys

// Legacy functions - deprecated, use GameConfig mappings instead
export function mapSpeciesToPokeId (speciesId: number): number {
  console.warn('mapSpeciesToPokeId is deprecated. Use GameConfig mappings directly.')
  return speciesId
}

export function mapSpeciesToNameId (_speciesId: number): string | undefined {
  console.warn('mapSpeciesToNameId is deprecated. Use GameConfig mappings directly.')
  return undefined
}

export function mapMoveToPokeId (moveId: number): number {
  console.warn('mapMoveToPokeId is deprecated. Use GameConfig mappings directly.')
  return moveId
}

export function mapItemToPokeId (itemId: number): number {
  console.warn('mapItemToPokeId is deprecated. Use GameConfig mappings directly.')
  return itemId
}

export function mapItemToNameId (_itemId: number): string | undefined {
  console.warn('mapItemToNameId is deprecated. Use GameConfig mappings directly.')
  return undefined
}

export function getItemSpriteUrl (itemIdName: string): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${itemIdName}.png`
}

// Convert charmap keys from strings to numbers for faster lookup
const charmap: Record<number, string> = {}
for (const [key, value] of Object.entries(charmapData)) {
  charmap[parseInt(key, 10)] = value
}

/**
 * Convert byte array to string using Pokemon GBA character encoding
 * Uses the external charmap.json for accurate character conversion
 * See: https://bulbapedia.bulbagarden.net/wiki/Character_encoding_in_Generation_III
 */
export function bytesToGbaString (bytes: Uint8Array): string {
  let result = ''

  // Pokemon strings are fixed-length fields padded with 0xFF bytes at the end
  // We need to find the end of the actual string content by looking for trailing 0xFF bytes
  let endIndex = bytes.length

  // Find the last non-0xFF byte to determine actual string length
  for (let i = bytes.length - 1; i >= 0; i--) {
    if (bytes[i] !== 0xFF) {
      endIndex = i + 1
      break
    }
  }

  // Process only the actual string content (before padding)
  for (let i = 0; i < endIndex; i++) {
    const byte = bytes[i]!

    // Look up character in charmap
    const char = charmap[byte]
    if (char === undefined) {
      // If character not found in charmap, skip it (could log for debugging)
      continue
    }
    // Handle special control characters
    if (char === '\\n') {
      result += '\n'
    } else if (char === '\\l' || char === '\\p') {
      // Skip line break and page break control codes
      continue
    } else {
      result += char
    }
  }

  return result.trim()
}

/**
 * Convert a string to a byte array using Pokemon GBA character encoding
 * Uses the external charmap.json for accurate character conversion
 * Pads with 0xFF to the specified length (default 10)
 * @param str The string to encode
 * @param length The fixed length of the output array (default 10)
 * @returns Uint8Array of encoded bytes
 */
export function gbaStringToBytes (str: string, length = 10): Uint8Array {
  // Build a reverse charmap: char -> byte
  const reverseCharmap: Record<string, number> = {}
  for (const [key, value] of Object.entries(charmap)) {
    reverseCharmap[value] = Number(key)
  }
  const bytes = new Uint8Array(length).fill(0xFF)
  let i = 0
  for (const char of str) {
    if (i >= length) break
    // Find the byte for this character
    const byte = reverseCharmap[char]
    if (typeof byte !== 'undefined') {
      bytes[i++] = byte
    } else {
      // If not found, use 0x00 (could also skip or use a placeholder)
      bytes[i++] = 0x00
    }
  }
  return bytes
}

/**
 * Format play time as a human-readable string
 */
export function formatPlayTime (hours: number, minutes: number, seconds: number): string {
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export const statStrings: string[] = [
  'HP', 'Attack', 'Defense', 'Speed', 'Special Attack', 'Special Defense',
]

export const natures = [
  'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty',
  'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
  'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive',
  'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
  'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky',
]
/**
 * Get Pokemon nature from the first byte of the personality value
 * Pokemon nature is determined by (personality & 0xFF) % 25
 */
export function getPokemonNature (personality: number): string {
  // Use only the first byte of the personality value
  return natures[(personality & 0xFF) % 25]!
}

export function setPokemonNature (pokemon: PokemonDataInterface, nature: string): void {
  // Find the index of the nature in the natures array
  const natureIndex = natures.indexOf(nature)
  if (natureIndex === -1) {
    throw new Error(`Invalid nature: ${nature}`)
  }

  // Calculate the new personality value
  pokemon.setNatureRaw(natureIndex)
}

export const natureEffects: Record<string, { increased: number, decreased: number }> = {
  Lonely: { increased: 1, decreased: 2 },
  Brave: { increased: 1, decreased: 3 },
  Adamant: { increased: 1, decreased: 4 },
  Naughty: { increased: 1, decreased: 5 },
  Bold: { increased: 2, decreased: 1 },
  Relaxed: { increased: 2, decreased: 3 },
  Impish: { increased: 2, decreased: 4 },
  Lax: { increased: 2, decreased: 5 },
  Timid: { increased: 3, decreased: 1 },
  Hasty: { increased: 3, decreased: 2 },
  Jolly: { increased: 3, decreased: 4 },
  Naive: { increased: 3, decreased: 5 },
  Modest: { increased: 4, decreased: 1 },
  Mild: { increased: 4, decreased: 2 },
  Quiet: { increased: 4, decreased: 3 },
  Rash: { increased: 4, decreased: 5 },
  Calm: { increased: 5, decreased: 1 },
  Gentle: { increased: 5, decreased: 2 },
  Sassy: { increased: 5, decreased: 3 },
  Careful: { increased: 5, decreased: 4 },
}
/**
 * Get nature modifier for a given stat
 * @param nature The Pokemon's nature
 * @param statIndex The index of the stat (0: HP, 1: Atk, 2: Def, 3: Spe, 4: SpA, 5: SpD)
 * @returns The stat modifier (1.1, 0.9, or 1.0)
 */
export function getNatureModifier (nature: string, statIndex: number): number {
  const effect = natureEffects[nature]
  if (typeof effect !== 'undefined') {
    if (statIndex === effect.increased) return 1.1
    if (statIndex === effect.decreased) return 0.9
  }
  return 1.0
}

/**
 * Calculate total stats based on base stats, IVs, EVs, level, and nature
 * @param pokemon The Pokemon data object
 * @param baseStats The array of base stats in the order: HP, Atk, Def, Spe, SpA, SpD
 * @returns An array of calculated total stats
 */
export function calculateTotalStats (pokemon: PokemonDataInterface, baseStats: number[]): number[] {
  const { level, ivs, evs, nature } = pokemon
  // Cast readonly arrays to mutable arrays for compatibility
  return calculateTotalStatsDirect(baseStats, ivs, evs, level, nature)
}

/**
 * Calculate total stats based on base stats, IVs, EVs, level, nature (direct params version)
 * @param baseStats Array of base stats [HP, Atk, Def, Spe, SpA, SpD]
 * @param ivs Array of IVs [HP, Atk, Def, Spe, SpA, SpD]
 * @param evs Array of EVs [HP, Atk, Def, Spe, SpA, SpD]
 * @param level Pokemon level
 * @param nature Nature string
 * @returns Array of calculated total stats
 */
export function calculateTotalStatsDirect (
  baseStats: readonly number[],
  ivs: readonly number[],
  evs: readonly number[],
  level: number,
  nature: string,
): number[] {
  // HP calculation
  const hp = Math.floor(((2 * baseStats[0]! + ivs[0]! + Math.floor(evs[0]! / 4)) * level) / 100) + level + 10

  // Stat order: [HP, Atk, Def, Spe, SpA, SpD]
  // Calculate non-HP stats (Atk, Def, Spe, SpA, SpD)
  const statIndices = [1, 2, 3, 4, 5]
  const otherStats = statIndices.map((i) => {
    const base = baseStats[i]
    const iv = ivs[i]
    const ev = evs[i]
    const natureMod = getNatureModifier(nature, i)
    const stat = Math.floor((Math.floor(((2 * base! + iv! + Math.floor(ev! / 4)) * level) / 100) + 5) * natureMod)
    return stat
  })

  // Return in order: HP, Atk, Def, Spe, SpA, SpD
  return [hp, ...otherStats]
}

/**
 * Update the party Pokémon in a SaveBlock1 buffer with the given PokemonDataInterface array.
 * Returns a new Uint8Array with the updated party data.
 * @param saveblock1 The original SaveBlock1 buffer
 * @param party Array of PokemonDataInterface (max length = maxPartySize)
 * @param partyStartOffset Offset where party data starts
 * @param partyPokemonSize Size of each Pokemon data structure
 * @param saveblock1Size Expected size of SaveBlock1
 * @param maxPartySize Maximum party size
 */
export function updatePartyInSaveblock1 (
  saveblock1: Uint8Array,
  party: PokemonDataInterface[],
  partyStartOffset: number,
  partyPokemonSize: number,
  saveblock1Size: number,
  maxPartySize: number,
): Uint8Array {
  if (saveblock1.length < saveblock1Size) {
    throw new Error(`SaveBlock1 must be at least ${saveblock1Size} bytes`)
  }
  if (party.length > maxPartySize) {
    throw new Error(`Party size cannot exceed ${maxPartySize}`)
  }
  const updated = new Uint8Array(saveblock1)
  for (let i = 0; i < party.length; i++) {
    const offset = partyStartOffset + i * partyPokemonSize
    updated.set(party[i]!.rawBytes, offset)
  }
  return updated
}

export default {
  formatPlayTime,
  getPokemonNature,
  calculateTotalStats,
}
