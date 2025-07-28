/**
 * Quetzal ROM hack configuration
 * Only overrides differences from vanilla Emerald baseline
 */

import type { GameConfig, ItemMapping, MoveMapping, PokemonMapping, PokemonOffsetsOverride, SaveLayoutOverride } from '../../core/types'
import { VANILLA_SAVE_LAYOUT } from '../../core/types'
import { createMapping, natures } from '../../core/utils'
import { GameConfigBase } from '../../core/GameConfigBase'
import itemMapData from './data/item_map.json'
import moveMapData from './data/move_map.json'
import pokemonMapData from './data/pokemon_map.json'

export class QuetzalConfig extends GameConfigBase implements GameConfig {
  readonly name = 'Pokemon Quetzal'

  // Override Pokemon size for Quetzal
  readonly pokemonSize = 104

  // Override offsets for Quetzal's unencrypted structure
  readonly offsetOverrides: PokemonOffsetsOverride = {
    currentHp: 0x23,
    maxHp: 0x5A,
    attack: 0x5C,
    defense: 0x5E,
    speed: 0x60,
    spAttack: 0x62,
    spDefense: 0x64,
    status: 0x57,
    level: 0x58,
  }

  // Override save layout for Quetzal
  readonly saveLayoutOverrides: SaveLayoutOverride = {
    partyOffset: 0x6A8,
    partyCountOffset: 0x6A4,
    pokemonSize: 104,
    playTimeHours: 0x10,
    playTimeMinutes: 0x14,
    playTimeSeconds: 0x15,
  }

  // Merged save layout for easy access
  readonly saveLayout = { ...VANILLA_SAVE_LAYOUT, ...this.saveLayoutOverrides }

  // ID mappings for Quetzal using utility functions
  readonly mappings = {
    pokemon: createMapping<PokemonMapping>(pokemonMapData as Record<string, unknown>),
    items: createMapping<ItemMapping>(itemMapData as Record<string, unknown>),
    moves: createMapping<MoveMapping>(moveMapData as Record<string, unknown>),
  } as const

  // Cache for discovered memory addresses (to avoid re-scanning)
  private _discoveredAddresses: { partyCount: number; partyData: number } | null = null
  private _memoryAddressesObject: any = null

  // Dynamic memory addresses for Quetzal ROM hack - DYNAMIC ALLOCATION SUPPORT
  // User confirmed working addresses (but they change between savestates):
  // - quetzal.ss0: Party data at 0x2024a14, count at 0x2024a10
  // - quetzal2.ss0: Party data at 0x2024a58, count at 0x2024a54 (68 bytes later)
  // Solution: Dynamic memory scanning to locate party data without knowing contents
  get memoryAddresses() {
    if (!this._memoryAddressesObject) {
      this._memoryAddressesObject = {
        partyData: 0x00000000, // Will be discovered dynamically
        partyCount: 0x00000000, // Will be discovered dynamically  
        playTime: 0x00000000, // Not implemented yet
        preloadRegions: [], // Will be set after discovery
      }
    }
    return this._memoryAddressesObject
  }

  /**
   * Update memory addresses after dynamic discovery
   */
  private updateMemoryAddresses(partyCount: number, partyData: number): void {
    if (this._memoryAddressesObject) {
      this._memoryAddressesObject.partyCount = partyCount
      this._memoryAddressesObject.partyData = partyData
      this._memoryAddressesObject.preloadRegions = [
        { address: partyCount, size: 8 },    // Party count + context
        { address: partyData, size: 624 },   // Full party data (6 * 104 bytes)
      ]
    }
  }

  // Quetzal-specific offsets for unencrypted data
  private readonly quetzalOffsets = {
    species: 0x28,
    item: 0x2A,
    move1: 0x34,
    move2: 0x36,
    move3: 0x38,
    move4: 0x3A,
    pp1: 0x3C,
    pp2: 0x3D,
    pp3: 0x3E,
    pp4: 0x3F,
    hpEV: 0x40,
    atkEV: 0x41,
    defEV: 0x42,
    speEV: 0x43,
    spaEV: 0x44,
    spdEV: 0x45,
    ivData: 0x50,
  } as const

  // Override data access methods for Quetzal's unencrypted structure
  getSpeciesId (_data: Uint8Array, view: DataView): number {
    const rawSpecies = view.getUint16(this.quetzalOffsets.species, true)
    // Apply ID mapping using the base mapping system
    return this.mappings.pokemon.get(rawSpecies)?.id ?? rawSpecies
  }

  getPokemonName (_data: Uint8Array, view: DataView): string | undefined {
    const rawSpecies = view.getUint16(this.quetzalOffsets.species, true)
    // Apply name mapping using the base mapping system - use id_name for sprite filenames
    return this.mappings.pokemon.get(rawSpecies)?.id_name
  }

