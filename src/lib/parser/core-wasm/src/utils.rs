use crate::types::NATURES;
use wasm_bindgen::prelude::*;

// Character mapping for GBA Pokemon text encoding
// This is a subset of the full character map for common characters
// Full map would be loaded from JSON in a real implementation
const GBA_CHAR_MAP: [(u8, char); 91] = [
    (0x00, ' '), (0xA1, '0'), (0xA2, '1'), (0xA3, '2'), (0xA4, '3'), (0xA5, '4'),
    (0xA6, '5'), (0xA7, '6'), (0xA8, '7'), (0xA9, '8'), (0xAA, '9'), (0xBB, 'A'),
    (0xBC, 'B'), (0xBD, 'C'), (0xBE, 'D'), (0xBF, 'E'), (0xC0, 'F'), (0xC1, 'G'),
    (0xC2, 'H'), (0xC3, 'I'), (0xC4, 'J'), (0xC5, 'K'), (0xC6, 'L'), (0xC7, 'M'),
    (0xC8, 'N'), (0xC9, 'O'), (0xCA, 'P'), (0xCB, 'Q'), (0xCC, 'R'), (0xCD, 'S'),
    (0xCE, 'T'), (0xCF, 'U'), (0xD0, 'V'), (0xD1, 'W'), (0xD2, 'X'), (0xD3, 'Y'),
    (0xD4, 'Z'), (0xD5, 'a'), (0xD6, 'b'), (0xD7, 'c'), (0xD8, 'd'), (0xD9, 'e'),
    (0xDA, 'f'), (0xDB, 'g'), (0xDC, 'h'), (0xDD, 'i'), (0xDE, 'j'), (0xDF, 'k'),
    (0xE0, 'l'), (0xE1, 'm'), (0xE2, 'n'), (0xE3, 'o'), (0xE4, 'p'), (0xE5, 'q'),
    (0xE6, 'r'), (0xE7, 's'), (0xE8, 't'), (0xE9, 'u'), (0xEA, 'v'), (0xEB, 'w'),
    (0xEC, 'x'), (0xED, 'y'), (0xEE, 'z'), (0x34, '!'), (0x35, '?'), (0x36, '.'),
    (0x37, '-'), (0x38, '·'), (0x39, '…'), (0x3A, '"'), (0x3B, '"'), (0x3C, '\''),
    (0x3D, '\''), (0x3E, '♂'), (0x3F, '♀'), (0x51, '/'), (0x54, ','), (0x55, '×'),
    (0x79, '+'), (0x7A, '%'), (0x7B, '('), (0x7C, ')'), (0x85, '&'), (0x68, ':'),
    (0x69, ';'), (0x6A, '['), (0x6B, ']'), (0x2D, '<'), (0x2E, '>'), 
    (0x50, ' '), (0xFF, '\0'), // Space and null terminator
];

/// Convert GBA-encoded bytes to a readable string
#[wasm_bindgen]
pub fn bytes_to_gba_string(bytes: &[u8]) -> String {
    let mut result = String::new();
    let end_index = find_string_end(bytes);
    
    for &byte in &bytes[..end_index] {
        if let Some((_, char)) = GBA_CHAR_MAP.iter().find(|(b, _)| *b == byte) {
            if *char != '\0' {
                result.push(*char);
            }
        }
    }
    
    result.trim().to_string()
}

/// Find the actual end of a Pokemon GBA string by detecting padding patterns
fn find_string_end(bytes: &[u8]) -> usize {
    // Check for trailing 0xFF padding (more than 2 suggests padding)
    let mut trailing_ffs = 0;
    for &byte in bytes.iter().rev() {
        if byte == 0xFF {
            trailing_ffs += 1;
        } else {
            break;
        }
    }
    
    if trailing_ffs > 2 {
        return bytes.len() - trailing_ffs;
    }
    
    // Look for garbage pattern: 0xFF followed by low values (0x01-0x0F)
    for (i, &byte) in bytes.iter().enumerate() {
        if byte == 0xFF && i + 1 < bytes.len() {
            for &next_byte in &bytes[i + 1..] {
                if next_byte > 0 && next_byte < 0x10 {
                    return i; // Found garbage
                }
                if next_byte != 0xFF && next_byte != 0 {
                    break;
                }
            }
        }
    }
    
    bytes.len()
}

/// Convert a string to GBA-encoded bytes
#[wasm_bindgen]
pub fn gba_string_to_bytes(text: &str, length: usize) -> Vec<u8> {
    let mut bytes = vec![0xFF; length]; // Fill with padding
    let mut i = 0;
    
    for ch in text.chars() {
        if i >= length {
            break;
        }
        
        // Find the byte for this character
        if let Some((byte, _)) = GBA_CHAR_MAP.iter().find(|(_, c)| *c == ch) {
            bytes[i] = *byte;
            i += 1;
        } else {
            bytes[i] = 0x00; // Unknown character
            i += 1;
        }
    }
    
    bytes
}

