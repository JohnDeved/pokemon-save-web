use crate::types::{PokemonOffsets, PokemonStats};
use crate::utils::{
    bytes_to_gba_string, get_pokemon_nature, is_pokemon_shiny, get_shiny_value,
    read_u16_le, read_u32_le, write_u16_le, write_u32_le,
    calculate_hp_stat, calculate_stat, get_nature_modifier
};
use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pokemon {
    raw_bytes: Vec<u8>,
}

#[wasm_bindgen]
impl Pokemon {
    /// Create a new Pokemon from raw byte data
    #[wasm_bindgen(constructor)]
    pub fn new(raw_bytes: Vec<u8>) -> Result<Pokemon, JsError> {
        if raw_bytes.len() < 100 {
            return Err(JsError::new("Pokemon data must be at least 100 bytes"));
        }
        
        Ok(Pokemon { raw_bytes })
    }
    
    /// Create a Pokemon from JavaScript Uint8Array
    #[wasm_bindgen]
    pub fn from_bytes(bytes: &[u8]) -> Result<Pokemon, JsError> {
        Pokemon::new(bytes.to_vec())
    }
    
    /// Get the raw bytes of this Pokemon
    #[wasm_bindgen]
    pub fn get_raw_bytes(&self) -> Vec<u8> {
        self.raw_bytes.clone()
    }
    
    /// Get Pokemon's personality value
    #[wasm_bindgen(getter)]
    pub fn personality(&self) -> u32 {
        read_u32_le(&self.raw_bytes, PokemonOffsets::PERSONALITY)
    }
    
    /// Set Pokemon's personality value
    #[wasm_bindgen(setter)]
    pub fn set_personality(&mut self, value: u32) {
        write_u32_le(&mut self.raw_bytes, PokemonOffsets::PERSONALITY, value);
    }
    
    /// Get Pokemon's Original Trainer ID
    #[wasm_bindgen(getter)]
    pub fn ot_id(&self) -> u32 {
        read_u32_le(&self.raw_bytes, PokemonOffsets::OT_ID)
    }
    
    /// Set Pokemon's Original Trainer ID
    #[wasm_bindgen(setter)]
    pub fn set_ot_id(&mut self, value: u32) {
        write_u32_le(&mut self.raw_bytes, PokemonOffsets::OT_ID, value);
    }
    
    /// Get Pokemon's nickname
    #[wasm_bindgen(getter)]
    pub fn nickname(&self) -> String {
        let start = PokemonOffsets::NICKNAME;
        let end = start + PokemonOffsets::NICKNAME_LENGTH;
        let nickname_bytes = &self.raw_bytes[start..end.min(self.raw_bytes.len())];
        bytes_to_gba_string(nickname_bytes)
    }
    
    /// Get Pokemon's Original Trainer name
    #[wasm_bindgen(getter)]
    pub fn ot_name(&self) -> String {
        let start = PokemonOffsets::OT_NAME;
        let end = start + PokemonOffsets::OT_NAME_LENGTH;
        let ot_name_bytes = &self.raw_bytes[start..end.min(self.raw_bytes.len())];
        bytes_to_gba_string(ot_name_bytes)
    }
    
    /// Get Pokemon's current HP
    #[wasm_bindgen(getter)]
    pub fn current_hp(&self) -> u16 {
        read_u16_le(&self.raw_bytes, PokemonOffsets::CURRENT_HP)
    }
    
    /// Set Pokemon's current HP
    #[wasm_bindgen(setter)]
    pub fn set_current_hp(&mut self, value: u16) {
        write_u16_le(&mut self.raw_bytes, PokemonOffsets::CURRENT_HP, value);
    }
    
    /// Get Pokemon's maximum HP
    #[wasm_bindgen(getter)]
    pub fn max_hp(&self) -> u16 {
        read_u16_le(&self.raw_bytes, PokemonOffsets::MAX_HP)
    }
    
    /// Set Pokemon's maximum HP
    #[wasm_bindgen(setter)]
    pub fn set_max_hp(&mut self, value: u16) {
        write_u16_le(&mut self.raw_bytes, PokemonOffsets::MAX_HP, value);
    }
    
    /// Get Pokemon's attack stat
    #[wasm_bindgen(getter)]
    pub fn attack(&self) -> u16 {
        read_u16_le(&self.raw_bytes, PokemonOffsets::ATTACK)
    }
    
    /// Set Pokemon's attack stat
    #[wasm_bindgen(setter)]
    pub fn set_attack(&mut self, value: u16) {
        write_u16_le(&mut self.raw_bytes, PokemonOffsets::ATTACK, value);
    }
    
    /// Get Pokemon's defense stat
    #[wasm_bindgen(getter)]
    pub fn defense(&self) -> u16 {
        read_u16_le(&self.raw_bytes, PokemonOffsets::DEFENSE)
    }
    
    /// Set Pokemon's defense stat
    #[wasm_bindgen(setter)]
    pub fn set_defense(&mut self, value: u16) {
        write_u16_le(&mut self.raw_bytes, PokemonOffsets::DEFENSE, value);
    }
    
    /// Get Pokemon's speed stat
    #[wasm_bindgen(getter)]
    pub fn speed(&self) -> u16 {
        read_u16_le(&self.raw_bytes, PokemonOffsets::SPEED)
    }
    
    /// Set Pokemon's speed stat
    #[wasm_bindgen(setter)]
    pub fn set_speed(&mut self, value: u16) {
        write_u16_le(&mut self.raw_bytes, PokemonOffsets::SPEED, value);
    }
    