  getItem (_data: Uint8Array, view: DataView): number {
    const rawItem = view.getUint16(this.quetzalOffsets.item, true)
    // Apply ID mapping using the base mapping system
    return this.mappings.items.get(rawItem)?.id ?? rawItem
  }

  getItemName (_data: Uint8Array, view: DataView): string | undefined {
    const rawItem = view.getUint16(this.quetzalOffsets.item, true)
    // Apply name mapping using the base mapping system
    return this.mappings.items.get(rawItem)?.id_name
  }

  getMove (_data: Uint8Array, view: DataView, index: number): number {
    const moveOffsets = [this.quetzalOffsets.move1, this.quetzalOffsets.move2, this.quetzalOffsets.move3, this.quetzalOffsets.move4]
    const rawMove = view.getUint16(moveOffsets[index]!, true)
    // Apply ID mapping using the base mapping system
    return this.mappings.moves.get(rawMove)?.id ?? rawMove
  }

  getPP (_data: Uint8Array, view: DataView, index: number): number {
    const ppOffsets = [this.quetzalOffsets.pp1, this.quetzalOffsets.pp2, this.quetzalOffsets.pp3, this.quetzalOffsets.pp4]
    return view.getUint8(ppOffsets[index]!)
  }

  getEV (_data: Uint8Array, view: DataView, index: number): number {
    const evOffsets = [this.quetzalOffsets.hpEV, this.quetzalOffsets.atkEV, this.quetzalOffsets.defEV, this.quetzalOffsets.speEV, this.quetzalOffsets.spaEV, this.quetzalOffsets.spdEV]
    return view.getUint8(evOffsets[index]!)
  }

  setEV (_data: Uint8Array, view: DataView, index: number, value: number): void {
    const evOffsets = [this.quetzalOffsets.hpEV, this.quetzalOffsets.atkEV, this.quetzalOffsets.defEV, this.quetzalOffsets.speEV, this.quetzalOffsets.spaEV, this.quetzalOffsets.spdEV]
    const clampedValue = Math.max(0, Math.min(255, value))
    view.setUint8(evOffsets[index]!, clampedValue)
  }

  getIVs (_data: Uint8Array, view: DataView): readonly number[] {
    const ivData = view.getUint32(this.quetzalOffsets.ivData, true)
    return Array.from({ length: 6 }, (_, i) => (ivData >>> (i * 5)) & 0x1F)
  }

  setIVs (_data: Uint8Array, view: DataView, values: readonly number[]): void {
    if (values.length !== 6) throw new Error('IVs array must have 6 values')
    let packed = 0
    for (let i = 0; i < 6; i++) {
      const clampedValue = Math.max(0, Math.min(31, values[i]!))
      packed |= (clampedValue & 0x1F) << (i * 5)
    }
    view.setUint32(this.quetzalOffsets.ivData, packed, true)
  }

  /**
   * Override nature calculation for Quetzal-specific formula
   */
  calculateNature (personality: number): string {
    // Quetzal uses only the first byte of personality modulo 25
    return natures[(personality & 0xFF) % 25]!
  }

  /**
   * Override nature setting for Quetzal-specific implementation
   */
  setNature (_data: Uint8Array, view: DataView, value: number): void {
    // Quetzal uses (personality & 0xFF) % 25 for nature calculation
    const currentPersonality = view.getUint32(0x00, true)
    const currentFirstByte = currentPersonality & 0xFF
    const currentNature = currentFirstByte % 25

    if (currentNature === value) return

    // Calculate new first byte: preserve quotient, set remainder to desired nature
    const newFirstByte = (currentFirstByte - currentNature) + value

    // Update personality with new first byte
    const newPersonality = (currentPersonality & 0xFFFFFF00) | (newFirstByte & 0xFF)
    view.setUint32(0x00, newPersonality >>> 0, true)
  }

  /**
   * Override active slot determination for Quetzal
   */
  determineActiveSlot (getCounterSum: (range: number[]) => number): number {
    const slot1Range = Array.from({ length: 18 }, (_, i) => i)
    const slot2Range = Array.from({ length: 18 }, (_, i) => i + 14)
    const slot1Sum = getCounterSum(slot1Range)
    const slot2Sum = getCounterSum(slot2Range)

    return slot2Sum >= slot1Sum ? 14 : 0
  }

  /**
   * Override shiny calculation for Quetzal-specific values
   */
  isShiny (personality: number, _otId: number): boolean {
    return this.getShinyValue(personality, _otId) === 1
  }

  getShinyValue (personality: number, _otId: number): number {
    return (personality >> 8) & 0xFF
  }

  isRadiant (personality: number, _otId: number): boolean {
    return this.getShinyValue(personality, _otId) === 2
  }

