/**
 * Vanilla Pokemon Emerald configuration
 * Only provides ID mappings - all other behavior uses the defaults from PokemonInstance
 */

import { VANILLA_SAVE_LAYOUT, type GameConfig, type ItemMapping, type MoveMapping, type PokemonMapping } from '../../core/types'
import { GameConfigBase } from '../../core/GameConfigBase'
import itemMapData from './data/item_map.json'
import moveMapData from './data/move_map.json'
import pokemonMapData from './data/pokemon_map.json'
import { createMapping } from '../../core/utils'

/**
 * Vanilla Pokemon Emerald configuration
 * Pure vanilla - only provides ID mappings, everything else uses built-in defaults
 */
export class VanillaConfig extends GameConfigBase implements GameConfig {
  readonly name = 'Pokemon Emerald (Vanilla)'

  readonly pokemonSize = 100
  readonly maxPartySize = 6

  // Vanilla Emerald does not support Mega Evolution
  readonly supportsMega = false

  // Use default save layout with no overrides
  readonly saveLayout = VANILLA_SAVE_LAYOUT

  // Load mapping data for translating internal IDs to external IDs using utility function
  readonly mappings = {
    pokemon: createMapping<PokemonMapping>(pokemonMapData as Record<string, unknown>),
    moves: createMapping<MoveMapping>(moveMapData as Record<string, unknown>),
    items: createMapping<ItemMapping>(itemMapData as Record<string, unknown>),
  } as const

  // Memory addresses for Pokémon Emerald (USA) in mGBA (from official pokemon.lua script)
  readonly memoryAddresses = {
    partyData: 0x20244ec,
    partyCount: 0x20244e9,
    enemyParty: 0x2024744,
    get enemyPartyCount() {
      return this.partyCount + 0x8
    },
    // TODO: Add player name and play time addresses when implemented
  } as const

  get preloadRegions() {
    return [
      {
        address: this.memoryAddresses.partyData,
        // Full party data (6 * 100 bytes)
        size: this.pokemonSize * this.maxPartySize,
      },
      {
        address: this.memoryAddresses.partyCount,
        size: 7, // Party count + context
      },
    ]
  }

  /**
   * Check if this config can handle the given save file
   * Vanilla is the fallback, so it's permissive and can handle most Emerald-based saves
   */
  canHandle(saveData: Uint8Array): boolean {
    return this.hasValidEmeraldSignature(saveData)
  }

  /**
   * Check if this config can handle memory parsing for the given game title
   * Supports Pokémon Emerald variants
   */
  canHandleMemory(gameTitle: string): boolean {
    return gameTitle.toUpperCase().includes('POKEMON EMER')
  }
}
