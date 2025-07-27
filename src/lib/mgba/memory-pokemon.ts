/**
 * Memory-based Pokemon implementation that reads/writes data from mGBA emulator memory
 * Extends PokemonBase to provide the same interface as file-based parsing
 */

import { PokemonBase } from '../parser/core/PokemonBase'
import type { GameConfig } from '../parser/core/types'
import type { MgbaWebSocketClient } from './websocket-client'
import {
  getPartyPokemonAddress,
  POKEMON_STRUCT,
  SAVEBLOCK1_LAYOUT
} from './memory-mapping'

export class MemoryPokemon extends PokemonBase {
  private pokemonIndex: number
  private client: MgbaWebSocketClient
  private baseAddress: number

  constructor (
    pokemonIndex: number,
    client: MgbaWebSocketClient,
    config: GameConfig,
    saveBlock1Address: number,
    initialData?: Uint8Array
  ) {
    // Create initial data buffer if not provided
    const data = initialData || new Uint8Array(100) // Pokemon size is 100 bytes
    super(data, config)

    this.pokemonIndex = pokemonIndex
    this.client = client
    this.baseAddress = getPartyPokemonAddress(saveBlock1Address, pokemonIndex)
  }

  /**
   * Initialize by reading Pokemon data from memory
   */
  async initialize (): Promise<void> {
    if (!this.client.isConnected()) {
      throw new Error('mGBA WebSocket client is not connected')
    }

    // Read all Pokemon data from memory
    const pokemonData = await this.client.readBytes(this.baseAddress, 100)

    // Update our local data buffer
    this.data.set(pokemonData)
  }

  /**
   * Write current Pokemon data back to memory
   */
  async writeToMemory (): Promise<void> {
    if (!this.client.isConnected()) {
      throw new Error('mGBA WebSocket client is not connected')
    }

    // Write all Pokemon data to memory
    await this.client.writeBytes(this.baseAddress, this.data)
  }

  /**
   * Override setters to also write to memory when data is changed
   */

  override set maxHp (value: number) {
    super.maxHp = value
    this.writeSingleField('MAX_HP', value, 2).catch(console.error)
  }

  override set attack (value: number) {
    super.attack = value
    this.writeSingleField('ATTACK', value, 2).catch(console.error)
  }

  override set defense (value: number) {
    super.defense = value
    this.writeSingleField('DEFENSE', value, 2).catch(console.error)
  }

  override set speed (value: number) {
    super.speed = value
    this.writeSingleField('SPEED', value, 2).catch(console.error)
  }

  override set spAttack (value: number) {
    super.spAttack = value
    this.writeSingleField('SP_ATTACK', value, 2).catch(console.error)
  }

  override set spDefense (value: number) {
    super.spDefense = value
    this.writeSingleField('SP_DEFENSE', value, 2).catch(console.error)
  }

  override set hpEV (value: number) {
    super.hpEV = value
    this.writeToMemory().catch(console.error) // EVs require substruct update
  }

  override set atkEV (value: number) {
    super.atkEV = value
    this.writeToMemory().catch(console.error)
  }

  override set defEV (value: number) {
    super.defEV = value
    this.writeToMemory().catch(console.error)
  }

  override set speEV (value: number) {
    super.speEV = value
    this.writeToMemory().catch(console.error)
  }

  override set spaEV (value: number) {
    super.spaEV = value
    this.writeToMemory().catch(console.error)
  }

  override set spdEV (value: number) {
    super.spdEV = value
    this.writeToMemory().catch(console.error)
  }

  override set ivs (values: readonly number[]) {
    super.ivs = values
    this.writeToMemory().catch(console.error) // IVs require substruct update
  }

  override set natureRaw (value: number) {
    super.natureRaw = value
    this.writeToMemory().catch(console.error) // Nature changes personality, affects encryption
  }

  /**
   * Write a single field to memory (for simple non-encrypted fields)
   */
  private async writeSingleField (field: keyof typeof POKEMON_STRUCT, value: number, bytes: number): Promise<void> {
    if (!this.client.isConnected()) return

    const address = this.baseAddress + POKEMON_STRUCT[field]

    switch (bytes) {
      case 1:
        await this.client.writeByte(address, value & 0xFF)
        break
      case 2:
        await this.client.writeWord(address, value & 0xFFFF)
        break
      case 4:
        await this.client.writeDWord(address, value)
        break
      default:
        throw new Error(`Unsupported field size: ${bytes} bytes`)
    }
  }

  /**
   * Refresh data from memory (useful after external changes)
   */
  async refreshFromMemory (): Promise<void> {
    await this.initialize()
  }

  /**
   * Get the memory address for this Pokemon
   */
  get memoryAddress (): number {
    return this.baseAddress
  }

  /**
   * Get the Pokemon index in party
   */
  get partyIndex (): number {
    return this.pokemonIndex
  }
}