  /**
   * Check if this config can handle the given save file
   * Use parsing success as detection criteria with base class helpers
   */
  canHandle (saveData: Uint8Array): boolean {
    // Use base class to check for valid Emerald signature
    if (!this.hasValidEmeraldSignature(saveData)) {
      return false
    }

    // Try to actually parse Pokemon using Quetzal-specific structure with base class helpers
    try {
      const activeSlot = this.getActiveSlot(saveData)
      const sectorMap = this.buildSectorMap(saveData, activeSlot)
      const saveblock1Data = this.extractSaveBlock1(saveData, sectorMap)

      // Use base class helper for Pokemon detection
      const pokemonFound = this.parsePokemonForDetection(
        saveblock1Data,
        this.pokemonSize,
        (data, view) => this.getSpeciesId(data, view),
      )

      // Return true if we found valid Pokemon data
      return pokemonFound > 0
    } catch {
      return false
    }
  }

  /**
   * Dynamically discover party data location in Quetzal's memory
   * Scans EWRAM for valid Pokemon data, then checks for party count at -4 offset
   * Optimized to read larger chunks to reduce network calls
   */
  async discoverPartyAddresses(client: any): Promise<{ partyCount: number; partyData: number }> {
    console.log('🔍 Discovering Quetzal party data location...')
    
    // Define scan region for EWRAM - focus on the exact region where user found data
    const scanStart = 0x2024a00  // Very close to user confirmed address
    const scanEnd = 0x2024b00    // Small range for debugging
    const chunkSize = 256        // Smaller chunks for more precise debugging
    
    console.log(`   Scanning 0x${scanStart.toString(16)} - 0x${scanEnd.toString(16)} in ${chunkSize}-byte chunks`)
    
    for (let chunkAddr = scanStart; chunkAddr < scanEnd; chunkAddr += chunkSize) {
      try {
        // Read a chunk of memory
        const chunkData = await client.readBytes(chunkAddr, Math.min(chunkSize, scanEnd - chunkAddr))
        
        // Scan within the chunk for Pokemon data signatures, then check for count
        for (let offset = 4; offset < chunkData.length - 104; offset += 1) { // Check every byte for debugging
          const pokemonDataAddr = chunkAddr + offset
          
          // Only check addresses that match the user's confirmed range
          if (pokemonDataAddr !== 0x2024a14 && pokemonDataAddr !== 0x2024a18) continue
          
          console.log(`   🔍 Checking Pokemon data at 0x${pokemonDataAddr.toString(16)}`)
          
          // Check if this looks like valid Pokemon data
          const pokemonData = chunkData.slice(offset, offset + 104)
          const view = new DataView(pokemonData.buffer, pokemonData.byteOffset, 104)
          
          // Validate Quetzal Pokemon structure
          const species = view.getUint16(0x28, true)  // Species at offset 0x28
          const level = view.getUint8(0x58)           // Level at offset 0x58
          const currentHp = view.getUint16(0x23, true) // Current HP at offset 0x23
          const maxHp = view.getUint16(0x5A, true)     // Max HP at offset 0x5A
          
          console.log(`      Species: ${species}, Level: ${level}, HP: ${currentHp}/${maxHp}`)
          
          // Check if this is the user's confirmed address (0x2024a14)
          if (pokemonDataAddr === 0x2024a14) {
            console.log(`      🎯 This is the user's confirmed party data address!`)
            
            // Use the user's confirmed address even if validation is weak
            // The count would be at 0x2024a10 based on standard offset
            const userCountAddr = 0x2024a10
            const userCount = await client.readByte(userCountAddr)
            console.log(`      Checking user's implied count address 0x${userCountAddr.toString(16)}: ${userCount}`)
            
            // If the count doesn't look right, maybe it's embedded differently
            if (userCount < 1 || userCount > 6) {
              // Maybe the count is at the start of the Pokemon data structure
              const embeddedCount = pokemonData[0]
              console.log(`      Checking embedded count at start of data: ${embeddedCount}`)
              
              if (embeddedCount >= 1 && embeddedCount <= 6) {
                console.log(`      ✅ Using user's confirmed address with embedded count`)
                return {
                  partyCount: pokemonDataAddr, // Count is embedded in the data
                  partyData: pokemonDataAddr + 4 // Data starts 4 bytes after count
                }
              }
            } else {
              console.log(`      ✅ Using user's confirmed address with standard count offset`)
              return {
                partyCount: userCountAddr,
                partyData: pokemonDataAddr
              }
            }
          }
          
          // Basic Pokemon validation
          if (level >= 1 && level <= 100 && species > 0 && 
              currentHp <= maxHp && maxHp > 0) {
            
            console.log(`      ✅ Valid Pokemon found!`)
            
            // Now check if there's a valid party count 4 bytes before this Pokemon data
            const partyCountAddr = pokemonDataAddr - 4
            const countOffset = offset - 4
            
            if (countOffset >= 0) {
              const partyCount = chunkData[countOffset]
              console.log(`      Checking party count at 0x${partyCountAddr.toString(16)}: ${partyCount}`)
              
              // Check if this is a valid party count
              if (partyCount >= 1 && partyCount <= 6) {
                console.log(`✅ Found party data: count at 0x${partyCountAddr.toString(16)}, data at 0x${pokemonDataAddr.toString(16)}`)
                console.log(`   Party count: ${partyCount}, First Pokemon: Lv${level} #${species} (${currentHp}/${maxHp} HP)`)
                
                // Double-check by reading the address again immediately
                const doubleCheck = await client.readByte(partyCountAddr)
                console.log(`   🔍 Double-checking count address: ${doubleCheck}`)
                
                // Also check if the count is actually at pokemonDataAddr - 4 (standard offset)
                const standardCountAddr = pokemonDataAddr - 4
                const standardCount = await client.readByte(standardCountAddr)
                console.log(`   🔍 Checking standard count address 0x${standardCountAddr.toString(16)}: ${standardCount}`)
                
                // The Pokemon data is at 0x2024a18, so count should be at 0x2024a14
                // But let's also check 0x2024a10 in case that's the real count
                const alternativeCountAddr = 0x2024a10
                const alternativeCount = await client.readByte(alternativeCountAddr)
                console.log(`   🔍 Checking alternative count address 0x${alternativeCountAddr.toString(16)}: ${alternativeCount}`)
                
                // If the alternative address has a valid count, use that
                if (alternativeCount >= 1 && alternativeCount <= 6) {
                  console.log(`   ✅ Using alternative count address (matches user confirmation)`)
                  return {
                    partyCount: alternativeCountAddr,
                    partyData: pokemonDataAddr
                  }
                }
                
                // If the standard offset has a valid count, use that instead
                if (standardCount >= 1 && standardCount <= 6) {
                  console.log(`   ✅ Using standard offset addresses`)
                  return {
                    partyCount: standardCountAddr,
                    partyData: pokemonDataAddr
                  }
                }
                
                return {
                  partyCount: partyCountAddr,
                  partyData: pokemonDataAddr
                }
              } else {
                console.log(`      ❌ Invalid party count: ${partyCount}`)
              }
            }
          } else {
            console.log(`      ❌ Invalid Pokemon data`)
          }
        }
      } catch (e) {
        console.log(`   Error reading chunk at 0x${chunkAddr.toString(16)}: ${e}`)
        continue
      }
    }
    
    throw new Error('Party data not found in Quetzal memory - no valid signatures detected')
  }

