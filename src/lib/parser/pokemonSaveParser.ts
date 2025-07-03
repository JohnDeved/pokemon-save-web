/**
 * Pokemon Save File Parser
 * TypeScript port of pokemon_save_parser.py with modern browser-compatible features
 */

import {
  CONSTANTS,
  createPokemonMoves,
  createMoveData,
} from './types.js';

import type {
  PlayTimeData,
  PokemonMoves,
  SectorInfo,
  SaveData,
  MoveData,
} from './types.js';

// Import character map for decoding text
import charMap from './pokemon_charmap.json';
import { bytesToGbaString, getPokemonNature, mapMoveToPokeId, mapSpeciesToPokeId, natureEffects, statStrings } from './utils';

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
export class PokemonData {
  private readonly view: SafeDataView;

  constructor(private readonly data: Uint8Array) {
    if (data.length < CONSTANTS.PARTY_POKEMON_SIZE) {
      throw new Error(`Insufficient data for Pokemon: ${data.length} bytes`);
    }
    this.view = new SafeDataView(data.buffer, data.byteOffset, data.byteLength);
  }

  get personality(): number { return this.view.getUint32(0x00); }
  get otId(): number { return this.view.getUint32(0x04); }
  get nicknameRaw(): Uint8Array { return this.view.getBytes(0x08, CONSTANTS.POKEMON_NICKNAME_LENGTH); }
  get otNameRaw(): Uint8Array { return this.view.getBytes(0x14, CONSTANTS.POKEMON_TRAINER_NAME_LENGTH); }
  get currentHp(): number { return this.view.getUint16(0x23); }
  get speciesId(): number { return mapSpeciesToPokeId(this.view.getUint16(0x28)); }
  get item(): number { return this.view.getUint16(0x2A); }
  get move1(): number { return mapMoveToPokeId(this.view.getUint16(0x34)); }
  get move2(): number { return mapMoveToPokeId(this.view.getUint16(0x36)); }
  get move3(): number { return mapMoveToPokeId(this.view.getUint16(0x38)); }
  get move4(): number { return mapMoveToPokeId(this.view.getUint16(0x3A)); }
  get pp1(): number { return this.view.getUint8(0x3C); }
  get pp2(): number { return this.view.getUint8(0x3D); }
  get pp3(): number { return this.view.getUint8(0x3E); }
  get pp4(): number { return this.view.getUint8(0x3F); }
  get hpEV(): number { return this.view.getUint8(0x40); }
  get atkEV(): number { return this.view.getUint8(0x41); }
  get defEV(): number { return this.view.getUint8(0x42); }
  get speEV(): number { return this.view.getUint8(0x43); }
  get spaEV(): number { return this.view.getUint8(0x44); }
  get spdEV(): number { return this.view.getUint8(0x45); }
  get ivData(): number { return this.view.getUint32(0x50); }
  get status(): number { return this.view.getUint8(0x57); }
  get level(): number { return this.view.getUint8(0x58); }
  get maxHp(): number { return this.view.getUint16(0x5A); }
  get attack(): number { return this.view.getUint16(0x5C); }
  get defense(): number { return this.view.getUint16(0x5E); }
  get speed(): number { return this.view.getUint16(0x60); }
  get spAttack(): number { return this.view.getUint16(0x62); }
  get spDefense(): number { return this.view.getUint16(0x64); }
  get rawBytes(): Uint8Array { return new Uint8Array(this.data); }

