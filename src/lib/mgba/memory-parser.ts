/**
 * Memory-based Pokémon parser using mGBA WebSocket API
 * Mirrors the functionality of the save file parser but reads from emulator memory
 */

import type { SaveData, PlayTime } from '../parser/core/types'
import type { PokemonBase } from '../parser/core/PokemonBase'
import { VanillaConfig } from '../parser/games/vanilla/config'
import { MgbaWebSocketClient } from './websocket-client'
import { MemoryPokemon } from './memory-pokemon'
import { 
  EMERALD_SAVE_LAYOUT, 
  mapSaveOffsetToMemory
} from './memory-mapping'

export class EmeraldMemoryParser {
  private config: VanillaConfig

  constructor(private client: MgbaWebSocketClient) {
    this.config = new VanillaConfig()
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

    const [playerName, playTime, partyPokemon, rawSaveData] = await Promise.all([
      this.parsePlayerName(),
      this.parsePlayTime(),
      this.parsePartyPokemon(),
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
   * Parse player name from memory
   */
  private async parsePlayerName(): Promise<string> {
    const address = mapSaveOffsetToMemory(EMERALD_SAVE_LAYOUT.PLAYER_NAME)
    const nameBytes = await this.client.readBytes(address, 8)
    
    // Convert from Pokémon character encoding to UTF-8
    return this.decodePlayerName(nameBytes)
  }

  /**
   * Decode player name from Pokémon character encoding
   * This is a simplified version - real implementation would need full character mapping
   */
  private decodePlayerName(bytes: Uint8Array): string {
    let name = ''
    for (let i = 0; i < bytes.length && bytes[i] !== 0xFF; i++) {
      const char = bytes[i]
      if (char === 0) break
      
      // Simplified character mapping (A-Z, a-z range)
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
   * Parse play time from memory
   */
  private async parsePlayTime(): Promise<PlayTime> {
    const hoursAddress = mapSaveOffsetToMemory(EMERALD_SAVE_LAYOUT.PLAY_TIME_HOURS)
    const minutesAddress = mapSaveOffsetToMemory(EMERALD_SAVE_LAYOUT.PLAY_TIME_MINUTES)
    const secondsAddress = mapSaveOffsetToMemory(EMERALD_SAVE_LAYOUT.PLAY_TIME_SECONDS)
    
    const [hours, minutes, seconds] = await Promise.all([
      this.client.readWord(hoursAddress),
      this.client.readByte(minutesAddress),
      this.client.readByte(secondsAddress)
    ])

    return { hours, minutes, seconds }
  }

  /**
   * Parse party Pokémon from memory
   */
  private async parsePartyPokemon(): Promise<readonly PokemonBase[]> {
    // First get the party count
    const partyCountAddress = mapSaveOffsetToMemory(EMERALD_SAVE_LAYOUT.PARTY_COUNT)
    const partyCount = await this.client.readDWord(partyCountAddress)
    
    console.log(`Found ${partyCount} Pokémon in party`)
    
    if (partyCount === 0 || partyCount > 6) {
      return []
    }

    const pokemon: PokemonBase[] = []
    
    for (let i = 0; i < partyCount; i++) {
      try {
        const memoryPokemon = new MemoryPokemon(i, this.client, this.config)
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

    // Update party count
    const partyCountAddress = mapSaveOffsetToMemory(EMERALD_SAVE_LAYOUT.PARTY_COUNT)
    await this.client.writeDWord(partyCountAddress, party.length)

    // Write each Pokemon
    for (let i = 0; i < party.length; i++) {
      const pokemon = party[i]
      if (pokemon instanceof MemoryPokemon) {
        await pokemon.writeToMemory()
      } else {
        // Convert file-based Pokemon to memory
        const memoryPokemon = new MemoryPokemon(i, this.client, this.config, pokemon.rawBytes)
        await memoryPokemon.writeToMemory()
      }
    }

    // Clear remaining slots
    for (let i = party.length; i < 6; i++) {
      const memoryPokemon = new MemoryPokemon(i, this.client, this.config, new Uint8Array(100))
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

    if (pokemon instanceof MemoryPokemon) {
      await pokemon.writeToMemory()
    } else {
      // Convert file-based Pokemon to memory
      const memoryPokemon = new MemoryPokemon(index, this.client, this.config, pokemon.rawBytes)
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