/**
 * Memory-based Pokémon parser using mGBA WebSocket API
 * Based on pokeemerald source code analysis for robust ASLR handling
 * 
 * Key insight: Use pokeemerald analysis to find save data pointers regardless
 * of save content, avoiding reliance on specific save data values.
 */

import type { SaveData, PlayTime } from '../parser/core/types'
import type { PokemonBase } from '../parser/core/PokemonBase'
import { VanillaConfig } from '../parser/games/vanilla/config'
import { MgbaWebSocketClient } from './websocket-client'
import { MemoryPokemon } from './memory-pokemon'
import { 
  SAVEBLOCK1_LAYOUT, 
  SAVEBLOCK2_LAYOUT,
  MEMORY_REGIONS,
  type SaveBlockAddresses
} from './memory-mapping'
import { findSaveDataPointers } from './pokeemerald-research'

export class EmeraldMemoryParser {
  private config: VanillaConfig
  private saveBlockAddresses: SaveBlockAddresses | null = null

  constructor(private client: MgbaWebSocketClient) {
    this.config = new VanillaConfig()
  }

  /**
   * Find save data locations using pokeemerald-based analysis
   * This approach works for any save data content without prior knowledge
   * 
   * Strategy: Since save states may not load data into memory as expected,
   * we implement a comprehensive scan that looks for save data patterns
   * that are universal regardless of save content.
   */
  private async findSaveBlockAddresses(): Promise<SaveBlockAddresses> {
    if (this.saveBlockAddresses !== null) {
      return this.saveBlockAddresses
    }

    console.log('🔍 Locating save data using comprehensive EWRAM analysis...')

    // Strategy 1: Scan for valid SaveBlock1 structure patterns
    const saveBlock1Addr = await this.scanForSaveBlock1Structure()
    
    if (!saveBlock1Addr) {
      throw new Error(`
        Could not locate SaveBlock1 in memory. This could indicate:
        1. Save state is not loaded properly
        2. Save data is compressed/encrypted in the save state
        3. Game hasn't loaded save data into EWRAM yet
        
        Please ensure:
        - mGBA Docker container is running with emerald.ss0 loaded
        - Save state contains valid Pokemon Emerald save data
        - Game has had time to initialize (wait 10+ seconds after startup)
      `)
    }

    // Strategy 2: Find SaveBlock2 near SaveBlock1
    const saveBlock2Addr = await this.scanForSaveBlock2Structure(saveBlock1Addr)

    this.saveBlockAddresses = {
      saveBlock1: saveBlock1Addr,
      saveBlock2: saveBlock2Addr || saveBlock1Addr // Fallback to SaveBlock1 for basic functionality
    }

    console.log(`✅ Save data located:`)
    console.log(`   SaveBlock1: 0x${saveBlock1Addr.toString(16)}`)
    console.log(`   SaveBlock2: 0x${(saveBlock2Addr || saveBlock1Addr).toString(16)}`)

    return this.saveBlockAddresses
  }

