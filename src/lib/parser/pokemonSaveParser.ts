/**
 * Pokemon Save File Parser
 * TypeScript port of pokemon_save_parser.py with modern browser-compatible features
 */

import {
  CONSTANTS,
  createPokemonMoves,
  createPokemonEVs,
  createPokemonIVs,
  createPokemonStats,
} from './types.js';

import type {
  PlayTimeData,
  PokemonMoves,
  PokemonEVs,
  PokemonIVs,
  PokemonStats,
  RawPokemonData,
  ParsedPokemonData,
  SectorInfo,
  SaveData,
} from './types.js';

/**
 * DataView wrapper for little-endian operations with bounds checking
 */
class SafeDataView {
  private view: DataView;

  constructor(buffer: ArrayBuffer, byteOffset = 0, byteLength?: number) {
    this.view = new DataView(buffer, byteOffset, byteLength);
  }

  getUint8(byteOffset: number): number {
    if (byteOffset >= this.view.byteLength) {
      throw new RangeError(`Offset ${byteOffset} out of bounds`);
    }
    return this.view.getUint8(byteOffset);
  }

  getUint16(byteOffset: number, littleEndian = true): number {
    if (byteOffset + 1 >= this.view.byteLength) {
      throw new RangeError(`Offset ${byteOffset} out of bounds`);
    }
    return this.view.getUint16(byteOffset, littleEndian);
  }

  getUint32(byteOffset: number, littleEndian = true): number {
    if (byteOffset + 3 >= this.view.byteLength) {
      throw new RangeError(`Offset ${byteOffset} out of bounds`);
    }
    return this.view.getUint32(byteOffset, littleEndian);
  }

  getBytes(byteOffset: number, length: number): Uint8Array {
    if (byteOffset + length > this.view.byteLength) {
      throw new RangeError(`Range ${byteOffset}:${byteOffset + length} out of bounds`);
    }
    return new Uint8Array(this.view.buffer, this.view.byteOffset + byteOffset, length);
  }

  get byteLength(): number {
    return this.view.byteLength;
  }
}

/**
 * Parses raw Pokemon data from save file bytes into structured format
 */
class PokemonDataParser {
  /**
   * Parse raw Pokemon data from a byte array
   */
  static parsePokemonData(data: Uint8Array): ParsedPokemonData {
    if (data.length < 104) { // PARTY_POKEMON_SIZE
      throw new Error(`Insufficient data for Pokemon: ${data.length} bytes`);
    }

    const view = new SafeDataView(data.buffer, data.byteOffset, data.byteLength);
    
    const rawData: RawPokemonData = {
      personality: view.getUint32(0x00),
      otId: view.getUint32(0x04),
      nickname: view.getBytes(0x08, 10),
      otName: view.getBytes(0x14, 7),
      currentHp: view.getUint16(0x23),
      speciesId: view.getUint16(0x28),
      item: view.getUint16(0x2A),
      move1: view.getUint16(0x34),
      move2: view.getUint16(0x36),
      move3: view.getUint16(0x38),
      move4: view.getUint16(0x3A),
      pp1: view.getUint8(0x3C),
      pp2: view.getUint8(0x3D),
      pp3: view.getUint8(0x3E),
      pp4: view.getUint8(0x3F),
      hpEV: view.getUint8(0x40),
      atkEV: view.getUint8(0x41),
      defEV: view.getUint8(0x42),
      speEV: view.getUint8(0x43),
      spaEV: view.getUint8(0x44),
      spdEV: view.getUint8(0x45),
      ivData: view.getUint32(0x50),
      level: view.getUint8(0x58),
      maxHp: view.getUint16(0x5A),
      attack: view.getUint16(0x5C),
      defense: view.getUint16(0x5E),
      speed: view.getUint16(0x60),
      spAttack: view.getUint16(0x62),
      spDefense: view.getUint16(0x64),
      raw_bytes: new Uint8Array(data),
    };

    return {
      ...rawData,
      otId_str: this.formatOtId(rawData.otId),
      moves_data: this.extractMoves(rawData),
      evs: this.extractEVsArray(rawData),
      evs_structured: this.extractEVsStructured(rawData),
      ivs: this.extractIVsArray(rawData.ivData),
      ivs_structured: this.extractIVsStructured(rawData.ivData),
      stats_structured: this.extractStatsStructured(rawData),
    };
  }

