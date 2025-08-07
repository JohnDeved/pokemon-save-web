use crate::pokemon::Pokemon;
use crate::types::{
    SaveData, PlayTimeData, SectorInfo, SaveLayout,
    VANILLA_EMERALD_SIGNATURE, POKEMON_SIZE, SECTOR_SIZE, SECTOR_DATA_SIZE
};
use crate::utils::{
    bytes_to_gba_string, calculate_sector_checksum, read_u16_le, read_u32_le
};
use wasm_bindgen::prelude::*;
use wasm_bindgen::prelude::*;
use std::collections::HashMap;

#[wasm_bindgen]
pub struct SaveParser {
    save_data: Vec<u8>,
    active_slot_start: usize,
    sector_map: HashMap<u16, usize>,
}

#[wasm_bindgen]
impl SaveParser {
    /// Create a new SaveParser instance
    #[wasm_bindgen(constructor)]
    pub fn new() -> SaveParser {
        SaveParser {
            save_data: Vec::new(),
            active_slot_start: 0,
            sector_map: HashMap::new(),
        }
    }
    
    /// Load save data from bytes
    #[wasm_bindgen]
    pub fn load_save_data(&mut self, data: &[u8]) -> Result<(), JsError> {
        if data.len() < 131072 { // 128KB minimum for Emerald save
            return Err(JsError::new("Save file too small"));
        }
        
        self.save_data = data.to_vec();
        self.determine_active_slot();
        self.build_sector_map();
        
        Ok(())
    }
    
    /// Parse the complete save data and return SaveData
    #[wasm_bindgen]
    pub fn parse(&self) -> Result<SaveData, JsError> {
        if self.save_data.is_empty() {
            return Err(JsError::new("No save data loaded"));
        }
        
        let _saveblock1_data = self.extract_saveblock1()?;
        let saveblock2_data = self.extract_saveblock2()?;
        
        let player_name = self.parse_player_name(&saveblock2_data);
        let play_time = self.parse_play_time(&saveblock2_data);
        // Note: In full implementation, party_pokemon would be stored in SaveData
        // For now, we'll access them separately via get_party_pokemon()
        
        Ok(SaveData::new(
            player_name,
            (self.active_slot_start / 14) as u8, // Convert to slot number
            play_time,
        ))
    }
    
    /// Get party Pokemon from the save data
    #[wasm_bindgen]
    pub fn get_party_pokemon(&self) -> Result<Vec<Pokemon>, JsError> {
        if self.save_data.is_empty() {
            return Err(JsError::new("No save data loaded"));
        }
        
        let saveblock1_data = self.extract_saveblock1()?;
        self.parse_party_pokemon(&saveblock1_data)
    }
    
    /// Get player name from save data
    #[wasm_bindgen]
    pub fn get_player_name(&self) -> Result<String, JsError> {
        let saveblock2_data = self.extract_saveblock2()?;
        Ok(self.parse_player_name(&saveblock2_data))
    }
    
    /// Get play time from save data
    #[wasm_bindgen]
    pub fn get_play_time(&self) -> Result<PlayTimeData, JsError> {
        let saveblock2_data = self.extract_saveblock2()?;
        Ok(self.parse_play_time(&saveblock2_data))
    }
    
    /// Get information about all sectors
    #[wasm_bindgen]
    pub fn get_sector_info(&self, sector_index: usize) -> SectorInfo {
        self.get_sector_info_internal(sector_index)
    }
    
    /// Get the active slot number (1 or 2)
    #[wasm_bindgen]
    pub fn get_active_slot(&self) -> u8 {
        if self.active_slot_start == 0 { 1 } else { 2 }
    }
    
    /// Get total number of valid sectors found
    #[wasm_bindgen]
    pub fn get_valid_sector_count(&self) -> usize {
        self.sector_map.len()
    }
}

