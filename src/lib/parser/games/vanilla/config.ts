/**
 * Vanilla Pokemon Emerald configuration
 * Only provides ID mappings - all other behavior uses the defaults from PokemonInstance
 */

import type { GameConfig, ItemMapping, MoveMapping, PokemonMapping } from '../../core/types'
import { VANILLA_SAVE_LAYOUT } from '../../core/types'
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
    partyData: 0x20244ec, // _party address from pokemon.lua
    partyCount: 0x20244e9, // _partyCount address from pokemon.lua
    // TODO: Add player name and play time addresses when implemented
  } as const

  /**
   * Check if this config can handle the given save file
   * Vanilla is the fallback, so it's permissive and can handle most Emerald-based saves
   */
  canHandle (saveData: Uint8Array): boolean {
    return this.hasValidEmeraldSignature(saveData)
  }

  /**
   * Check if this config can handle memory parsing for the given game title
   * Supports Pokémon Emerald variants
   */
  canHandleMemory (gameTitle: string): boolean {
    return gameTitle.includes('EMERALD') || gameTitle.includes('Emerald') || gameTitle.includes('EMER')
  }
}
