/**
 * Enhanced Vanilla Pokemon Emerald configuration with signature-based address resolution
 * Maintains backward compatibility while enabling dynamic address discovery
 */

import type { GameConfig, ItemMapping, MoveMapping, PokemonMapping } from '../../core/types'
import { VANILLA_SAVE_LAYOUT } from '../../core/types'
import { GameConfigBase } from '../../core/GameConfigBase'
import { createSignatureMemoryAddresses, type SignatureMemoryAddresses } from '../../../signature/address-resolver'
import itemMapData from './data/item_map.json'
import moveMapData from './data/move_map.json'
import pokemonMapData from './data/pokemon_map.json'
import { createMapping } from '../../core/utils'

/**
 * Enhanced Vanilla Pokemon Emerald configuration with signature-based address resolution
 */
export class VanillaConfigWithSignatures extends GameConfigBase implements GameConfig {
  readonly name = 'Pokemon Emerald (Vanilla) - Signature Enhanced'

  readonly pokemonSize = 100
  readonly maxPartySize = 6

  // Use default save layout with no overrides
  readonly saveLayout = VANILLA_SAVE_LAYOUT

  // Load mapping data for translating internal IDs to external IDs using utility function
  readonly mappings = {
    pokemon: createMapping<PokemonMapping>(pokemonMapData as Record<string, unknown>),
    moves: createMapping<MoveMapping>(moveMapData as Record<string, unknown>),
    items: createMapping<ItemMapping>(itemMapData as Record<string, unknown>),
  } as const

  // Signature-aware memory addresses with fallback to known addresses
  readonly memoryAddresses: SignatureMemoryAddresses = createSignatureMemoryAddresses(
    0x020244ec, // Fallback partyData address for vanilla Emerald
    0x020244e9, // Fallback partyCount address for vanilla Emerald  
    0x258       // Enemy party offset (2024744 - 20244ec = 258)
  )

  get preloadRegions () {
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
   * Enable signature-based address resolution when memory data is available
   * This should be called when connecting to mGBA or loading a memory dump
   */
  enableSignatureResolution(memoryBuffer: Uint8Array): void {
    this.memoryAddresses.enableSignatureResolution(memoryBuffer, 'emerald')
    console.log('🔍 Signature-based address resolution enabled for Vanilla Emerald')
    
    // Log resolved addresses for verification
    const resolved = this.memoryAddresses.partyData
    const fallback = this.memoryAddresses.getFallbackAddresses().partyData
    
    if (resolved !== fallback) {
      console.log(`✅ Dynamic resolution: partyData at 0x${resolved.toString(16)} (fallback: 0x${fallback.toString(16)})`)
    } else {
      console.log(`⏪ Using fallback address: partyData at 0x${resolved.toString(16)}`)
    }
  }

  /**
   * Check if this config can handle the given save file
   * Vanilla is the fallback, so it's permissive and can handle most Emerald-based saves
   */
  canHandle (saveData: Uint8Array): boolean {
    return this.hasValidEmeraldSignature(saveData)
  }

  /**
   * Check if this config can handle memory parsing for the given game title
   * Supports Pokémon Emerald variants with signature resolution
   */
  canHandleMemory (gameTitle: string): boolean {
    return gameTitle.toUpperCase().includes('POKEMON EMER')
  }

  /**
   * Get current resolved addresses for debugging/verification
   */
  getResolvedAddresses(): {
    partyData: number
    partyCount: number
    fallbackPartyData: number
    fallbackPartyCount: number
    usingSignatures: boolean
  } {
    const current = {
      partyData: this.memoryAddresses.partyData,
      partyCount: this.memoryAddresses.partyCount,
    }
    const fallbacks = this.memoryAddresses.getFallbackAddresses()
    
    return {
      ...current,
      fallbackPartyData: fallbacks.partyData,
      fallbackPartyCount: fallbacks.partyCount,
      usingSignatures: current.partyData !== fallbacks.partyData || current.partyCount !== fallbacks.partyCount,
    }
  }
}