// Internal implementation methods
impl SaveParser {
    /// Determine which save slot is active based on sector counters
    fn determine_active_slot(&mut self) {
        let slot1_counter_sum = self.get_counter_sum(&(0..14).collect::<Vec<_>>());
        let slot2_counter_sum = self.get_counter_sum(&(14..32).collect::<Vec<_>>());
        
        // The slot with higher counter sum is active
        self.active_slot_start = if slot2_counter_sum > slot1_counter_sum { 14 } else { 0 };
    }
    
    /// Get sum of counters for given sector range
    fn get_counter_sum(&self, sector_range: &[usize]) -> u32 {
        sector_range.iter()
            .map(|&i| self.get_sector_info_internal(i))
            .filter(|info| info.valid())
            .map(|info| info.counter())
            .sum()
    }
    
    /// Build a mapping of sector IDs to physical sector indices
    fn build_sector_map(&mut self) {
        self.sector_map.clear();
        
        // Check sectors in the active slot
        let sector_range = if self.active_slot_start == 0 {
            0..14 // Slot 1: sectors 0-13
        } else {
            14..32 // Slot 2: sectors 14-31
        };
        
        for i in sector_range {
            let sector_info = self.get_sector_info_internal(i);
            if sector_info.valid() {
                self.sector_map.insert(sector_info.id(), i);
            }
        }
    }
    
    /// Get information about a specific sector
    fn get_sector_info_internal(&self, sector_index: usize) -> SectorInfo {
        if self.save_data.is_empty() {
            return SectorInfo::new(0, 0, 0, false);
        }
        
        let footer_offset = (sector_index * SECTOR_SIZE) + SECTOR_SIZE - 12;
        
        if footer_offset + 12 > self.save_data.len() {
            return SectorInfo::new(0, 0, 0, false);
        }
        
        let sector_id = read_u16_le(&self.save_data, footer_offset);
        let checksum = read_u16_le(&self.save_data, footer_offset + 2);
        let signature = read_u32_le(&self.save_data, footer_offset + 4);
        let counter = read_u32_le(&self.save_data, footer_offset + 8);
        
        // Verify signature matches Pokemon Emerald
        if signature != VANILLA_EMERALD_SIGNATURE {
            return SectorInfo::new(sector_id, checksum, counter, false);
        }
        
        // Verify checksum
        let sector_start = sector_index * SECTOR_SIZE;
        let sector_data = &self.save_data[sector_start..sector_start + SECTOR_DATA_SIZE];
        let calculated_checksum = calculate_sector_checksum(sector_data);
        let valid = calculated_checksum == checksum;
        
        SectorInfo::new(sector_id, checksum, counter, valid)
    }
    
    /// Extract SaveBlock1 data from sectors 1-4
    fn extract_saveblock1(&self) -> Result<Vec<u8>, JsError> {
        let mut saveblock1_data = vec![0u8; SECTOR_DATA_SIZE * 4]; // 4 sectors
        
        for sector_id in 1..=4 {
            if let Some(&sector_idx) = self.sector_map.get(&sector_id) {
                let start_offset = sector_idx * SECTOR_SIZE;
                let sector_data = &self.save_data[start_offset..start_offset + SECTOR_DATA_SIZE];
                let chunk_offset = ((sector_id - 1) * SECTOR_DATA_SIZE as u16) as usize;
                
                saveblock1_data[chunk_offset..chunk_offset + SECTOR_DATA_SIZE]
                    .copy_from_slice(sector_data);
            }
        }
        
        Ok(saveblock1_data)
    }
    
    /// Extract SaveBlock2 data from sector 0
    fn extract_saveblock2(&self) -> Result<Vec<u8>, JsError> {
        if let Some(&sector_idx) = self.sector_map.get(&0) {
            let start_offset = sector_idx * SECTOR_SIZE;
            Ok(self.save_data[start_offset..start_offset + SECTOR_DATA_SIZE].to_vec())
        } else {
            Err(JsError::new("SaveBlock2 sector (ID 0) not found"))
        }
    }
    
