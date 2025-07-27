/**
 * Memory-based Pokémon parser using mGBA WebSocket API
 * Mirrors the functionality of the save file parser but reads from emulator memory
 */

import type { SaveData, PokemonInstance, PlayTime } from '../parser/core/types'
import { MgbaWebSocketClient } from './websocket-client'
import { 
  EMERALD_SAVE_LAYOUT, 
  POKEMON_STRUCT, 
  POKEMON_SUBSTRUCT,
  getPartyPokemonAddress,
  getPokemonFieldAddress,
  mapSaveOffsetToMemory,
  getSubstructOrder,
  getNature,
  getGender
} from './memory-mapping'

export class EmeraldMemoryParser {
  constructor(private client: MgbaWebSocketClient) {}

  /**
   * Parse save data from emulator memory
   * Mirrors PokemonSaveParser.parseSaveFile() but reads from memory
   */
  async parseFromMemory(): Promise<SaveData> {
    if (!this.client.isConnected()) {
      throw new Error('mGBA WebSocket client is not connected')
    }

    console.log('Parsing Emerald save data from memory...')

    const [playerName, playTime, partyPokemon] = await Promise.all([
      this.parsePlayerName(),
      this.parsePlayTime(),
      this.parsePartyPokemon()
    ])

    return {
      player_name: playerName,
      play_time: playTime,
      party_pokemon: partyPokemon
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
   * Parse play time from memory
   */
  private async parsePlayTime(): Promise<PlayTime> {
    const hoursAddress = mapSaveOffsetToMemory(EMERALD_SAVE_LAYOUT.PLAY_TIME_HOURS)
    const minutesAddress = mapSaveOffsetToMemory(EMERALD_SAVE_LAYOUT.PLAY_TIME_MINUTES)
    
    const [hours, minutes] = await Promise.all([
      this.client.readWord(hoursAddress),
      this.client.readByte(minutesAddress)
    ])

    return { hours, minutes }
  }

  /**
   * Parse party Pokémon from memory
   */
  private async parsePartyPokemon(): Promise<PokemonInstance[]> {
    // First get the party count
    const partyCountAddress = mapSaveOffsetToMemory(EMERALD_SAVE_LAYOUT.PARTY_COUNT)
    const partyCount = await this.client.readDWord(partyCountAddress)
    
    console.log(`Found ${partyCount} Pokémon in party`)
    
    if (partyCount === 0 || partyCount > 6) {
      return []
    }

    const pokemon: PokemonInstance[] = []
    
    for (let i = 0; i < partyCount; i++) {
      try {
        const pokemonData = await this.parsePokemon(i)
        if (pokemonData) {
          pokemon.push(pokemonData)
        }
      } catch (error) {
        console.error(`Failed to parse Pokémon ${i}:`, error)
      }
    }

    return pokemon
  }

  /**
   * Parse a single Pokémon from memory
   */
  private async parsePokemon(index: number): Promise<PokemonInstance | null> {
    const pokemonAddress = getPartyPokemonAddress(index)
    
    // Read basic Pokemon data
    const [personality, otId, nickname, otName, level, currentHp, maxHp, attack, defense, speed, spAttack, spDefense] = await Promise.all([
      this.client.readDWord(getPokemonFieldAddress(pokemonAddress, 'PERSONALITY')),
      this.client.readDWord(getPokemonFieldAddress(pokemonAddress, 'OT_ID')),
      this.client.readBytes(getPokemonFieldAddress(pokemonAddress, 'NICKNAME'), 10),
      this.client.readBytes(getPokemonFieldAddress(pokemonAddress, 'OT_NAME'), 7),
      this.client.readByte(getPokemonFieldAddress(pokemonAddress, 'LEVEL')),
      this.client.readWord(getPokemonFieldAddress(pokemonAddress, 'CURRENT_HP')),
      this.client.readWord(getPokemonFieldAddress(pokemonAddress, 'MAX_HP')),
      this.client.readWord(getPokemonFieldAddress(pokemonAddress, 'ATTACK')),
      this.client.readWord(getPokemonFieldAddress(pokemonAddress, 'DEFENSE')),
      this.client.readWord(getPokemonFieldAddress(pokemonAddress, 'SPEED')),
      this.client.readWord(getPokemonFieldAddress(pokemonAddress, 'SP_ATTACK')),
      this.client.readWord(getPokemonFieldAddress(pokemonAddress, 'SP_DEFENSE'))
    ])

    // If personality is 0, this slot is empty
    if (personality === 0) {
      return null
    }

    // Read and decrypt the data section
    const encryptedData = await this.client.readBytes(getPokemonFieldAddress(pokemonAddress, 'DATA'), 48)
    const decryptedData = this.decryptPokemonData(encryptedData, personality, otId)
    
    // Parse decrypted substructures
    const substruct = this.parseSubstructures(decryptedData, personality)

    // Calculate derived values
    const nature = getNature(personality)
    const gender = getGender(personality, substruct.growth.species)
    const displayOtId = this.formatTrainerId(otId & 0xFFFF)

    return {
      // Basic identification
      speciesId: substruct.growth.species,
      nickname: this.decodePokemonName(nickname),
      level,
      
      // Stats
      currentHp,
      maxHp,
      attack,
      defense,
      speed,
      spAttack,
      spDefense,
      
      // Moves
      move1: substruct.attacks.move1,
      move2: substruct.attacks.move2,
      move3: substruct.attacks.move3,
      move4: substruct.attacks.move4,
      
      // PP
      pp1: substruct.attacks.pp1,
      pp2: substruct.attacks.pp2,
      pp3: substruct.attacks.pp3,
      pp4: substruct.attacks.pp4,
      
      // Trainer info
      otName: this.decodePokemonName(otName),
      otId_str: displayOtId,
      
      // Nature and personality
      nature,
      gender,
      personality,
      
      // Other data
      item: substruct.growth.item,
      experience: substruct.growth.experience,
      friendship: substruct.growth.friendship,
      
      // IVs (extracted from misc substructure)
      ivs: this.extractIVs(substruct.misc.ivs),
      
      // EVs
      evs: {
        hp: substruct.evsCondition.hpEv,
        attack: substruct.evsCondition.attackEv,
        defense: substruct.evsCondition.defenseEv,
        speed: substruct.evsCondition.speedEv,
        spAttack: substruct.evsCondition.spAttackEv,
        spDefense: substruct.evsCondition.spDefenseEv
      }
    }
  }

  /**
   * Decrypt Pokémon data using XOR encryption
   * Based on pokeemerald/src/pokemon.c - DecryptBoxPokemon
   */
  private decryptPokemonData(encryptedData: Uint8Array, personality: number, otId: number): Uint8Array {
    const key = personality ^ otId
    const decrypted = new Uint8Array(48)
    
    // Decrypt in 4-byte chunks
    for (let i = 0; i < 48; i += 4) {
      const encryptedDWord = 
        encryptedData[i] |
        (encryptedData[i + 1] << 8) |
        (encryptedData[i + 2] << 16) |
        (encryptedData[i + 3] << 24)
      
      const decryptedDWord = encryptedDWord ^ key
      
      decrypted[i] = decryptedDWord & 0xFF
      decrypted[i + 1] = (decryptedDWord >> 8) & 0xFF
      decrypted[i + 2] = (decryptedDWord >> 16) & 0xFF
      decrypted[i + 3] = (decryptedDWord >> 24) & 0xFF
    }
    
    return decrypted
  }

  /**
   * Parse the four substructures from decrypted Pokémon data
   */
  private parseSubstructures(data: Uint8Array, personality: number) {
    const order = getSubstructOrder(personality)
    const substructs = [
      data.slice(0, 12),   // Substructure 0
      data.slice(12, 24),  // Substructure 1
      data.slice(24, 36),  // Substructure 2
      data.slice(36, 48)   // Substructure 3
    ]

    // Reorder based on personality
    const orderedSubstructs = order.map(index => substructs[index])

    return {
      growth: this.parseGrowthSubstruct(orderedSubstructs[0]),
      attacks: this.parseAttacksSubstruct(orderedSubstructs[1]),
      evsCondition: this.parseEvsConditionSubstruct(orderedSubstructs[2]),
      misc: this.parseMiscSubstruct(orderedSubstructs[3])
    }
  }

  /**
   * Parse growth substructure
   */
  private parseGrowthSubstruct(data: Uint8Array) {
    return {
      species: data[0] | (data[1] << 8),
      item: data[2] | (data[3] << 8),
      experience: data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24),
      ppBonuses: data[8],
      friendship: data[9]
    }
  }

  /**
   * Parse attacks substructure
   */
  private parseAttacksSubstruct(data: Uint8Array) {
    return {
      move1: data[0] | (data[1] << 8),
      move2: data[2] | (data[3] << 8),
      move3: data[4] | (data[5] << 8),
      move4: data[6] | (data[7] << 8),
      pp1: data[8],
      pp2: data[9],
      pp3: data[10],
      pp4: data[11]
    }
  }

  /**
   * Parse EVs and condition substructure
   */
  private parseEvsConditionSubstruct(data: Uint8Array) {
    return {
      hpEv: data[0],
      attackEv: data[1],
      defenseEv: data[2],
      speedEv: data[3],
      spAttackEv: data[4],
      spDefenseEv: data[5],
      coolness: data[6],
      beauty: data[7],
      cuteness: data[8],
      smartness: data[9],
      toughness: data[10],
      ribCount: data[11]
    }
  }

  /**
   * Parse miscellaneous substructure
   */
  private parseMiscSubstruct(data: Uint8Array) {
    const ivs = data[5] | (data[6] << 8) | (data[7] << 16) | (data[8] << 24)
    return {
      pokerus: data[0],
      metLocation: data[1],
      metLevel: data[2] & 0x7F,
      metGame: data[3],
      pokeball: data[4] & 0x0F,
      otGender: (data[4] >> 7) & 1,
      ivs: ivs,
      ribbons: data[9] | (data[10] << 8) | (data[11] << 16)
    }
  }

  /**
   * Extract individual IVs from the packed IV value
   */
  private extractIVs(ivValue: number) {
    return {
      hp: ivValue & 0x1F,
      attack: (ivValue >> 5) & 0x1F,
      defense: (ivValue >> 10) & 0x1F,
      speed: (ivValue >> 15) & 0x1F,
      spAttack: (ivValue >> 20) & 0x1F,
      spDefense: (ivValue >> 25) & 0x1F
    }
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
   * Decode Pokémon nickname/OT name from character encoding
   */
  private decodePokemonName(bytes: Uint8Array): string {
    return this.decodePlayerName(bytes)
  }

  /**
   * Format trainer ID for display
   */
  private formatTrainerId(id: number): string {
    return id.toString().padStart(5, '0')
  }
}