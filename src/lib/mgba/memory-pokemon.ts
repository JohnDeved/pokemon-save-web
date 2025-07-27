/**
 * Memory-based Pokemon implementation that reads/writes data from mGBA emulator memory
 * Extends PokemonBase to provide the same interface as file-based parsing
 * 
 * This class provides 100% compatibility with the file parser by:
 * - Extending PokemonBase with the same data structure
 * - Implementing all getter/setter methods  
 * - Providing write functionality to update memory
 * - Caching memory data for performance
 */

import { PokemonBase } from '../parser/core/PokemonBase'
import type { GameConfig } from '../parser/core/types'
import type { MgbaWebSocketClient } from './websocket-client'

/**
 * Parsed Pokemon data structure from memory
 * Matches the mGBA pokemon.lua Generation3En data format
 */
interface ParsedPokemonData {
  // Unencrypted data
  personality: number
  otId: number
  nickname: string
  language: number
  isBadEgg: boolean
  hasSpecies: boolean
  isEgg: boolean
  otName: string
  markings: number
  
  // Decrypted substructure data
  species: number
  heldItem: number
  experience: number
  ppBonuses: number
  friendship: number
  moves: number[]
  pp: number[]
  
  // EVs and Condition
  hpEV: number
  attackEV: number
  defenseEV: number
  speedEV: number
  spAttackEV: number
  spDefenseEV: number
  cool: number
  beauty: number
  cute: number
  smart: number
  tough: number
  sheen: number
  
  // Miscellaneous
  pokerus: number
  metLocation: number
  metLevel: number
  metGame: number
  pokeball: number
  otGender: number
  hpIV: number
  attackIV: number
  defenseIV: number
  speedIV: number
  spAttackIV: number
  spDefenseIV: number
  altAbility: number
  ribbons: number
  
  // Party stats
  status: number
  level: number
  mail: number
  currentHp: number
  maxHp: number
  attack: number
  defense: number
  speed: number
  spAttack: number
  spDefense: number
}

/**
 * MemoryPokemon class that extends PokemonBase for full compatibility
 * Uses memory data but provides the same interface as file-based Pokemon
 */
export class MemoryPokemon extends PokemonBase {
  private parsedData: ParsedPokemonData
  private memoryAddress: number
  private slotIndex: number
  private wsClient: MgbaWebSocketClient

  constructor(
    data: Uint8Array,
    config: GameConfig,
    client: MgbaWebSocketClient,
    memoryAddress: number,
    slotIndex: number,
    parsedData: ParsedPokemonData
  ) {
    // Call parent constructor with the raw bytes
    super(data, config)
    
    this.parsedData = parsedData
    this.memoryAddress = memoryAddress
    this.slotIndex = slotIndex
    this.wsClient = client
  }

  // Override getter methods to use parsed memory data for better performance
  // and to ensure we're reading the correct decrypted values

  get speciesId(): number {
    return this.parsedData.species
  }

  get nickname(): string {
    return this.parsedData.nickname
  }

  get otName(): string {
    return this.parsedData.otName
  }

  get level(): number {
    return this.parsedData.level
  }

  get currentHp(): number {
    return this.parsedData.currentHp
  }

  get maxHp(): number {
    return this.parsedData.maxHp
  }

  get attack(): number {
    return this.parsedData.attack
  }

  get defense(): number {
    return this.parsedData.defense
  }

  get speed(): number {
    return this.parsedData.speed
  }

  get spAttack(): number {
    return this.parsedData.spAttack
  }

  get spDefense(): number {
    return this.parsedData.spDefense
  }

  get personality(): number {
    return this.parsedData.personality
  }

  get otId(): number {
    return this.parsedData.otId
  }

  get experience(): number {
    return this.parsedData.experience
  }

  get friendship(): number {
    return this.parsedData.friendship
  }

  get isEgg(): boolean {
    return this.parsedData.isEgg
  }

  get status(): number {
    return this.parsedData.status
  }

  // Move getters
  get move1(): number {
    return this.parsedData.moves[0] || 0
  }

  get move2(): number {
    return this.parsedData.moves[1] || 0
  }

  get move3(): number {
    return this.parsedData.moves[2] || 0
  }

  get move4(): number {
    return this.parsedData.moves[3] || 0
  }

  // PP getters
  get pp1(): number {
    return this.parsedData.pp[0] || 0
  }