/// Get Pokemon nature from personality value
#[wasm_bindgen]
pub fn get_pokemon_nature(personality: u32) -> String {
    let nature_index = (personality % 25) as usize;
    NATURES[nature_index].to_string()
}

/// Calculate sector checksum for Pokemon save data
#[wasm_bindgen]
pub fn calculate_sector_checksum(sector_data: &[u8]) -> u16 {
    let mut checksum: u32 = 0;
    
    // Process in 4-byte chunks (little-endian u32)
    for chunk in sector_data.chunks(4) {
        if chunk.len() == 4 {
            let value = u32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
            checksum = checksum.wrapping_add(value);
        }
    }
    
    // Return 16-bit checksum
    ((checksum >> 16) + (checksum & 0xFFFF)) as u16 & 0xFFFF
}

/// Read a little-endian u16 from bytes at offset
#[wasm_bindgen]
pub fn read_u16_le(bytes: &[u8], offset: usize) -> u16 {
    if offset + 2 <= bytes.len() {
        u16::from_le_bytes([bytes[offset], bytes[offset + 1]])
    } else {
        0
    }
}

/// Read a little-endian u32 from bytes at offset
#[wasm_bindgen]
pub fn read_u32_le(bytes: &[u8], offset: usize) -> u32 {
    if offset + 4 <= bytes.len() {
        u32::from_le_bytes([bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]])
    } else {
        0
    }
}

/// Write a little-endian u16 to bytes at offset
pub fn write_u16_le(bytes: &mut [u8], offset: usize, value: u16) {
    if offset + 2 <= bytes.len() {
        let value_bytes = value.to_le_bytes();
        bytes[offset] = value_bytes[0];
        bytes[offset + 1] = value_bytes[1];
    }
}

/// Write a little-endian u32 to bytes at offset  
pub fn write_u32_le(bytes: &mut [u8], offset: usize, value: u32) {
    if offset + 4 <= bytes.len() {
        let value_bytes = value.to_le_bytes();
        bytes[offset] = value_bytes[0];
        bytes[offset + 1] = value_bytes[1];
        bytes[offset + 2] = value_bytes[2];
        bytes[offset + 3] = value_bytes[3];
    }
}

/// Check if Pokemon is shiny based on personality and OT ID
#[wasm_bindgen]
pub fn is_pokemon_shiny(personality: u32, ot_id: u32) -> bool {
    let shiny_value = get_shiny_value(personality, ot_id);
    shiny_value < 8
}

/// Get the shiny value for determining shininess
#[wasm_bindgen]
pub fn get_shiny_value(personality: u32, ot_id: u32) -> u16 {
    let pid_high = (personality >> 16) as u16;
    let pid_low = (personality & 0xFFFF) as u16;
    let ot_high = (ot_id >> 16) as u16;
    let ot_low = (ot_id & 0xFFFF) as u16;
    
    pid_high ^ pid_low ^ ot_high ^ ot_low
}

/// Format playtime as a human-readable string
#[wasm_bindgen]
pub fn format_play_time(hours: u16, minutes: u8, seconds: u8) -> String {
    format!("{}:{:02}:{:02}", hours, minutes, seconds)
}

/// Calculate total HP stat
pub fn calculate_hp_stat(base: u16, iv: u8, ev: u8, level: u8) -> u16 {
    let base = base as u32;
    let iv = iv as u32;
    let ev = ev as u32;
    let level = level as u32;
    
    ((((2 * base + iv + (ev / 4)) * level) / 100) + level + 10) as u16
}

/// Calculate non-HP stat with nature modifier
pub fn calculate_stat(base: u16, iv: u8, ev: u8, level: u8, nature_modifier: f32) -> u16 {
    let base = base as u32;
    let iv = iv as u32;
    let ev = ev as u32;
    let level = level as u32;
    
    let stat = (((2 * base + iv + (ev / 4)) * level) / 100) + 5;
    (stat as f32 * nature_modifier) as u16
}

/// Get nature modifier for a stat
pub fn get_nature_modifier(nature: &str, stat_index: u8) -> f32 {
    // Nature effects: [increased_stat, decreased_stat]
    // Stats: 0=HP, 1=Atk, 2=Def, 3=Spe, 4=SpA, 5=SpD
    let nature_effects = match nature {
        "Lonely" => (1, 2), "Brave" => (1, 3), "Adamant" => (1, 4), "Naughty" => (1, 5),
        "Bold" => (2, 1), "Relaxed" => (2, 3), "Impish" => (2, 4), "Lax" => (2, 5),
        "Timid" => (3, 1), "Hasty" => (3, 2), "Jolly" => (3, 4), "Naive" => (3, 5),
        "Modest" => (4, 1), "Mild" => (4, 2), "Quiet" => (4, 3), "Rash" => (4, 5),
        "Calm" => (5, 1), "Gentle" => (5, 2), "Sassy" => (5, 3), "Careful" => (5, 4),
        _ => (0, 0), // Neutral natures or unknown
    };
    
    if stat_index == nature_effects.0 { 1.1 }
    else if stat_index == nature_effects.1 { 0.9 }
    else { 1.0 }
}