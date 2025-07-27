/**
 * Memory-based Pokemon implementation that reads/writes data from mGBA emulator memory
 * Extends PokemonBase to provide the same interface as file-based parsing
 * Updated to work with improved memory parser architecture
 */

import { PokemonBase } from '../parser/core/PokemonBase'
import type { GameConfig } from '../parser/core/types'
import type { MgbaWebSocketClient } from './websocket-client'
import { POKEMON_STRUCT } from './memory-mapping'

interface PokemonMemoryData {
  personality: number
  otId: number
  nickname: string
  otName: string
  species: number
  item: number
  experience: number
  moves: number[]
  ppBonuses: number
  friendship: number
  evs: {
    hp: number, attack: number, defense: number, speed: number, spAttack: number, spDefense: number
  }
  condition: {
    coolness: number, beauty: number, cuteness: number, smartness: number, toughness: number, feel: number
  }
  pokerus: number
  metLocation: number
  metLevel: number
  metGame: number
  pokeball: number
  otGender: boolean
  ivs: {
    hp: number, attack: number, defense: number, speed: number, spAttack: number, spDefense: number
  }
  isEgg: boolean
  altAbility: boolean
  ribbons: number
  status: number
  level: number
  currentHp: number
  maxHp: number
  attack: number
  defense: number
  speed: number
  spAttack: number
  spDefense: number
}

export class MemoryPokemon extends PokemonBase {
  private client: MgbaWebSocketClient
  private memoryAddress: number
  private memoryData: PokemonMemoryData

  constructor (
    client: MgbaWebSocketClient,
    memoryAddress: number,
    memoryData: PokemonMemoryData,
    config: GameConfig
  ) {
    // Create a minimal data buffer - actual data comes from memory
    const data = new Uint8Array(100)
    super(data, config)

    this.client = client
    this.memoryAddress = memoryAddress
    this.memoryData = memoryData
  }

  /**
   * Override getters to return data from memory instead of file buffer
   */
  
  get name(): string {
    return this.memoryData.nickname
  }

  get species(): number {
    return this.memoryData.species
  }

  get personality(): number {
    return this.memoryData.personality
  }

  get trainerId(): number {
    return this.memoryData.otId & 0xFFFF
  }

  get secretId(): number {
    return (this.memoryData.otId >> 16) & 0xFFFF
  }

  get fullTrainerId(): number {
    return this.memoryData.otId
  }

  get trainerName(): string {
    return this.memoryData.otName
  }

  get level(): number {
    return this.memoryData.level
  }

  get experience(): number {
    return this.memoryData.experience
  }

  get heldItem(): number {
    return this.memoryData.item
  }

  get friendship(): number {
    return this.memoryData.friendship
  }

  get pokerus(): number {
    return this.memoryData.pokerus
  }

  get ballType(): number {
    return this.memoryData.pokeball
  }

  get metLevel(): number {
    return this.memoryData.metLevel
  }

  get metLocation(): number {
    return this.memoryData.metLocation
  }

  // Moves
  get moves(): number[] {
    return [...this.memoryData.moves]
  }

  // Stats
  get currentHp(): number {
    return this.memoryData.currentHp
  }

  get maxHp(): number {
    return this.memoryData.maxHp
  }

  get attack(): number {
    return this.memoryData.attack
  }

  get defense(): number {
    return this.memoryData.defense
  }

  get speed(): number {
    return this.memoryData.speed
  }

  get spAttack(): number {
    return this.memoryData.spAttack
  }

  get spDefense(): number {
    return this.memoryData.spDefense
  }

  // EVs
  get hpEv(): number {
    return this.memoryData.evs.hp
  }

  get attackEv(): number {
    return this.memoryData.evs.attack
  }

  get defenseEv(): number {
    return this.memoryData.evs.defense
  }

  get speedEv(): number {
    return this.memoryData.evs.speed
  }

  get spAttackEv(): number {
    return this.memoryData.evs.spAttack
  }

  get spDefenseEv(): number {
    return this.memoryData.evs.spDefense
  }

  // IVs
  get hpIv(): number {
    return this.memoryData.ivs.hp
  }

  get attackIv(): number {
    return this.memoryData.ivs.attack
  }

  get defenseIv(): number {
    return this.memoryData.ivs.defense
  }

  get speedIv(): number {
    return this.memoryData.ivs.speed
  }

  get spAttackIv(): number {
    return this.memoryData.ivs.spAttack
  }

  get spDefenseIv(): number {
    return this.memoryData.ivs.spDefense
  }

  get altAbility(): boolean {
    return this.memoryData.altAbility
  }

  get isEgg(): boolean {
    return this.memoryData.isEgg
  }

  get statusCondition(): number {
    return this.memoryData.status
  }

  /**
   * Write functionality - update memory when properties are set
   */
  
  async setNickname(nickname: string): Promise<void> {
    // Encode string and write to memory
    const encodedName = this.encodeString(nickname, 10)
    await this.client.writeBytes(this.memoryAddress + POKEMON_STRUCT.NICKNAME, encodedName)
    this.memoryData.nickname = nickname
  }

  async setLevel(level: number): Promise<void> {
    await this.client.writeByte(this.memoryAddress + POKEMON_STRUCT.LEVEL, level)
    this.memoryData.level = level
  }

  async setCurrentHp(hp: number): Promise<void> {
    await this.client.writeWord(this.memoryAddress + POKEMON_STRUCT.CURRENT_HP, hp)
    this.memoryData.currentHp = hp
  }

  async setHeldItem(item: number): Promise<void> {
    // This requires updating the encrypted data section
    throw new Error('Setting held item requires encrypted data update - not yet implemented')
  }

  /**
   * Helper method to encode strings for Pokemon memory format
   */
  private encodeString(str: string, maxLength: number): Uint8Array {
    const encoded = new Uint8Array(maxLength)
    encoded.fill(0xFF) // Fill with terminator
    
    for (let i = 0; i < Math.min(str.length, maxLength - 1); i++) {
      // Simple ASCII encoding for now
      // TODO: Implement proper Pokemon character encoding
      encoded[i] = str.charCodeAt(i)
    }
    
    return encoded
  }

  /**
   * Debug method to get memory address
   */
  getMemoryAddress(): number {
    return this.memoryAddress
  }

  /**
   * Debug method to get all memory data
   */
  getMemoryData(): PokemonMemoryData {
    return { ...this.memoryData }
  }

  /**
   * Write current Pokemon data back to memory
   */
  async writeToMemory (): Promise<void> {
    // This would implement the write functionality
    // For now, throw an error to indicate it's not implemented
    throw new Error('Write functionality not yet implemented - needs encrypted data encoding')
  }
}