  private static formatOtId(otId: number): string {
    return (otId & 0xFFFF).toString().padStart(5, '0');
  }

  private static extractMoves(data: RawPokemonData): PokemonMoves {
    return createPokemonMoves(
      data.move1, data.move2, data.move3, data.move4,
      data.pp1, data.pp2, data.pp3, data.pp4
    );
  }

  private static extractEVsArray(data: RawPokemonData): readonly number[] {
    return [data.hpEV, data.atkEV, data.defEV, data.speEV, data.spaEV, data.spdEV];
  }

  private static extractEVsStructured(data: RawPokemonData): PokemonEVs {
    return createPokemonEVs(
      data.hpEV, data.atkEV, data.defEV,
      data.speEV, data.spaEV, data.spdEV
    );
  }

  private static extractIVsArray(ivData: number): readonly number[] {
    return Array.from({ length: 6 }, (_, i) => (ivData >>> (i * 5)) & 0x1F);
  }

  private static extractIVsStructured(ivData: number): PokemonIVs {
    const ivs = this.extractIVsArray(ivData);
    return createPokemonIVs(
      ivs[0], ivs[1], ivs[2], ivs[3], ivs[4], ivs[5]
    );
  }

  private static extractStatsStructured(data: RawPokemonData): PokemonStats {
    return createPokemonStats(
      data.maxHp, data.attack, data.defense,
      data.speed, data.spAttack, data.spDefense
    );
  }
}

/**
 * Main Pokemon Save File Parser class
 * Handles parsing of Pokemon Emerald save files in the browser
 */
export class PokemonSaveParser {
  private saveData: Uint8Array | null = null;
  private activeSlotStart = 0;
  private sectorMap = new Map<number, number>();
  private forcedSlot: 1 | 2 | undefined;

  constructor(forcedSlot?: 1 | 2) {
    this.forcedSlot = forcedSlot;
  }

