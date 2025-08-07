/* tslint:disable */
/* eslint-disable */
export function test_wasm(): string;
/**
 * Convert GBA-encoded bytes to a readable string
 */
export function bytes_to_gba_string(bytes: Uint8Array): string;
/**
 * Convert a string to GBA-encoded bytes
 */
export function gba_string_to_bytes(text: string, length: number): Uint8Array;
/**
 * Get Pokemon nature from personality value
 */
export function get_pokemon_nature(personality: number): string;
/**
 * Calculate sector checksum for Pokemon save data
 */
export function calculate_sector_checksum(sector_data: Uint8Array): number;
/**
 * Read a little-endian u16 from bytes at offset
 */
export function read_u16_le(bytes: Uint8Array, offset: number): number;
/**
 * Read a little-endian u32 from bytes at offset
 */
export function read_u32_le(bytes: Uint8Array, offset: number): number;
/**
 * Check if Pokemon is shiny based on personality and OT ID
 */
export function is_pokemon_shiny(personality: number, ot_id: number): boolean;
/**
 * Get the shiny value for determining shininess
 */
export function get_shiny_value(personality: number, ot_id: number): number;
/**
 * Format playtime as a human-readable string
 */
export function format_play_time(hours: number, minutes: number, seconds: number): string;
export class PlayTimeData {
  free(): void;
  constructor(hours: number, minutes: number, seconds: number);
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
}
export class Pokemon {
  free(): void;
  /**
   * Create a new Pokemon from raw byte data
   */
  constructor(raw_bytes: Uint8Array);
  /**
   * Create a Pokemon from JavaScript Uint8Array
   */
  static from_bytes(bytes: Uint8Array): Pokemon;
  /**
   * Get the raw bytes of this Pokemon
   */
  get_raw_bytes(): Uint8Array;
  /**
   * Get all stats as a PokemonStats object
   */
  get_stats(): PokemonStats;
  /**
   * Check if Pokemon data appears valid (has non-zero species ID)
   */
  is_valid(): boolean;
  /**
   * Get a formatted string representation of the Pokemon
   */
  to_string(): string;
  /**
   * Get Pokemon's personality value
   */
  personality: number;
  /**
   * Get Pokemon's Original Trainer ID
   */
  ot_id: number;
  /**
   * Get Pokemon's nickname
   */
  readonly nickname: string;
  /**
   * Get Pokemon's Original Trainer name
   */
  readonly ot_name: string;
  /**
   * Get Pokemon's current HP
   */
  current_hp: number;
  /**
   * Get Pokemon's maximum HP
   */
  max_hp: number;
  /**
   * Get Pokemon's attack stat
   */
  attack: number;
  /**
   * Get Pokemon's defense stat
   */
  defense: number;
  /**
   * Get Pokemon's speed stat
   */
  speed: number;
  /**
   * Get Pokemon's special attack stat
   */
  sp_attack: number;
  /**
   * Get Pokemon's special defense stat
   */
  sp_defense: number;
  /**
   * Get Pokemon's level
   */
  level: number;
  /**
   * Get Pokemon's status condition
   */
  status: number;
  /**
   * Get Pokemon's nature based on personality
   */
  readonly nature: string;
  /**
   * Check if Pokemon is shiny
   */
  readonly is_shiny: boolean;
  /**
   * Get the shiny value (lower values = more likely to be shiny)
   */
  readonly shiny_value: number;
}
export class PokemonStats {
  free(): void;
  constructor(hp: number, attack: number, defense: number, speed: number, sp_attack: number, sp_defense: number);
  readonly hp: number;
  readonly attack: number;
  readonly defense: number;
  readonly speed: number;
  readonly sp_attack: number;
  readonly sp_defense: number;
}
export class SaveData {
  free(): void;
  constructor(player_name: string, active_slot: number, play_time: PlayTimeData);
  readonly player_name: string;
  readonly active_slot: number;
  readonly play_time: PlayTimeData;
}
export class SaveParser {
  free(): void;
  /**
   * Create a new SaveParser instance
   */
  constructor();
  /**
   * Load save data from bytes
   */
  load_save_data(data: Uint8Array): void;
  /**
   * Parse the complete save data and return SaveData
   */
  parse(): SaveData;
  /**
   * Get party Pokemon from the save data
   */
  get_party_pokemon(): Pokemon[];
  /**
   * Get player name from save data
   */
  get_player_name(): string;
  /**
   * Get play time from save data
   */
  get_play_time(): PlayTimeData;
  /**
   * Get information about all sectors
   */
  get_sector_info(sector_index: number): SectorInfo;
  /**
   * Get the active slot number (1 or 2)
   */
  get_active_slot(): number;
  /**
   * Get total number of valid sectors found
   */
  get_valid_sector_count(): number;
}
export class SectorInfo {
  free(): void;
  constructor(id: number, checksum: number, counter: number, valid: boolean);
  readonly id: number;
  readonly checksum: number;
  readonly counter: number;
  readonly valid: boolean;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_pokemon_free: (a: number, b: number) => void;
  readonly pokemon_new: (a: number, b: number) => [number, number, number];
  readonly pokemon_from_bytes: (a: number, b: number) => [number, number, number];
  readonly pokemon_get_raw_bytes: (a: number) => [number, number];
  readonly pokemon_personality: (a: number) => number;
  readonly pokemon_set_personality: (a: number, b: number) => void;
  readonly pokemon_ot_id: (a: number) => number;
  readonly pokemon_set_ot_id: (a: number, b: number) => void;
  readonly pokemon_nickname: (a: number) => [number, number];
  readonly pokemon_ot_name: (a: number) => [number, number];
  readonly pokemon_current_hp: (a: number) => number;
  readonly pokemon_set_current_hp: (a: number, b: number) => void;
  readonly pokemon_max_hp: (a: number) => number;
  readonly pokemon_set_max_hp: (a: number, b: number) => void;
  readonly pokemon_attack: (a: number) => number;
  readonly pokemon_set_attack: (a: number, b: number) => void;
  readonly pokemon_defense: (a: number) => number;
  readonly pokemon_set_defense: (a: number, b: number) => void;
  readonly pokemon_speed: (a: number) => number;
  readonly pokemon_set_speed: (a: number, b: number) => void;
  readonly pokemon_sp_attack: (a: number) => number;
  readonly pokemon_set_sp_attack: (a: number, b: number) => void;
  readonly pokemon_sp_defense: (a: number) => number;
  readonly pokemon_set_sp_defense: (a: number, b: number) => void;
  readonly pokemon_level: (a: number) => number;
  readonly pokemon_set_level: (a: number, b: number) => void;
  readonly pokemon_status: (a: number) => number;
  readonly pokemon_set_status: (a: number, b: number) => void;
  readonly pokemon_nature: (a: number) => [number, number];
  readonly pokemon_is_shiny: (a: number) => number;
  readonly pokemon_shiny_value: (a: number) => number;
  readonly pokemon_get_stats: (a: number) => number;
  readonly pokemon_is_valid: (a: number) => number;
  readonly pokemon_to_string: (a: number) => [number, number];
  readonly test_wasm: () => [number, number];
  readonly __wbg_saveparser_free: (a: number, b: number) => void;
  readonly saveparser_new: () => number;
  readonly saveparser_load_save_data: (a: number, b: number, c: number) => [number, number];
  readonly saveparser_parse: (a: number) => [number, number, number];
  readonly saveparser_get_party_pokemon: (a: number) => [number, number, number, number];
  readonly saveparser_get_player_name: (a: number) => [number, number, number, number];
  readonly saveparser_get_play_time: (a: number) => [number, number, number];
  readonly saveparser_get_sector_info: (a: number, b: number) => number;
  readonly saveparser_get_active_slot: (a: number) => number;
  readonly saveparser_get_valid_sector_count: (a: number) => number;
  readonly bytes_to_gba_string: (a: number, b: number) => [number, number];
  readonly gba_string_to_bytes: (a: number, b: number, c: number) => [number, number];
  readonly get_pokemon_nature: (a: number) => [number, number];
  readonly calculate_sector_checksum: (a: number, b: number) => number;
  readonly read_u16_le: (a: number, b: number, c: number) => number;
  readonly read_u32_le: (a: number, b: number, c: number) => number;
  readonly is_pokemon_shiny: (a: number, b: number) => number;
  readonly get_shiny_value: (a: number, b: number) => number;
  readonly format_play_time: (a: number, b: number, c: number) => [number, number];
  readonly __wbg_playtimedata_free: (a: number, b: number) => void;
  readonly playtimedata_new: (a: number, b: number, c: number) => number;
  readonly playtimedata_hours: (a: number) => number;
  readonly playtimedata_minutes: (a: number) => number;
  readonly playtimedata_seconds: (a: number) => number;
  readonly __wbg_pokemonstats_free: (a: number, b: number) => void;
  readonly pokemonstats_new: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly pokemonstats_hp: (a: number) => number;
  readonly pokemonstats_attack: (a: number) => number;
  readonly pokemonstats_defense: (a: number) => number;
  readonly pokemonstats_speed: (a: number) => number;
  readonly pokemonstats_sp_attack: (a: number) => number;
  readonly pokemonstats_sp_defense: (a: number) => number;
  readonly __wbg_savedata_free: (a: number, b: number) => void;
  readonly savedata_new: (a: number, b: number, c: number, d: number) => number;
  readonly savedata_player_name: (a: number) => [number, number];
  readonly savedata_active_slot: (a: number) => number;
  readonly savedata_play_time: (a: number) => number;
  readonly sectorinfo_new: (a: number, b: number, c: number, d: number) => number;
  readonly sectorinfo_id: (a: number) => number;
  readonly sectorinfo_checksum: (a: number) => number;
  readonly sectorinfo_counter: (a: number) => number;
  readonly sectorinfo_valid: (a: number) => number;
  readonly __wbg_sectorinfo_free: (a: number, b: number) => void;
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_drop_slice: (a: number, b: number) => void;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