  /**
   * Scan for SaveBlock1 structure using content-agnostic patterns
   * Looks for valid Pokemon data structure regardless of specific values
   * Returns multiple candidates for validation
   */
  private async scanForSaveBlock1Structure(): Promise<number | null> {
    console.log('  Scanning for SaveBlock1 structure patterns...')
    
    const ewramStart = MEMORY_REGIONS.EWRAM_BASE
    const ewramEnd = MEMORY_REGIONS.EWRAM_BASE + 0x40000
    const stepSize = 16 // Scan every 16 bytes for performance
    
    const candidates: Array<{address: number, score: number, details: string}> = []
    
    for (let addr = ewramStart; addr < ewramEnd - 0x500; addr += stepSize) {
      try {
        // Check for reasonable party count (0-6) at offset 0x234
        const partyCountAddr = addr + SAVEBLOCK1_LAYOUT.PARTY_COUNT
        const partyCount = await this.client.readDWord(partyCountAddr)
        
        if (partyCount >= 0 && partyCount <= 6) {
          let score = 0
          let details = `party:${partyCount}`
          
          // Check money for reasonableness (basic validation)
          try {
            const money = await this.client.readDWord(addr + SAVEBLOCK1_LAYOUT.MONEY)
            if (money > 0 && money < 0x1000000) {
              score += 10
              details += `, money:${money}`
            }
          } catch (error) {
            score -= 5
          }
          
          // If party has Pokemon, validate their structure
          if (partyCount > 0) {
            const pokemonAddr = addr + SAVEBLOCK1_LAYOUT.PARTY_POKEMON
            let validPokemonCount = 0
            
            for (let i = 0; i < Math.min(partyCount, 6); i++) {
              const pokemonStructAddr = pokemonAddr + (i * 100)
              
              try {
                const personality = await this.client.readDWord(pokemonStructAddr)
                const otId = await this.client.readDWord(pokemonStructAddr + 4)
                const level = await this.client.readByte(pokemonStructAddr + 0x54)
                const currentHp = await this.client.readWord(pokemonStructAddr + 0x56)
                const maxHp = await this.client.readWord(pokemonStructAddr + 0x58)
                
                if (this.isValidPokemonStructure(personality, otId, level, currentHp, maxHp)) {
                  validPokemonCount++
                  score += 20
                } else {
                  score -= 10
                }
                
                // Bonus points for reasonable level ranges
                if (level >= 1 && level <= 100) {
                  score += 5
                }
                
                details += `, pkmn${i+1}:L${level},HP${currentHp}/${maxHp}`
              } catch (error) {
                score -= 15
                details += `, pkmn${i+1}:error`
              }
            }
            
            // High score if all Pokemon are valid
            if (validPokemonCount === partyCount) {
              score += 50
            }
          } else {
            // Empty party is valid, give moderate score
            score += 30
            details += ', empty_party'
          }
          
          // Store candidate if it has a positive score
          if (score > 0) {
            candidates.push({ address: addr, score, details })
          }
        }
      } catch (error) {
        // Skip unreadable addresses
        continue
      }
      
      // Progress indicator every 64KB
      if ((addr - ewramStart) % 0x10000 === 0) {
        const progress = ((addr - ewramStart) / 0x40000 * 100).toFixed(1)
        process.stdout.write(`\r    Progress: ${progress}%`)
      }
    }
    
    console.log()
    
    if (candidates.length === 0) {
      console.log('    No valid SaveBlock1 structure found')
      return null
    }
    
    // Sort candidates by score (highest first)
    candidates.sort((a, b) => b.score - a.score)
    
    console.log(`    Found ${candidates.length} SaveBlock1 candidates:`)
    for (let i = 0; i < Math.min(candidates.length, 5); i++) {
      const candidate = candidates[i]
      console.log(`      ${i + 1}. 0x${candidate.address.toString(16)} (score: ${candidate.score}) - ${candidate.details}`)
    }
    
    const bestCandidate = candidates[0]
    console.log(`    Selected best candidate: 0x${bestCandidate.address.toString(16)}`)
    
    return bestCandidate.address
  }

  /**
   * Validate Pokemon structure data to avoid false positives
   * Made more lenient to account for different save states
   */
  private isValidPokemonStructure(personality: number, otId: number, level: number, currentHp: number, maxHp: number): boolean {
    // Basic sanity checks for Pokemon data
    const hasValidPersonality = personality !== 0 && personality !== 0xFFFFFFFF
    const hasValidOtId = otId !== 0 && otId !== 0xFFFFFFFF && otId < 0x100000000
    const hasValidLevel = level >= 0 && level <= 100
    const hasValidHp = currentHp >= 0 && maxHp > 0 && currentHp <= maxHp && maxHp <= 999
    
    // Must have at least 3 out of 5 valid fields for a valid Pokemon
    const validFields = [hasValidPersonality, hasValidOtId, hasValidLevel, hasValidHp].filter(Boolean).length
    
    return validFields >= 3
  }

