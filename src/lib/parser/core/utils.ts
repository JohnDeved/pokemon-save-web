/**
 * Integration utilities for Pokemon Save Parser
 * Modern utilities for Pokemon data processing
 */

import type { PokemonBase } from './PokemonBase'
import charmapData from '../data/pokemon_charmap.json'

// Convert charmap keys from strings to numbers for faster lookup
const charmap: Record<number, string> = {}
for (const [key, value] of Object.entries(charmapData)) {
  charmap[parseInt(key, 10)] = value
}

/**
 * Get sprite URL for a Pokemon item
 */
export function getItemSpriteUrl(itemIdName: string): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${itemIdName}.png`
}

/**
 * Convert byte array to string using Pokemon GBA character encoding
 * Uses the external charmap.json for accurate character conversion
 * See: https://bulbapedia.bulbagarden.net/wiki/Character_encoding_in_Generation_III
 */
export function bytesToGbaString(bytes: Uint8Array): string {
  let result = ''
  const endIndex = findStringEnd(bytes)

  // Process only the actual string content (before padding/garbage)
  for (let i = 0; i < endIndex; i++) {
    const byte = bytes[i]!
    const char = charmap[byte]

    if (char === undefined) continue // Skip unmapped bytes
    if (char === '\\n') result += '\n'
    else if (char === '\\l' || char === '\\p')
      continue // Skip control codes
    else result += char
  }

  return result.trim()
}

/**
 * Find the actual end of a Pokemon GBA string by detecting padding patterns
 */
function findStringEnd(bytes: Uint8Array): number {
  // Check for trailing 0xFF padding (more than 2 suggests padding)
  let trailingFFs = 0
  for (let i = bytes.length - 1; i >= 0 && bytes[i] === 0xff; i--) {
    trailingFFs++
  }

  if (trailingFFs > 2) {
    return bytes.length - trailingFFs
  }

  // Look for garbage pattern: 0xFF followed by low values (0x01-0x0F)
  for (let i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] === 0xff) {
      for (let j = i + 1; j < bytes.length; j++) {
        const nextByte = bytes[j]!
        if (nextByte > 0 && nextByte < 0x10) return i // Found garbage
        if (nextByte !== 0xff && nextByte !== 0) break
      }
    }
  }

  return bytes.length
}

/**
 * Convert a string to a byte array using Pokemon GBA character encoding
 * Uses the external charmap.json for accurate character conversion
 * Pads with 0xFF to the specified length (default 10)
 * @param str The string to encode
 * @param length The fixed length of the output array (default 10)
 * @returns Uint8Array of encoded bytes
 */
export function gbaStringToBytes(str: string, length = 10): Uint8Array {
  // Build a reverse charmap: char -> byte
  const reverseCharmap: Record<string, number> = {}
  for (const [key, value] of Object.entries(charmap)) {
    reverseCharmap[value] = Number(key)
  }
  const bytes = new Uint8Array(length).fill(0xff)
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
export function formatPlayTime(hours: number, minutes: number, seconds: number): string {
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export const statStrings: string[] = ['HP', 'Attack', 'Defense', 'Speed', 'Special Attack', 'Special Defense']

// Shared stat abbreviations used across UI components
export const statAbbreviations: readonly string[] = ['HP', 'Atk', 'Def', 'Spe', 'SpA', 'SpD'] as const

export function getStatAbbr(index: number): string {
  return statAbbreviations[index] ?? statStrings[index] ?? ''
}

// Shared gameplay constants
export const MAX_IV = 31
export const MAX_EV = 252
export const MAX_TOTAL_EV = 510

export const natures = ['Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty', 'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax', 'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive', 'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash', 'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky']
/**
 * Get Pokemon nature from the first byte of the personality value
 * Pokemon nature is determined by (personality & 0xFF) % 25
 */
export function getPokemonNature(personality: number): string {
  // Gen 3 standard formula: full personality value modulo 25
  return natures[personality % 25]!
}

export function setPokemonNature(pokemon: PokemonBase, nature: string): void {
  // Find the index of the nature in the natures array
  const natureIndex = natures.indexOf(nature)
  if (natureIndex === -1) {
    throw new Error(`Invalid nature: ${nature}`)
  }

  // Calculate the new personality value
  pokemon.setNatureRaw(natureIndex)
}

export const natureEffects: Record<string, { increased: number; decreased: number }> = {
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
 * Find the nature name that raises one stat index and lowers another.
 * Returns 'Serious' (neutral) when indices are invalid or identical.
 */
export function findNatureForEffects(increased: number, decreased: number): string {
  if (increased === decreased || increased <= 0 || decreased <= 0) return 'Serious'
  for (const [name, eff] of Object.entries(natureEffects)) {
    if (eff.increased === increased && eff.decreased === decreased) return name
  }
  return 'Serious'
}
/**
 * Get nature modifier for a given stat
 * @param nature The Pokemon's nature
 * @param statIndex The index of the stat (0: HP, 1: Atk, 2: Def, 3: Spe, 4: SpA, 5: SpD)
 * @returns The stat modifier (1.1, 0.9, or 1.0)
 */
export function getNatureModifier(nature: string, statIndex: number): number {
  const effect = natureEffects[nature]
  if (typeof effect !== 'undefined') {
    if (statIndex === effect.increased) return 1.1
    if (statIndex === effect.decreased) return 0.9
  }
  return 1
}

/**
 * Calculate total stats based on base stats, IVs, EVs, level, and nature
 * @param pokemon The Pokemon data object
 * @param baseStats The array of base stats in the order: HP, Atk, Def, Spe, SpA, SpD
 * @returns An array of calculated total stats
 */
export function calculateTotalStats(pokemon: PokemonBase, baseStats: readonly number[]): readonly number[] {
  // Extract properties with type guards for safety
  const level = Number(pokemon.level)
  const nature = String(pokemon.nature)

  // Type-safe array conversion
  const ivs: number[] = []
  const evs: number[] = []

  for (let i = 0; i < 6; i++) {
    ivs.push(Number(pokemon.ivs[i] ?? 0))
    evs.push(Number(pokemon.evs[i] ?? 0))
  }

  return calculateTotalStatsDirect([...baseStats], ivs, evs, level, nature)
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
export function calculateTotalStatsDirect(baseStats: readonly number[], ivs: readonly number[], evs: readonly number[], level: number, nature: string): number[] {
  // HP calculation
  const hp = Math.floor(((2 * baseStats[0]! + ivs[0]! + Math.floor(evs[0]! / 4)) * level) / 100) + level + 10

  // Stat order: [HP, Atk, Def, Spe, SpA, SpD]
  // Calculate non-HP stats (Atk, Def, Spe, SpA, SpD)
  const statIndices = [1, 2, 3, 4, 5]
  const otherStats = statIndices.map(i => {
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
 * Update the party Pokémon in a SaveBlock1 buffer with the given PokemonInstance array.
 * Returns a new Uint8Array with the updated party data.
 * @param saveblock1 The original SaveBlock1 buffer
 * @param party Array of PokemonInstance (max length = maxPartySize)
 * @param partyStartOffset Offset where party data starts
 * @param partyPokemonSize Size of each Pokemon data structure
 * @param saveblock1Size Expected size of SaveBlock1
 * @param maxPartySize Maximum party size
 */
export function updatePartyInSaveblock1(saveblock1: Uint8Array, party: readonly PokemonBase[], partyStartOffset: number, partyPokemonSize: number, saveblock1Size: number, maxPartySize: number): Uint8Array {
  if (saveblock1.length < saveblock1Size) {
    throw new Error(`SaveBlock1 must be at least ${saveblock1Size} bytes`)
  }
  if (party.length > maxPartySize) {
    throw new Error(`Party size cannot exceed ${maxPartySize}`)
  }
  const updated = new Uint8Array(saveblock1)
  for (let i = 0; i < party.length; i++) {
    const offset = partyStartOffset + i * partyPokemonSize
    const pokemon = party[i]
    if (pokemon?.rawBytes) {
      // Type-safe conversion to Uint8Array - use destructuring
      const { rawBytes } = pokemon
      if (rawBytes instanceof Uint8Array) {
        updated.set(rawBytes, offset)
      }
    }
  }
  return updated
}

/**
 * Utility functions for creating ID mappings from JSON data
 */

export interface BaseMappingItem {
  readonly id: number | null
  readonly name: string
  readonly id_name: string
}

/**
 * Creates a Map from JSON mapping data, filtering out invalid entries
 * @param mapData - Raw JSON mapping data
 * @returns Map with numeric keys and validated mapping objects
 */
export function createMapping<T extends BaseMappingItem>(mapData: Record<string, unknown>): Map<number, T> {
  return new Map<number, T>(
    Object.entries(mapData)
      .filter(([_, v]) => typeof v === 'object' && v !== null && 'id' in v && v.id !== null)
      .map(([k, v]) => [parseInt(k, 10), v as T])
  )
}

/**
 * Creates multiple mappings from JSON data objects
 * @param mappingData - Object containing different mapping data sets
 * @returns Object with the same keys but containing Map instances
 */
export function createMappings<T extends Record<string, Record<string, unknown>>>(mappingData: T): { [K in keyof T]: Map<number, BaseMappingItem> } {
  const result: { [K in keyof T]: Map<number, BaseMappingItem> } = Object.create(null)

  for (const [key, data] of Object.entries(mappingData)) {
    result[key as keyof T] = createMapping(data)
  }

  return result
}