  get pp2(): number {
    return this.parsedData.pp[1] || 0
  }

  get pp3(): number {
    return this.parsedData.pp[2] || 0
  }

  get pp4(): number {
    return this.parsedData.pp[3] || 0
  }

  // EV getters
  get hpEV(): number {
    return this.parsedData.hpEV
  }

  get attackEV(): number {
    return this.parsedData.attackEV
  }

  get defenseEV(): number {
    return this.parsedData.defenseEV
  }

  get speedEV(): number {
    return this.parsedData.speedEV
  }

  get spAttackEV(): number {
    return this.parsedData.spAttackEV
  }

  get spDefenseEV(): number {
    return this.parsedData.spDefenseEV
  }

  // IV getters
  get hpIV(): number {
    return this.parsedData.hpIV
  }

  get attackIV(): number {
    return this.parsedData.attackIV
  }

  get defenseIV(): number {
    return this.parsedData.defenseIV
  }

  get speedIV(): number {
    return this.parsedData.speedIV
  }

  get spAttackIV(): number {
    return this.parsedData.spAttackIV
  }

  get spDefenseIV(): number {
    return this.parsedData.spDefenseIV
  }

  // Computed properties that match file parser interface
  get nature(): string {
    const natures = [
      'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty',
      'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax', 
      'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive',
      'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
      'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky'
    ]
    return natures[this.personality % 25]
  }

  get displayNature(): string {
    return this.nature
  }

  get otId_str(): string {
    return (this.otId & 0xFFFF).toString().padStart(5, '0')
  }

  get displayOtId(): string {
    return this.otId_str
  }

  get heldItem(): number {
    return this.parsedData.heldItem
  }

  // Provide access to memory-specific functionality
  get memoryAddressValue(): number {
    return this.memoryAddress
  }

  get slotIndexValue(): number {
    return this.slotIndex
  }

  /**
   * Write this Pokemon's current data back to memory
   * Allows for memory modifications to persist
   */
  async writeToMemory(): Promise<void> {
    if (!this.wsClient.isConnected()) {
      throw new Error('WebSocket client not connected')
    }

    // Write the current raw bytes back to memory
    // This preserves any modifications made to the Pokemon
    await this.wsClient.writeBytes(this.memoryAddress, this.data)
    console.log(`✅ Wrote Pokemon to memory at address 0x${this.memoryAddress.toString(16)}`)
  }

  /**
   * Update a specific stat in memory immediately
   */
  async updateStatInMemory(stat: 'currentHp' | 'maxHp' | 'attack' | 'defense' | 'speed' | 'spAttack' | 'spDefense', value: number): Promise<void> {
    const offsets = {
      currentHp: 86,
      maxHp: 88,
      attack: 90,
      defense: 92, 
      speed: 94,
      spAttack: 96,
      spDefense: 98
    }

    const offset = offsets[stat]
    if (offset === undefined) {
      throw new Error(`Unknown stat: ${stat}`)
    }

    await this.wsClient.writeWord(this.memoryAddress + offset, value)
    
    // Update cached data
    this.parsedData[stat] = value
    
    console.log(`✅ Updated ${stat} to ${value} in memory`)
  }

  /**
   * Update the Pokemon's level in memory and recalculate stats if needed
   */
  async updateLevelInMemory(newLevel: number): Promise<void> {
    if (newLevel < 1 || newLevel > 100) {
      throw new Error(`Invalid level: ${newLevel}. Must be 1-100.`)
    }

    await this.wsClient.writeByte(this.memoryAddress + 84, newLevel)
    
    // Update cached data
    this.parsedData.level = newLevel
    
    console.log(`✅ Updated level to ${newLevel} in memory`)
  }

  /**
   * Get a summary of this Pokemon for debugging
   */
  getDebugSummary(): string {
    return `Pokemon ${this.slotIndex}: ${this.nickname} (${this.speciesId}) Level ${this.level} - HP: ${this.currentHp}/${this.maxHp} - Memory: 0x${this.memoryAddress.toString(16)}`
  }

  /**
   * Initialize method for backwards compatibility
   * (No longer needed since we pass parsed data to constructor)
   */
  async initialize(): Promise<void> {
    // This method is kept for compatibility but does nothing
    // since all data is now parsed in the constructor
    return Promise.resolve()
  }
}