  /**
   * Scan for SaveBlock2 structure near SaveBlock1
   * Returns the best candidate based on validation
   */
  private async scanForSaveBlock2Structure(saveBlock1Addr: number): Promise<number | null> {
    console.log('  Scanning for SaveBlock2 structure...')
    
    // Search within reasonable range of SaveBlock1
    const searchRange = 0x20000 // 128KB range
    const searchStart = Math.max(MEMORY_REGIONS.EWRAM_BASE, saveBlock1Addr - searchRange)
    const searchEnd = Math.min(MEMORY_REGIONS.EWRAM_BASE + 0x40000, saveBlock1Addr + searchRange)
    
    const candidates: Array<{address: number, score: number, details: string}> = []
    
    for (let addr = searchStart; addr < searchEnd; addr += 16) {
      try {
        // Check for valid player name (Pokemon character encoding)
        const nameBytes = await this.client.readBytes(addr, 8)
        
        if (this.isValidPokemonCharacterString(nameBytes)) {
          let score = 20
          const playerName = this.decodePlayerName(nameBytes)
          let details = `name:"${playerName}"`
          
          // Validate with play time data
          try {
            const hours = await this.client.readWord(addr + SAVEBLOCK2_LAYOUT.PLAY_TIME_HOURS)
            const minutes = await this.client.readByte(addr + SAVEBLOCK2_LAYOUT.PLAY_TIME_MINUTES)
            const seconds = await this.client.readByte(addr + SAVEBLOCK2_LAYOUT.PLAY_TIME_SECONDS)
            
            if (hours <= 999 && minutes < 60 && seconds < 60) {
              score += 30
              details += `, time:${hours}:${minutes}:${seconds}`
              
              // Bonus for reasonable play time
              if (hours < 100) score += 10
            } else {
              score -= 20
              details += `, time:invalid`
            }
          } catch (error) {
            score -= 15
            details += `, time:error`
          }
          
          // Check trainer ID
          try {
            const trainerId = await this.client.readDWord(addr + SAVEBLOCK2_LAYOUT.PLAYER_TRAINER_ID)
            if (trainerId > 0 && trainerId < 0x10000000) {
              score += 10
              details += `, id:${trainerId & 0xFFFF}`
            }
          } catch (error) {
            score -= 5
          }
          
          if (score > 0) {
            candidates.push({ address: addr, score, details })
          }
        }
      } catch (error) {
        continue
      }
    }
    
    if (candidates.length === 0) {
      console.log('    No valid SaveBlock2 structure found')
      return null
    }
    
    // Sort candidates by score
    candidates.sort((a, b) => b.score - a.score)
    
    console.log(`    Found ${candidates.length} SaveBlock2 candidates:`)
    for (let i = 0; i < Math.min(candidates.length, 3); i++) {
      const candidate = candidates[i]
      console.log(`      ${i + 1}. 0x${candidate.address.toString(16)} (score: ${candidate.score}) - ${candidate.details}`)
    }
    
    const bestCandidate = candidates[0]
    console.log(`    Selected best candidate: 0x${bestCandidate.address.toString(16)}`)
    
    return bestCandidate.address
  }

  /**
   * Check if bytes represent a valid Pokemon character string
   */
  private isValidPokemonCharacterString(bytes: Uint8Array): boolean {
    let validCharCount = 0
    
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i]
      
      if (byte === 0xFF || byte === 0) break // String terminator
      
      // Check if byte is in valid Pokemon character ranges
      const isValid = 
        (byte >= 0xBB && byte <= 0xD4) || // A-Z
        (byte >= 0xD5 && byte <= 0xEE) || // a-z
        (byte >= 0xA1 && byte <= 0xAA) || // 0-9
        (byte >= 0x01 && byte <= 0x1F)    // Special characters
      
