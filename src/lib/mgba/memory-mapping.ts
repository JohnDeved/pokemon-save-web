/**
 * Pokémon Emerald memory layout mapping
 * Based on mGBA's official pokemon.lua demo script and pokeemerald repository
 * 
 * Key insight: mGBA provides FIXED memory addresses for Emerald data structures.
 * No ASLR scanning needed - addresses are consistent in mGBA environment.
 * 
 * Reference: https://raw.githubusercontent.com/mgba-emu/mgba/refs/heads/master/res/scripts/demos/pokemon.lua
 * Emerald addresses from gameEmeraldEn configuration
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
 * Fixed memory addresses for Pokémon Emerald (USA) in mGBA
 * Based on official mGBA pokemon.lua script configuration
 */
export const EMERALD_MEMORY_ADDRESSES = {
  // Party data - from gameEmeraldEn in pokemon.lua
  PARTY_DATA: 0x20244ec,        // _party address
  PARTY_COUNT: 0x20244e9,       // _partyCount address
  SPECIES_NAME_TABLE: 0x3185c8, // _speciesNameTable address
  
  // Calculated addresses based on party structure
  PARTY_SIZE: 6,                // Maximum party size
  POKEMON_SIZE: 100,            // Size of each Pokemon struct (0x64 bytes)
} as const

/**
 * Pokemon data structure in memory for Generation 3 (Emerald)
 * Based on mGBA pokemon.lua Generation3En implementation
 * Each Pokemon is 100 bytes (0x64)
 */
export const POKEMON_STRUCT = {
  SIZE: 100, // 0x64 bytes per Pokemon
  
  // Personality value and encryption (first 32 bytes)
  PERSONALITY: 0x00,         // u32 - used for encryption key
  OT_ID: 0x04,              // u32 (Trainer ID + Secret ID)
  NICKNAME: 0x08,           // 10 bytes
  LANGUAGE: 0x12,           // u8
  OT_NAME: 0x14,            // 7 bytes
  MARKINGS: 0x1B,           // u8
  CHECKSUM: 0x1C,           // u16
  UNUSED: 0x1E,             // u16
  
  // Encrypted data block (32 bytes total, 4 substructures of 12 bytes each)
  // The order of substructures depends on personality % 24
  DATA: 0x20,               // 48 bytes of encrypted data
  
  // Party-specific data (for party Pokemon only, not in PC boxes)
  STATUS: 0x50,             // u32 - status condition
  LEVEL: 0x54,              // u8 - current level
  MAIL: 0x55,               // u32 - mail data (3 bytes used)
  CURRENT_HP: 0x56,         // u16 - current HP
  MAX_HP: 0x58,             // u16 - maximum HP
  ATTACK: 0x5A,             // u16 - attack stat
  DEFENSE: 0x5C,            // u16 - defense stat
  SPEED: 0x5E,              // u16 - speed stat
  SP_ATTACK: 0x60,          // u16 - special attack stat
  SP_DEFENSE: 0x62,         // u16 - special defense stat
} as const

/**
 * Encrypted Pokemon data substructures for Generation 3
 * Based on mGBA pokemon.lua Generation3En._readBoxMon implementation
 * The DATA section contains 4 substructures of 12 bytes each, encrypted and reordered
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
    FEEL: 0x0B,             // u8 (sheen/feel)
  },
  
  // Miscellaneous substructure (IVs, ribbons, etc.)
  MISC: {
    POKERUS: 0x00,          // u8
    MET_LOCATION: 0x01,     // u8
    // Origins info packed in u16 at 0x02-0x03
    MET_LEVEL_AND_GAME: 0x02, // u16 (level bits 0-6, game bits 7-10, pokeball bits 11-14, OT gender bit 15)
    // IVs and flags packed in u32 at 0x04-0x07
    IVS_AND_FLAGS: 0x04,    // u32 (HP IV bits 0-4, ATK IV bits 5-9, DEF IV bits 10-14, SPE IV bits 15-19, SPA IV bits 20-24, SPD IV bits 25-29, isEgg bit 30, altAbility bit 31)
    // Ribbons packed in u32 at 0x08-0x0B
    RIBBONS: 0x08,          // u32
  }
} as const

/**
 * Calculate the order of substructures based on personality value
 * Based on mGBA pokemon.lua and pokeemerald/src/pokemon.c
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
 * Create encryption key from personality and OT ID
 * Based on mGBA pokemon.lua Generation3En implementation
 */
export function createEncryptionKey(personality: number, otId: number): number {
  return personality ^ otId
}

/**
 * Get the memory address for a specific Pokemon in the party
 */
export function getPartyPokemonAddress(index: number): number {
  if (index < 0 || index >= EMERALD_MEMORY_ADDRESSES.PARTY_SIZE) {
    throw new Error(`Invalid party Pokemon index: ${index}`)
  }
  
  return EMERALD_MEMORY_ADDRESSES.PARTY_DATA + (index * POKEMON_STRUCT.SIZE)
}

/**
 * Get the memory address for party count
 */
export function getPartyCountAddress(): number {
  return EMERALD_MEMORY_ADDRESSES.PARTY_COUNT
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
 * Extract Individual Values from packed IVs data
 * Based on mGBA pokemon.lua implementation
 */
export function extractIVs(ivsAndFlags: number) {
  return {
    hp: ivsAndFlags & 0x1F,              // bits 0-4
    attack: (ivsAndFlags >> 5) & 0x1F,   // bits 5-9
    defense: (ivsAndFlags >> 10) & 0x1F, // bits 10-14
    speed: (ivsAndFlags >> 15) & 0x1F,   // bits 15-19
    spAttack: (ivsAndFlags >> 20) & 0x1F, // bits 20-24
    spDefense: (ivsAndFlags >> 25) & 0x1F, // bits 25-29
    isEgg: Boolean(ivsAndFlags & (1 << 30)), // bit 30
    altAbility: Boolean(ivsAndFlags & (1 << 31)) // bit 31
  }
}

/**
 * Pack Individual Values into u32 format
 */
export function packIVs(ivs: {
  hp: number, attack: number, defense: number, speed: number,
  spAttack: number, spDefense: number, isEgg?: boolean, altAbility?: boolean
}): number {
  return (ivs.hp & 0x1F) |
         ((ivs.attack & 0x1F) << 5) |
         ((ivs.defense & 0x1F) << 10) |
         ((ivs.speed & 0x1F) << 15) |
         ((ivs.spAttack & 0x1F) << 20) |
         ((ivs.spDefense & 0x1F) << 25) |
         ((ivs.isEgg ? 1 : 0) << 30) |
         ((ivs.altAbility ? 1 : 0) << 31)
}

/**
 * Extract origin info from packed met data
 */
export function extractOriginInfo(metLevelAndGame: number) {
  return {
    metLevel: metLevelAndGame & 0x7F,        // bits 0-6
    metGame: (metLevelAndGame >> 7) & 0xF,   // bits 7-10
    pokeball: (metLevelAndGame >> 11) & 0xF, // bits 11-14
    otGender: Boolean(metLevelAndGame & 0x8000) // bit 15
  }
}

/**
 * Pack origin info into u16 format
 */
export function packOriginInfo(info: {
  metLevel: number, metGame: number, pokeball: number, otGender: boolean
}): number {
  return (info.metLevel & 0x7F) |
         ((info.metGame & 0xF) << 7) |
         ((info.pokeball & 0xF) << 11) |
         ((info.otGender ? 1 : 0) << 15)
}