  // Computed properties
  get otId_str(): string {
    return (this.otId & 0xFFFF).toString().padStart(5, '0');
  }
  get nickname(): string {
    return bytesToGbaString(this.nicknameRaw);
  }
  get otName(): string {
    return bytesToGbaString(this.otNameRaw);
  }
  get nature(): string {
    return getPokemonNature(this.personality);
  }
  get natureModifiers(): { increased: number, decreased: number } {
    return natureEffects[this.nature] || { increased: 0, decreased: 0 };
  }
  get natureModifiersString(): { increased: string, decreased: string } {
    const { increased, decreased } = this.natureModifiers;
    return {
      increased: statStrings[increased] || 'Unknown',
      decreased: statStrings[decreased] || 'Unknown',
    };

  }
  get abilityNumber(): number {
    // if 2nd bit of status is set, ability is 1
    // if 3rd bit is set, ability is 2
    // otherwise ability is 0
    return (this.status & 16) ? 1 : (this.status & 32) ? 2 : 0;
  }
  get shinyNumber(): number {
    // the 2nd byte of personality determines shininess
    return (this.personality >> 8) & 0xFF;
  }
  get isShiny(): boolean {
    return this.shinyNumber === 1
  }
  get isRadiant(): boolean {
    return this.shinyNumber === 2;
  }
  get stats(): readonly number[] {
    return [this.maxHp, this.attack, this.defense, this.speed, this.spAttack, this.spDefense];
  }
  get moves(): {
    readonly move1: MoveData;
    readonly move2: MoveData;
    readonly move3: MoveData;
    readonly move4: MoveData;
  } {
    return {
      move1: createMoveData(this.move1, this.pp1),
      move2: createMoveData(this.move2, this.pp2),
      move3: createMoveData(this.move3, this.pp3),
      move4: createMoveData(this.move4, this.pp4),
    };
  }
  get moves_data(): PokemonMoves {
    return createPokemonMoves(
      this.move1, this.move2, this.move3, this.move4,
      this.pp1, this.pp2, this.pp3, this.pp4
    );
  }
  get evs(): readonly number[] {
    return [this.hpEV, this.atkEV, this.defEV, this.speEV, this.spaEV, this.spdEV];
  }
  get ivs(): readonly number[] {
    return Array.from({ length: 6 }, (_, i) => (this.ivData >>> (i * 5)) & 0x1F);
  }
  get statsArray(): readonly number[] {
    return [this.maxHp, this.attack, this.defense, this.speed, this.spAttack, this.spDefense];
  }
  get natureModifiersArray(): readonly number[] { // usage for statsArray
    // Nature modifiers: [hp, atk, def, spe, spa, spd]
    const { increased, decreased } = this.natureModifiers;
    return this.statsArray.map((_, i) =>
      i === increased ? 1.1 : i === decreased ? 0.9 : 1
    );
  }
  get totalEVs(): number {
    return this.evs.reduce((sum, ev) => sum + ev, 0);
  }
  get totalIVs(): number {
    return this.ivs.reduce((sum, iv) => sum + iv, 0);
  }
  get moveIds(): readonly number[] {
    return [this.move1, this.move2, this.move3, this.move4];
  }
  get ppValues(): readonly number[] {
    return [this.pp1, this.pp2, this.pp3, this.pp4];
  }
}

/**
 * Character decoder for Pokemon text data
 */
class PokemonTextDecoder {
  private static charMap: Record<string, string> = charMap;

  /**
   * Decode Pokemon character-encoded text to string
   */
  static decode(bytes: Uint8Array): string {
    const result: string[] = [];
    
    for (const byte of bytes) {
      if (byte === 0xFF) {
        // End of string marker
        break;
      }
      
      const char = this.charMap[byte.toString()];
      if (char) {
        result.push(char);
      }
    }
    
    return result.join('').trim();
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
        // Check if arrayBuffer method exists (browser environment)
        if (typeof input.arrayBuffer === 'function') {
          buffer = await input.arrayBuffer();
        } else {
          // Fallback for test environments where File might not have arrayBuffer method
          const reader = new FileReader();
          buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(input);
          });
        }
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
      console.log('[PokemonSaveParser] Forced slot:', this.forcedSlot, '-> activeSlotStart:', this.forcedSlot === 1 ? 0 : 14);
      this.activeSlotStart = this.forcedSlot === 1 ? 0 : 14;
      return;
    }

    const getCounterSum = (range: number[]): number => {
      const infos = range.map(i => this.getSectorInfo(i));
      const validInfos = infos.filter(info => info.valid);
      const sum = validInfos.reduce((sum, info) => sum + info.counter, 0);
      console.log('[PokemonSaveParser] Sector range:', range, 'Counters:', validInfos.map(i => i.counter), 'Sum:', sum);
      return sum;
    };

    const slot1Range = Array.from({ length: 18 }, (_, i) => i);
    const slot2Range = Array.from({ length: 18 }, (_, i) => i + 14);
    const slot1Sum = getCounterSum(slot1Range);
    const slot2Sum = getCounterSum(slot2Range);

    console.log('[PokemonSaveParser] Slot1 sum:', slot1Sum, 'Slot2 sum:', slot2Sum);
    this.activeSlotStart = slot2Sum >= slot1Sum ? 14 : 0;
    console.log('[PokemonSaveParser] Selected activeSlotStart:', this.activeSlotStart);
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
  private parsePartyPokemon(saveblock1Data: Uint8Array): PokemonData[] {
    const partyPokemon: PokemonData[] = [];

    for (let slot = 0; slot < CONSTANTS.MAX_PARTY_SIZE; slot++) {
      const offset = CONSTANTS.PARTY_START_OFFSET + slot * CONSTANTS.PARTY_POKEMON_SIZE;
      const data = saveblock1Data.slice(offset, offset + CONSTANTS.PARTY_POKEMON_SIZE);

      if (data.length < CONSTANTS.PARTY_POKEMON_SIZE) {
        break;
      }

      try {
        const pokemon = new PokemonData(data);
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
    return PokemonTextDecoder.decode(playerNameBytes);
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