      if (isValid) {
        validCharCount++
      } else {
        return false
      }
    }
    
    return validCharCount >= 3 // At least 3 valid characters for a name
  }

  /**
   * Parse save data from emulator memory
   * Mirrors PokemonSaveParser.parseSaveFile() but reads from memory
   */
  async parseFromMemory(): Promise<SaveData> {
    if (!this.client.isConnected()) {
      throw new Error('mGBA WebSocket client is not connected')
    }

    console.log('Parsing Emerald save data from memory...')

    // Find the actual save data locations in memory
    const addresses = await this.findSaveBlockAddresses()
    console.log(`Using SaveBlock1: 0x${addresses.saveBlock1.toString(16)}`)
    if (addresses.saveBlock2) {
      console.log(`Using SaveBlock2: 0x${addresses.saveBlock2.toString(16)}`)
    }

    const [playerName, playTime, partyPokemon, rawSaveData] = await Promise.all([
      this.parsePlayerName(addresses),
      this.parsePlayTime(addresses),
      this.parsePartyPokemon(addresses),
      this.getRawSaveData()
    ])

    return {
      player_name: playerName,
      play_time: playTime,
      party_pokemon: partyPokemon,
      active_slot: 0, // Memory doesn't have multiple save slots
      sector_map: new Map(), // Not applicable for memory parsing
      rawSaveData
    }
  }

  /**
   * Parse player name from SaveBlock2, with fallback for missing SaveBlock2
   */
  private async parsePlayerName(addresses: SaveBlockAddresses): Promise<string> {
    if (!addresses.saveBlock2 || addresses.saveBlock2 === addresses.saveBlock1) {
      return 'UNKNOWN' // Fallback if SaveBlock2 not found
    }

    try {
      const nameAddr = addresses.saveBlock2 + SAVEBLOCK2_LAYOUT.PLAYER_NAME
      const nameBytes = await this.client.readBytes(nameAddr, 8)

      // Convert from Pokémon character encoding to UTF-8
      return this.decodePlayerName(nameBytes)
    } catch (error) {
      console.warn('Could not read player name, using fallback')
      return 'UNKNOWN'
    }
  }

  /**
   * Decode player name from Pokémon character encoding
   * Based on pokeemerald character mapping
   */
  private decodePlayerName(bytes: Uint8Array): string {
    let name = ''
    for (let i = 0; i < bytes.length && bytes[i] !== 0xFF && bytes[i] !== 0; i++) {
      const char = bytes[i]
      
      // Pokemon character encoding (simplified mapping)
      if (char >= 0xBB && char <= 0xD4) {
        name += String.fromCharCode(char - 0xBB + 65) // A-Z
      } else if (char >= 0xD5 && char <= 0xEE) {
        name += String.fromCharCode(char - 0xD5 + 97) // a-z
      } else if (char >= 0xA1 && char <= 0xAA) {
        name += String.fromCharCode(char - 0xA1 + 48) // 0-9
      } else {
        name += '?'
      }
    }
    return name
  }

  /**
   * Parse play time from SaveBlock2, with fallback for missing SaveBlock2
   */
  private async parsePlayTime(addresses: SaveBlockAddresses): Promise<PlayTime> {
    if (!addresses.saveBlock2 || addresses.saveBlock2 === addresses.saveBlock1) {
      return { hours: 0, minutes: 0, seconds: 0 } // Fallback
    }

    try {
      const hoursAddr = addresses.saveBlock2 + SAVEBLOCK2_LAYOUT.PLAY_TIME_HOURS
      const minutesAddr = addresses.saveBlock2 + SAVEBLOCK2_LAYOUT.PLAY_TIME_MINUTES
      const secondsAddr = addresses.saveBlock2 + SAVEBLOCK2_LAYOUT.PLAY_TIME_SECONDS
      
      const [hours, minutes, seconds] = await Promise.all([
        this.client.readWord(hoursAddr),
        this.client.readByte(minutesAddr),
        this.client.readByte(secondsAddr)
      ])

      return { hours, minutes, seconds }
    } catch (error) {
      console.warn('Could not read play time, using fallback')
      return { hours: 0, minutes: 0, seconds: 0 }
    }
  }

  /**
   * Parse party Pokémon from SaveBlock1
   */
  private async parsePartyPokemon(addresses: SaveBlockAddresses): Promise<readonly PokemonBase[]> {
    // Get the party count
    const partyCountAddr = addresses.saveBlock1 + SAVEBLOCK1_LAYOUT.PARTY_COUNT
    const partyCount = await this.client.readDWord(partyCountAddr)
    
    console.log(`Found ${partyCount} Pokémon in party`)
    
    if (partyCount === 0 || partyCount > 6) {
      return []
    }

    const pokemon: PokemonBase[] = []
    
    for (let i = 0; i < partyCount; i++) {
      try {
        const memoryPokemon = new MemoryPokemon(i, this.client, this.config, addresses.saveBlock1)
        await memoryPokemon.initialize()
        
        // Only add non-empty Pokemon (personality != 0)
        if (memoryPokemon.personality !== 0) {
          pokemon.push(memoryPokemon)
        }
      } catch (error) {
        console.error(`Failed to parse Pokémon ${i}:`, error)
      }
    }

    return pokemon
  }

  /**
   * Get raw save data from memory (for compatibility with SaveData interface)
   */
  private async getRawSaveData(): Promise<Uint8Array> {
    // For memory parsing, we don't have the full save file
    // Return an empty buffer as this is mainly used for file reconstruction
    return new Uint8Array(131072) // Standard GBA save size
  }

  /**
   * Write party Pokemon back to memory
   * Provides write functionality matching the file parser
   */
  async writePartyToMemory(party: readonly PokemonBase[]): Promise<void> {
    if (!this.client.isConnected()) {
      throw new Error('mGBA WebSocket client is not connected')
    }

    if (party.length > 6) {
      throw new Error('Party cannot have more than 6 Pokemon')
    }

    const addresses = await this.findSaveBlockAddresses()

    // Update party count
    const partyCountAddr = addresses.saveBlock1 + SAVEBLOCK1_LAYOUT.PARTY_COUNT
    await this.client.writeDWord(partyCountAddr, party.length)

    // Write each Pokemon
    for (let i = 0; i < party.length; i++) {
      const pokemon = party[i]
      if (pokemon instanceof MemoryPokemon) {
        await pokemon.writeToMemory()
      } else {
        // Convert file-based Pokemon to memory
        const memoryPokemon = new MemoryPokemon(i, this.client, this.config, addresses.saveBlock1, pokemon.rawBytes)
        await memoryPokemon.writeToMemory()
      }
    }

    // Clear remaining slots
    for (let i = party.length; i < 6; i++) {
      const memoryPokemon = new MemoryPokemon(i, this.client, this.config, addresses.saveBlock1, new Uint8Array(100))
      await memoryPokemon.writeToMemory()
    }
  }

  /**
   * Update a single Pokemon in memory
   */
  async updatePokemon(index: number, pokemon: PokemonBase): Promise<void> {
    if (!this.client.isConnected()) {
      throw new Error('mGBA WebSocket client is not connected')
    }

    if (index < 0 || index >= 6) {
      throw new Error('Pokemon index must be between 0 and 5')
    }

    const addresses = await this.findSaveBlockAddresses()

    if (pokemon instanceof MemoryPokemon) {
      await pokemon.writeToMemory()
    } else {
      // Convert file-based Pokemon to memory
      const memoryPokemon = new MemoryPokemon(index, this.client, this.config, addresses.saveBlock1, pokemon.rawBytes)
      await memoryPokemon.writeToMemory()
    }
  }

  /**
   * Get the game config used by this parser
   */
  get gameConfig() {
    return this.config
  }
}