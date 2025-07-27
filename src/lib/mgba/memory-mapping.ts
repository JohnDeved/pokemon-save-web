/**
 * Pokémon Emerald memory layout mapping
 * Based on pokeemerald repository: https://github.com/pret/pokeemerald
 * 
 * This maps save file offsets to their corresponding in-memory addresses
 * for Pokémon Emerald running in mGBA.
 */

// Memory regions in GBA
export const MEMORY_REGIONS = {
  // External Work RAM (EWRAM) - 0x02000000-0x02040000 (256KB)
  EWRAM_BASE: 0x02000000,
  
  // Internal Work RAM (IWRAM) - 0x03000000-0x03008000 (32KB)  
  IWRAM_BASE: 0x03000000,
  
  // Save RAM (SRAM) - 0x0E000000-0x0E010000 (64KB max for Emerald)
  SRAM_BASE: 0x0E000000
} as const

/**
 * Pokémon Emerald save game structure in memory
 * Based on pokeemerald/include/global.h and save.h
 * 
 * The save data is typically loaded into EWRAM during gameplay
 * These addresses are based on the pokeemerald source code analysis
 */
export const EMERALD_SAVE_LAYOUT = {
  // Main save data structure starts at a specific offset in EWRAM
  SAVE_DATA_BASE: 0x02025734, // gSaveBlock1Ptr location
  
  // SaveBlock1 - Player and game state data
  PLAYER_NAME: 0x00,          // Offset from save base
  PLAYER_GENDER: 0x08,        // u8
  PLAYER_ID: 0x0A,           // u16 - Trainer ID
  PLAYER_SECRET_ID: 0x0C,    // u16 - Secret ID
  PLAY_TIME_HOURS: 0x0E,     // u16
  PLAY_TIME_MINUTES: 0x10,   // u8
  PLAY_TIME_SECONDS: 0x11,   // u8
  PLAY_TIME_FRAMES: 0x12,    // u8
  
  // Party Pokemon data
  PARTY_COUNT: 0x234,        // u32 - Number of Pokemon in party
  PARTY_POKEMON: 0x238,      // Array of Pokemon structs (100 bytes each)
  
  // Box Pokemon (PC Storage)
  BOX_POKEMON: 0x83B4,       // Array of box Pokemon
  
} as const

/**
 * Pokemon data structure in memory
 * Based on pokeemerald/include/pokemon.h - struct Pokemon
 * Each Pokemon is 100 bytes (0x64)
 */
export const POKEMON_STRUCT = {
  SIZE: 100, // 0x64 bytes per Pokemon
  
  // Personality value and encryption
  PERSONALITY: 0x00,         // u32
  OT_ID: 0x04,              // u32 (Trainer ID + Secret ID)
  NICKNAME: 0x08,           // 10 bytes
  LANGUAGE: 0x12,           // u8
  OT_NAME: 0x14,            // 7 bytes
  MARKINGS: 0x1B,           // u8
  CHECKSUM: 0x1C,           // u16
  UNUSED: 0x1E,             // u16
  
  // Encrypted data block starts at 0x20 (32 bytes)
  DATA: 0x20,               // 48 bytes of encrypted data
  
  // Status condition and other data
  STATUS: 0x50,             // u32
  LEVEL: 0x54,              // u8
  POKERUS: 0x55,            // u8
  CURRENT_HP: 0x56,         // u16
  MAX_HP: 0x58,             // u16
  ATTACK: 0x5A,             // u16
  DEFENSE: 0x5C,            // u16
  SPEED: 0x5E,              // u16
  SP_ATTACK: 0x60,          // u16
  SP_DEFENSE: 0x62,         // u16
} as const

/**
 * Encrypted Pokemon data substructures
 * The DATA section is encrypted and contains 4 substructures of 12 bytes each
 * The order depends on the personality value
 */