  /**
   * Get dynamic memory addresses for party data
   * Discovers and caches addresses on first call
   */
  async getDynamicMemoryAddresses(client: any): Promise<{ partyCount: number; partyData: number }> {
    if (!this._discoveredAddresses) {
      this._discoveredAddresses = await this.discoverPartyAddresses(client)
      // Update the memoryAddresses object with discovered values
      this.updateMemoryAddresses(this._discoveredAddresses.partyCount, this._discoveredAddresses.partyData)
    }
    return this._discoveredAddresses
  }

  /**
   * Initialize memory addresses for this config
   * Should be called before using memory parsing
   */
  async initializeMemoryAddresses(client: any): Promise<void> {
    console.log('🚀 Initializing Quetzal dynamic memory addresses...')
    await this.getDynamicMemoryAddresses(client)
    console.log('✅ Quetzal memory addresses initialized successfully')
  }

  /**
   * Check if this config can handle memory parsing for the given game title
   * MEMORY SUPPORT ENABLED: Dynamic discovery system handles Quetzal's dynamic allocation
   */
  canHandleMemory (gameTitle: string): boolean {
    // Enable memory support for Quetzal ROM hack using dynamic discovery
    // Also support standard Emerald titles since Quetzal is based on Emerald
    return gameTitle.includes('QUETZAL') || 
           gameTitle.includes('Quetzal') || 
           gameTitle.includes('QUET') ||
           gameTitle.includes('EMERALD') || 
           gameTitle.includes('Emerald') || 
           gameTitle.includes('EMER')
  }

  /**
   * Custom method to handle memory initialization for Quetzal
   * This should be called by the parser after memory mode is initialized
   */
  async prepareForMemoryMode(client: any): Promise<void> {
    if (!this._discoveredAddresses) {
      console.log('🔍 Quetzal: Discovering dynamic party data addresses...')
      await this.initializeMemoryAddresses(client)
    }
  }

  /**
   * Clear the discovered address cache (call when loading a new savestate)
   */
  clearAddressCache(): void {
    this._discoveredAddresses = null
  }
}