  /**
   * Load save file data from a File or ArrayBuffer
   */
  async loadSaveFile(input: File | ArrayBuffer): Promise<void> {
    try {
      let buffer: ArrayBuffer;
      
      if (input instanceof File) {
        buffer = await input.arrayBuffer();
      } else {
        buffer = input;
      }
      
      this.saveData = new Uint8Array(buffer);
    } catch (error) {
      throw new Error(`Failed to load save file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get information about a specific sector
   */
  private getSectorInfo(sectorIndex: number): SectorInfo {
    if (!this.saveData) {
      throw new Error('Save data not loaded');
    }

    const footerOffset = (sectorIndex * CONSTANTS.SECTOR_SIZE) + CONSTANTS.SECTOR_SIZE - CONSTANTS.SECTOR_FOOTER_SIZE;
    
    if (footerOffset + CONSTANTS.SECTOR_FOOTER_SIZE > this.saveData.length) {
      return { id: -1, checksum: 0, counter: 0, valid: false };
    }

    try {
      const view = new SafeDataView(
        this.saveData.buffer,
        this.saveData.byteOffset + footerOffset,
        CONSTANTS.SECTOR_FOOTER_SIZE
      );

      const sectorId = view.getUint16(0);
      const checksum = view.getUint16(2);
      const signature = view.getUint32(4);
      const counter = view.getUint32(8);

      if (signature !== CONSTANTS.EMERALD_SIGNATURE) {
        return { id: sectorId, checksum, counter, valid: false };
      }

      const sectorStart = sectorIndex * CONSTANTS.SECTOR_SIZE;
      const sectorData = this.saveData.slice(sectorStart, sectorStart + CONSTANTS.SECTOR_DATA_SIZE);
      
      const calculatedChecksum = this.calculateSectorChecksum(sectorData);
      const valid = calculatedChecksum === checksum;

      return { id: sectorId, checksum, counter, valid };
    } catch {
      return { id: -1, checksum: 0, counter: 0, valid: false };
    }
  }

  /**
   * Determine which save slot is active based on sector counters
   */
  private determineActiveSlot(): void {
    if (this.forcedSlot !== undefined) {
      this.activeSlotStart = this.forcedSlot === 1 ? 0 : 14;
      return;
    }

    const getMaxCounter = (range: number[]): number => {
      const validCounters = range
        .map(i => this.getSectorInfo(i))
        .filter(info => info.valid)
        .map(info => info.counter);
      
      return validCounters.length > 0 ? Math.max(...validCounters) : 0;
    };

    const slot1Counter = getMaxCounter(Array.from({ length: 18 }, (_, i) => i));
    const slot2Counter = getMaxCounter(Array.from({ length: 18 }, (_, i) => i + 14));

    this.activeSlotStart = slot2Counter >= slot1Counter ? 14 : 0;
  }

  /**
   * Build a mapping of sector IDs to physical sector indices
   */
  private buildSectorMap(): void {
    this.sectorMap.clear();

    const sectorRange = this.forcedSlot !== undefined
      ? (this.forcedSlot === 1 
          ? Array.from({ length: 18 }, (_, i) => i)
          : Array.from({ length: 18 }, (_, i) => i + 14))
      : Array.from({ length: 18 }, (_, i) => i + this.activeSlotStart);

    for (const i of sectorRange) {
      const sectorInfo = this.getSectorInfo(i);
      if (sectorInfo.valid) {
        this.sectorMap.set(sectorInfo.id, i);
      }
    }
  }

  /**
   * Extract SaveBlock1 data from sectors 1-4
   */
  private extractSaveblock1(): Uint8Array {
    if (!this.saveData) {
      throw new Error('Save data not loaded');
    }

    const saveblock1Sectors = [1, 2, 3, 4].filter(id => this.sectorMap.has(id));
    if (saveblock1Sectors.length === 0) {
      throw new Error('No SaveBlock1 sectors found');
    }

    const saveblock1Data = new Uint8Array(CONSTANTS.SAVEBLOCK1_SIZE);
    
    for (const sectorId of saveblock1Sectors) {
      const sectorIdx = this.sectorMap.get(sectorId)!;
      const startOffset = sectorIdx * CONSTANTS.SECTOR_SIZE;
      const sectorData = this.saveData.slice(startOffset, startOffset + CONSTANTS.SECTOR_DATA_SIZE);
      const chunkOffset = (sectorId - 1) * CONSTANTS.SECTOR_DATA_SIZE;
      
      saveblock1Data.set(
        sectorData.slice(0, CONSTANTS.SECTOR_DATA_SIZE),
        chunkOffset
      );
    }

    return saveblock1Data;
  }

  /**
   * Extract SaveBlock2 data from sector 0
   */
  private extractSaveblock2(): Uint8Array {
    if (!this.saveData) {
      throw new Error('Save data not loaded');
    }

    if (!this.sectorMap.has(0)) {
      throw new Error('SaveBlock2 sector (ID 0) not found');
    }

    const sectorIdx = this.sectorMap.get(0)!;
    const startOffset = sectorIdx * CONSTANTS.SECTOR_SIZE;
    return this.saveData.slice(startOffset, startOffset + CONSTANTS.SECTOR_DATA_SIZE);
  }

  /**
   * Parse party Pokemon from SaveBlock1 data
   */
  private parsePartyPokemon(saveblock1Data: Uint8Array): ParsedPokemonData[] {
    const partyPokemon: ParsedPokemonData[] = [];

    for (let slot = 0; slot < CONSTANTS.MAX_PARTY_SIZE; slot++) {
      const offset = CONSTANTS.PARTY_START_OFFSET + slot * CONSTANTS.PARTY_POKEMON_SIZE;
      const data = saveblock1Data.slice(offset, offset + CONSTANTS.PARTY_POKEMON_SIZE);

      if (data.length < CONSTANTS.PARTY_POKEMON_SIZE) {
        break;
      }

      try {
        const pokemon = PokemonDataParser.parsePokemonData(data);
        
        // Check if Pokemon slot is empty (species ID = 0)
        if (pokemon.speciesId === 0) {
          break;
        }

        partyPokemon.push(pokemon);
      } catch (error) {
        console.warn(`Failed to parse Pokemon at slot ${slot}:`, error);
        break;
      }
    }

    return partyPokemon;
  }

  /**
   * Parse player name from SaveBlock2 data
   */
  private parsePlayerName(saveblock2Data: Uint8Array): string {
    const playerNameBytes = saveblock2Data.slice(0, 8);
    return Array.from(playerNameBytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Parse play time from SaveBlock2 data
   */
  private parsePlayTime(saveblock2Data: Uint8Array): PlayTimeData {
    const view = new SafeDataView(saveblock2Data.buffer, saveblock2Data.byteOffset);
    
    return {
      hours: view.getUint32(0x10), // playTimeHours offset
      minutes: view.getUint8(0x14), // playTimeMinutes offset
      seconds: view.getUint8(0x15), // playTimeSeconds offset
    };
  }

  /**
   * Calculate checksum for a sector's data
   */
  private calculateSectorChecksum(sectorData: Uint8Array): number {
    if (sectorData.length < CONSTANTS.SECTOR_DATA_SIZE) {
      return 0;
    }

    let checksum = 0;
    const view = new SafeDataView(sectorData.buffer, sectorData.byteOffset);

    for (let i = 0; i < CONSTANTS.SECTOR_DATA_SIZE; i += 4) {
      if (i + 4 <= sectorData.length) {
        try {
          const value = view.getUint32(i);
          checksum += value;
        } catch {
          break;
        }
      }
    }

    return ((checksum >>> 16) + (checksum & 0xFFFF)) & 0xFFFF;
  }

  /**
   * Debug information about save slots
   */
  debugSaveSlots(): void {
    console.log('\n--- Save Slot Debug Information ---');
    
    const analyzeSlot = (range: number[], slotName: string): [number, number] => {
      const validSectors: number[] = [];
      const counters: number[] = [];
      
      for (const i of range) {
        const sectorInfo = this.getSectorInfo(i);
        if (sectorInfo.valid) {
          validSectors.push(i);
          counters.push(sectorInfo.counter);
          console.log(`  Sector ${i}: ID=${sectorInfo.id}, Counter=${sectorInfo.counter.toString(16).toUpperCase().padStart(8, '0')}`);
        }
      }
      
      const maxCounter = counters.length > 0 ? Math.max(...counters) : 0;
      console.log(`${slotName}: ${validSectors.length} valid sectors, max counter ${maxCounter.toString(16).toUpperCase().padStart(8, '0')}`);
      
      return [validSectors.length, maxCounter];
    };

    const [, slot1Counter] = analyzeSlot(Array.from({ length: 18 }, (_, i) => i), 'Slot 1 (sectors 0-17)');
    const [, slot2Counter] = analyzeSlot(Array.from({ length: 18 }, (_, i) => i + 14), 'Slot 2 (sectors 14-31)');
    
    const activeSlot = slot2Counter >= slot1Counter ? 14 : 0;
    console.log(`\nActive slot: ${activeSlot} (highest counter wins, slot 2 wins ties)`);
  }

  /**
   * Parse the complete save file and return structured data
   */
  async parseSaveFile(input: File | ArrayBuffer): Promise<SaveData> {
    await this.loadSaveFile(input);
    
    this.determineActiveSlot();
    this.buildSectorMap();
    
    const saveblock1Data = this.extractSaveblock1();
    const saveblock2Data = this.extractSaveblock2();
    
    const playerName = this.parsePlayerName(saveblock2Data);
    const partyPokemon = this.parsePartyPokemon(saveblock1Data);
    const playTime = this.parsePlayTime(saveblock2Data);
    
    return {
      party_pokemon: partyPokemon,
      player_name: playerName,
      play_time: playTime,
      active_slot: this.activeSlotStart,
      sector_map: new Map(this.sectorMap),
    };
  }
}

// Export for easier usage
export default PokemonSaveParser;