export const POKEMON_SUBSTRUCT = {
  SIZE: 12, // Each substructure is 12 bytes
  
  // Growth substructure (contains species, item, experience, etc.)
  GROWTH: {
    SPECIES: 0x00,          // u16
    ITEM: 0x02,             // u16
    EXPERIENCE: 0x04,       // u32
    PP_BONUSES: 0x08,       // u8
    FRIENDSHIP: 0x09,       // u8
    UNUSED: 0x0A,           // u16
  },
  
  // Attacks substructure (contains moves and PP)
  ATTACKS: {
    MOVE1: 0x00,            // u16
    MOVE2: 0x02,            // u16
    MOVE3: 0x04,            // u16
    MOVE4: 0x06,            // u16
    PP1: 0x08,              // u8
    PP2: 0x09,              // u8
    PP3: 0x0A,              // u8
    PP4: 0x0B,              // u8
  },
  
  // EVs and Condition substructure
  EVS_CONDITION: {
    HP_EV: 0x00,            // u8
    ATTACK_EV: 0x01,        // u8
    DEFENSE_EV: 0x02,       // u8
    SPEED_EV: 0x03,         // u8
    SP_ATTACK_EV: 0x04,     // u8
    SP_DEFENSE_EV: 0x05,    // u8
    COOLNESS: 0x06,         // u8
    BEAUTY: 0x07,           // u8
    CUTENESS: 0x08,         // u8
    SMARTNESS: 0x09,        // u8
    TOUGHNESS: 0x0A,        // u8
    RIB_COUNT: 0x0B,        // u8
  },
  
  // Miscellaneous substructure
  MISC: {
    POKERUS: 0x00,          // u8
    MET_LOCATION: 0x01,     // u8
    MET_LEVEL: 0x02,        // u8 (bits 0-6), met game (bit 7)
    MET_GAME: 0x03,         // u8
    POKEBALL: 0x04,         // u8 (bits 0-3), OT gender (bit 7)
    IVS: 0x05,              // u32 (bits 0-29 are IVs, bit 30 is egg, bit 31 is ability)
    RIBBONS: 0x09,          // u32
  }
} as const

/**
 * Calculate the order of substructures based on personality value
 * Based on pokeemerald/src/pokemon.c - GetMonData function
 */
export function getSubstructOrder(personality: number): number[] {
  const orders = [
    [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 3, 1, 2], [0, 2, 3, 1], [0, 3, 2, 1],
    [1, 0, 2, 3], [1, 0, 3, 2], [2, 0, 1, 3], [3, 0, 1, 2], [2, 0, 3, 1], [3, 0, 2, 1],
    [1, 2, 0, 3], [1, 3, 0, 2], [2, 1, 0, 3], [3, 1, 0, 2], [2, 3, 0, 1], [3, 2, 0, 1],
    [1, 2, 3, 0], [1, 3, 2, 0], [2, 1, 3, 0], [3, 1, 2, 0], [2, 3, 1, 0], [3, 2, 1, 0]
  ]
  
  return orders[personality % 24]
}

/**
 * Nature calculation from personality value
 * Based on pokeemerald/include/constants/pokemon.h
 */
export const NATURES = [
  'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty',
  'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
  'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive',
  'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
  'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky'
] as const

export function getNature(personality: number): string {
  return NATURES[personality % 25]
}

/**
 * Gender calculation from personality value and species
 * Based on pokeemerald/src/pokemon.c
 */
export function getGender(personality: number, species: number): 'Male' | 'Female' | 'Genderless' {
  // This is simplified - in practice, you'd need the species gender ratio data
  // For now, use personality value lower 8 bits vs 254 (87.5% male) for most species
  const genderByte = personality & 0xFF
  
  // Simplified gender ratio (most Pokemon use 87.5% male ratio)
  if (genderByte < 31) return 'Female'  // ~12.5%
  return 'Male' // ~87.5%
}

/**
 * Map save file offset to memory address
 * This function translates offsets used in the save file parser
 * to their corresponding memory addresses in mGBA
 */
export function mapSaveOffsetToMemory(saveOffset: number): number {
  // The save data is loaded into EWRAM at a specific address
  // This address can be found by analyzing the pokeemerald source code
  // or by runtime inspection in mGBA
  
  return EMERALD_SAVE_LAYOUT.SAVE_DATA_BASE + saveOffset
}

/**
 * Get the memory address for a specific Pokemon in the party
 */
export function getPartyPokemonAddress(index: number): number {
  if (index < 0 || index >= 6) {
    throw new Error(`Invalid party Pokemon index: ${index}`)
  }
  
  const baseAddress = mapSaveOffsetToMemory(EMERALD_SAVE_LAYOUT.PARTY_POKEMON)
  return baseAddress + (index * POKEMON_STRUCT.SIZE)
}

/**
 * Get the memory address for a specific field within a Pokemon struct
 */
export function getPokemonFieldAddress(pokemonAddress: number, field: keyof typeof POKEMON_STRUCT): number {
  if (field === 'SIZE') {
    throw new Error('SIZE is not a valid field offset')
  }
  
  return pokemonAddress + POKEMON_STRUCT[field]
}