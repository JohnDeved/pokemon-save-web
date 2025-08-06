use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

// Core data structures for Pokemon save parsing

#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct PlayTimeData {
    hours: u16,
    minutes: u8,
    seconds: u8,
}

#[wasm_bindgen]
impl PlayTimeData {
    #[wasm_bindgen(constructor)]
    pub fn new(hours: u16, minutes: u8, seconds: u8) -> PlayTimeData {
        PlayTimeData { hours, minutes, seconds }
    }

    #[wasm_bindgen(getter)]
    pub fn hours(&self) -> u16 { self.hours }
    
    #[wasm_bindgen(getter)]
    pub fn minutes(&self) -> u8 { self.minutes }
    
    #[wasm_bindgen(getter)]
    pub fn seconds(&self) -> u8 { self.seconds }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PokemonStats {
    hp: u16,
    attack: u16,
    defense: u16,
    speed: u16,
    sp_attack: u16,
    sp_defense: u16,
}

#[wasm_bindgen]
impl PokemonStats {
    #[wasm_bindgen(constructor)]
    pub fn new(hp: u16, attack: u16, defense: u16, speed: u16, sp_attack: u16, sp_defense: u16) -> PokemonStats {
        PokemonStats { hp, attack, defense, speed, sp_attack, sp_defense }
    }

    #[wasm_bindgen(getter)]
    pub fn hp(&self) -> u16 { self.hp }
    
    #[wasm_bindgen(getter)]
    pub fn attack(&self) -> u16 { self.attack }
    
    #[wasm_bindgen(getter)]
    pub fn defense(&self) -> u16 { self.defense }
    
    #[wasm_bindgen(getter)]
    pub fn speed(&self) -> u16 { self.speed }
    
    #[wasm_bindgen(getter)]
    pub fn sp_attack(&self) -> u16 { self.sp_attack }
    
    #[wasm_bindgen(getter)]
    pub fn sp_defense(&self) -> u16 { self.sp_defense }
}

#[wasm_bindgen]
#[derive(Debug, Clone)]
pub struct SaveData {
    player_name: String,
    active_slot: u8,
    play_time: PlayTimeData,
}

#[wasm_bindgen]
impl SaveData {
    #[wasm_bindgen(constructor)]
    pub fn new(player_name: String, active_slot: u8, play_time: PlayTimeData) -> SaveData {
        SaveData { player_name, active_slot, play_time }
    }

    #[wasm_bindgen(getter)]
    pub fn player_name(&self) -> String { self.player_name.clone() }
    
    #[wasm_bindgen(getter)]
    pub fn active_slot(&self) -> u8 { self.active_slot }
    
    #[wasm_bindgen(getter)]
    pub fn play_time(&self) -> PlayTimeData { self.play_time.clone() }
}

// Pokemon Emerald constants
pub const VANILLA_EMERALD_SIGNATURE: u32 = 0x08012025;
pub const POKEMON_SIZE: usize = 100;
pub const MAX_PARTY_SIZE: usize = 6;
pub const SECTOR_SIZE: usize = 4096;
pub const SECTOR_DATA_SIZE: usize = 3968;

// Pokemon data offsets
pub struct PokemonOffsets;
impl PokemonOffsets {
    pub const PERSONALITY: usize = 0x00;
    pub const OT_ID: usize = 0x04;
    pub const NICKNAME: usize = 0x08;
    pub const NICKNAME_LENGTH: usize = 10;
    pub const OT_NAME: usize = 0x14;
    pub const OT_NAME_LENGTH: usize = 7;
    pub const CURRENT_HP: usize = 0x56;
    pub const MAX_HP: usize = 0x58;
    pub const ATTACK: usize = 0x5A;
    pub const DEFENSE: usize = 0x5C;
    pub const SPEED: usize = 0x5E;
    pub const SP_ATTACK: usize = 0x60;
    pub const SP_DEFENSE: usize = 0x62;
    pub const STATUS: usize = 0x50;
    pub const LEVEL: usize = 0x54;
    pub const SPECIES_ID: usize = 0x20; // Encrypted section, will need decryption
}

// Save layout constants
pub struct SaveLayout;
impl SaveLayout {
    pub const PARTY_OFFSET: usize = 0x238;
    pub const PARTY_COUNT_OFFSET: usize = 0x234;
    pub const PLAY_TIME_HOURS: usize = 0x0E;
    pub const PLAY_TIME_MINUTES: usize = 0x10;
    pub const PLAY_TIME_SECONDS: usize = 0x11;
}

#[wasm_bindgen]
#[derive(Debug, Clone)]
pub struct SectorInfo {
    id: u16,
    checksum: u16,
    counter: u32,
    valid: bool,
}

#[wasm_bindgen]
impl SectorInfo {
    #[wasm_bindgen(constructor)]
    pub fn new(id: u16, checksum: u16, counter: u32, valid: bool) -> SectorInfo {
        SectorInfo { id, checksum, counter, valid }
    }

    #[wasm_bindgen(getter)]
    pub fn id(&self) -> u16 { self.id }
    
    #[wasm_bindgen(getter)]
    pub fn checksum(&self) -> u16 { self.checksum }
    
    #[wasm_bindgen(getter)]
    pub fn counter(&self) -> u32 { self.counter }
    
    #[wasm_bindgen(getter)]
    pub fn valid(&self) -> bool { self.valid }
}

// Nature constants
pub const NATURES: [&str; 25] = [
    "Hardy", "Lonely", "Brave", "Adamant", "Naughty",
    "Bold", "Docile", "Relaxed", "Impish", "Lax",
    "Timid", "Hasty", "Serious", "Jolly", "Naive",
    "Modest", "Mild", "Quiet", "Bashful", "Rash",
    "Calm", "Gentle", "Sassy", "Careful", "Quirky",
];