    /// Parse party Pokemon from SaveBlock1 data
    fn parse_party_pokemon(&self, saveblock1_data: &[u8]) -> Result<Vec<Pokemon>, JsError> {
        let mut party_pokemon = Vec::new();
        
        // Get party count
        if SaveLayout::PARTY_COUNT_OFFSET >= saveblock1_data.len() {
            return Ok(party_pokemon);
        }
        
        let party_count = saveblock1_data[SaveLayout::PARTY_COUNT_OFFSET];
        
        // Debug: Log the actual bytes we're reading
        if saveblock1_data.len() > SaveLayout::PARTY_COUNT_OFFSET + 10 {
            let context_start = SaveLayout::PARTY_COUNT_OFFSET.saturating_sub(5);
            let context_end = (SaveLayout::PARTY_COUNT_OFFSET + 10).min(saveblock1_data.len());
            let context_bytes: Vec<String> = saveblock1_data[context_start..context_end]
                .iter()
                .enumerate()
                .map(|(i, b)| {
                    let offset = context_start + i;
                    if offset == SaveLayout::PARTY_COUNT_OFFSET {
                        format!("[{:02x}]", b) // Mark the target byte
                    } else {
                        format!("{:02x}", b)
                    }
                })
                .collect();
            crate::console_log!(
                "Party count at offset 0x{:x} in SaveBlock1: {} (context: {})",
                SaveLayout::PARTY_COUNT_OFFSET,
                party_count,
                context_bytes.join(" ")
            );
        }
        
        let max_party_size = 12; // Increase limit to handle different game variants
        
        if party_count > max_party_size {
            return Err(JsError::new(&format!("Invalid party count: {}", party_count)));
        }
        
        // Also check if party_count seems reasonable
        if party_count == 0 {
            return Ok(party_pokemon); // No Pokemon in party
        }
        
        // Parse each Pokemon in the party
        for slot in 0..party_count as usize {
            let offset = SaveLayout::PARTY_OFFSET + slot * POKEMON_SIZE;
            
            if offset + POKEMON_SIZE > saveblock1_data.len() {
                break;
            }
            
            let pokemon_data = &saveblock1_data[offset..offset + POKEMON_SIZE];
            
            match Pokemon::from_bytes(pokemon_data) {
                Ok(pokemon) => {
                    if pokemon.is_valid() {
                        party_pokemon.push(pokemon);
                    } else {
                        break; // Stop at first invalid Pokemon
                    }
                }
                Err(_) => break,
            }
        }
        
        Ok(party_pokemon)
    }
    
    /// Parse player name from SaveBlock2 data
    fn parse_player_name(&self, saveblock2_data: &[u8]) -> String {
        if saveblock2_data.len() < 8 {
            return "Unknown".to_string();
        }
        
        let player_name_bytes = &saveblock2_data[0..8];
        let name = bytes_to_gba_string(player_name_bytes);
        
        if name.is_empty() {
            "Unknown".to_string()
        } else {
            name
        }
    }
    
    /// Parse play time from SaveBlock2 data
    fn parse_play_time(&self, saveblock2_data: &[u8]) -> PlayTimeData {
        if saveblock2_data.len() < SaveLayout::PLAY_TIME_SECONDS + 1 {
            return PlayTimeData::new(0, 0, 0);
        }
        
        let hours = read_u16_le(saveblock2_data, SaveLayout::PLAY_TIME_HOURS);
        let minutes = if SaveLayout::PLAY_TIME_MINUTES < saveblock2_data.len() {
            saveblock2_data[SaveLayout::PLAY_TIME_MINUTES]
        } else {
            0
        };
        let seconds = if SaveLayout::PLAY_TIME_SECONDS < saveblock2_data.len() {
            saveblock2_data[SaveLayout::PLAY_TIME_SECONDS]
        } else {
            0
        };
        
        PlayTimeData::new(hours, minutes, seconds)
    }
}