    /// Get Pokemon's special attack stat
    #[wasm_bindgen(getter)]
    pub fn sp_attack(&self) -> u16 {
        read_u16_le(&self.raw_bytes, PokemonOffsets::SP_ATTACK)
    }
    
    /// Set Pokemon's special attack stat
    #[wasm_bindgen(setter)]
    pub fn set_sp_attack(&mut self, value: u16) {
        write_u16_le(&mut self.raw_bytes, PokemonOffsets::SP_ATTACK, value);
    }
    
    /// Get Pokemon's special defense stat
    #[wasm_bindgen(getter)]
    pub fn sp_defense(&self) -> u16 {
        read_u16_le(&self.raw_bytes, PokemonOffsets::SP_DEFENSE)
    }
    
    /// Set Pokemon's special defense stat
    #[wasm_bindgen(setter)]
    pub fn set_sp_defense(&mut self, value: u16) {
        write_u16_le(&mut self.raw_bytes, PokemonOffsets::SP_DEFENSE, value);
    }
    
    /// Get Pokemon's level
    #[wasm_bindgen(getter)]
    pub fn level(&self) -> u8 {
        if PokemonOffsets::LEVEL < self.raw_bytes.len() {
            self.raw_bytes[PokemonOffsets::LEVEL]
        } else {
            0
        }
    }
    
    /// Set Pokemon's level
    #[wasm_bindgen(setter)]
    pub fn set_level(&mut self, value: u8) {
        if PokemonOffsets::LEVEL < self.raw_bytes.len() {
            self.raw_bytes[PokemonOffsets::LEVEL] = value;
        }
    }
    
    /// Get Pokemon's status condition
    #[wasm_bindgen(getter)]
    pub fn status(&self) -> u8 {
        if PokemonOffsets::STATUS < self.raw_bytes.len() {
            self.raw_bytes[PokemonOffsets::STATUS]
        } else {
            0
        }
    }
    
    /// Set Pokemon's status condition
    #[wasm_bindgen(setter)]
    pub fn set_status(&mut self, value: u8) {
        if PokemonOffsets::STATUS < self.raw_bytes.len() {
            self.raw_bytes[PokemonOffsets::STATUS] = value;
        }
    }
    
    /// Get Pokemon's nature based on personality
    #[wasm_bindgen(getter)]
    pub fn nature(&self) -> String {
        get_pokemon_nature(self.personality())
    }
    
    /// Check if Pokemon is shiny
    #[wasm_bindgen(getter)]
    pub fn is_shiny(&self) -> bool {
        is_pokemon_shiny(self.personality(), self.ot_id())
    }
    
    /// Get the shiny value (lower values = more likely to be shiny)
    #[wasm_bindgen(getter)]
    pub fn shiny_value(&self) -> u16 {
        get_shiny_value(self.personality(), self.ot_id())
    }
    
    /// Get all stats as a PokemonStats object
    #[wasm_bindgen]
    pub fn get_stats(&self) -> PokemonStats {
        PokemonStats::new(
            self.max_hp(),
            self.attack(),
            self.defense(),
            self.speed(),
            self.sp_attack(),
            self.sp_defense(),
        )
    }
    
    /// Check if Pokemon data appears valid (has non-zero species ID)
    #[wasm_bindgen]
    pub fn is_valid(&self) -> bool {
        // For now, just check if we have enough data
        // In a full implementation, we'd decrypt and check species ID
        self.raw_bytes.len() >= 100 && self.personality() != 0
    }
    
    /// Get a formatted string representation of the Pokemon
    #[wasm_bindgen]
    pub fn to_string(&self) -> String {
        format!(
            "Pokemon {{ nickname: {}, level: {}, hp: {}/{}, nature: {} }}",
            self.nickname(),
            self.level(),
            self.current_hp(),
            self.max_hp(),
            self.nature()
        )
    }
}

// Internal methods not exposed to JavaScript
impl Pokemon {
    /// Get species ID (would require decryption in full implementation)
    pub(crate) fn species_id(&self) -> u16 {
        // This is a simplified version - real implementation would decrypt the data
        // For now, return a placeholder value
        1 // Placeholder for Bulbasaur
    }
    
    /// Calculate stats based on base stats, IVs, EVs, and nature
    pub(crate) fn calculate_total_stats(&self, base_stats: &[u16; 6]) -> [u16; 6] {
        let level = self.level();
        let nature = self.nature();
        
        // For now, use placeholder IV/EV values
        // In full implementation, these would be extracted from encrypted data
        let ivs = [31, 31, 31, 31, 31, 31]; // Perfect IVs as placeholder
        let evs = [0, 0, 0, 0, 0, 0]; // No EVs as placeholder
        
        [
            calculate_hp_stat(base_stats[0], ivs[0], evs[0], level),
            calculate_stat(base_stats[1], ivs[1], evs[1], level, get_nature_modifier(&nature, 1)),
            calculate_stat(base_stats[2], ivs[2], evs[2], level, get_nature_modifier(&nature, 2)),
            calculate_stat(base_stats[3], ivs[3], evs[3], level, get_nature_modifier(&nature, 3)),
            calculate_stat(base_stats[4], ivs[4], evs[4], level, get_nature_modifier(&nature, 4)),
            calculate_stat(base_stats[5], ivs[5], evs[5], level, get_nature_modifier(&nature, 5)),
        ]
    }
}