/// Simplified core parsing functionality for Pokemon save files
/// Basic implementation to get WASM compilation working

/// Extract a 16-bit unsigned integer from bytes at given offset (little-endian)
fn read_u16_le(bytes : Bytes, offset : Int) -> Int {
  if offset + 2 > bytes.length() {
    0
  } else {
    let b0 = bytes[offset].to_int()
    let b1 = bytes[offset + 1].to_int()
    b0 + (b1 << 8)
  }
}

/// Extract an 8-bit unsigned integer from bytes at given offset
fn read_u8(bytes : Bytes, offset : Int) -> Int {
  if offset < bytes.length() {
    bytes[offset].to_int()
  } else {
    0
  }
}

/// Simple string decode - just convert printable ASCII for now
fn decode_simple_string(bytes : Bytes, start : Int, max_length : Int) -> String {
  let mut result = ""
  let mut i = 0
  while i < max_length && start + i < bytes.length() {
    let byte = bytes[start + i].to_int()
    if byte == 0xFF || byte == 0x00 {
      break
    }
    if byte >= 0x20 && byte <= 0x7E {
      result = result + Int::unsafe_to_char(byte).to_string()
    }
    i = i + 1
  }
  result
}

/// Parse a single Pokemon from raw bytes (simplified)
pub fn parse_pokemon_simple(pokemon_bytes : Bytes, offset : Int, config : GameConfig) -> Pokemon {
  // Basic unencrypted data (simplified - no encryption for now)
  let current_hp = read_u16_le(pokemon_bytes, offset + 0x56)
  let level = read_u8(pokemon_bytes, offset + 0x54)
  let max_hp = read_u16_le(pokemon_bytes, offset + 0x58)
  let attack = read_u16_le(pokemon_bytes, offset + 0x5A)
  let defense = read_u16_le(pokemon_bytes, offset + 0x5C)
  let speed = read_u16_le(pokemon_bytes, offset + 0x5E)
  let sp_attack = read_u16_le(pokemon_bytes, offset + 0x60)
  let sp_defense = read_u16_le(pokemon_bytes, offset + 0x62)
  
  // Get nickname and OT name (simplified)
  let nickname = decode_simple_string(pokemon_bytes, offset + 0x08, 10)
  let ot_name = decode_simple_string(pokemon_bytes, offset + 0x14, 7)
  
  // Simplified values for now
  let species_id = 1 // Placeholder
  let personality = 0
  let ot_id = 0
  let nature = "Hardy"
  let ability_number = 1
  let shiny_number = 0
  let status = 0

  // Create simple move, IV, EV data  
  let moves : PokemonMoves = { 
    move1: { id: 0, pp: 0 }, 
    move2: { id: 0, pp: 0 }, 
    move3: { id: 0, pp: 0 }, 
    move4: { id: 0, pp: 0 } 
  }
  let ivs : PokemonIVs = { 
    hp: 0, attack: 0, defense: 0, speed: 0, sp_attack: 0, sp_defense: 0 
  }
  let evs : PokemonEVs = { 
    hp: 0, attack: 0, defense: 0, speed: 0, sp_attack: 0, sp_defense: 0 
  }

  // Create a subset of bytes for raw_bytes (simplified)
  let raw_bytes = Bytes::make(config.pokemon_size, b'\x00')

  {
    species_id,
    nickname,
    ot_name,
    ot_id,
    level,
    current_hp,
    max_hp,
    attack,
    defense,
    speed,
    sp_attack,
    sp_defense,
    personality,
    nature,
    ability_number,
    shiny_number,
    status,
    moves,
    ivs,
    evs,
    raw_bytes
  }
}

/// Parse party Pokemon from save data (simplified)
pub fn parse_party_simple(save_data : Bytes, config : GameConfig) -> Array[Pokemon] {
  let party = Array::new()
  
  // Simplified: assume party starts at a known offset in slot 1
  let party_start = 14 * config.sector_size + config.party_offset // Slot 2, sector offset
  
  let mut slot = 0
  while slot < config.max_party_size {
    let pokemon_offset = party_start + slot * config.pokemon_size
    
    if pokemon_offset + config.pokemon_size <= save_data.length() {
      // Check if Pokemon exists (simplified - check if level > 0)
      let level = read_u8(save_data, pokemon_offset + 0x54)
      if level > 0 && level <= 100 {
        let pokemon = parse_pokemon_simple(save_data, pokemon_offset, config)
        party.push(pokemon)
      } else {
        break
      }
    }
    slot = slot + 1
  }
  
  party
}

/// Parse player name from save data (simplified)
pub fn parse_player_name_simple(save_data : Bytes, config : GameConfig) -> String {
  // Simplified: assume player name is at start of sector 0 in slot 2
  let name_offset = 14 * config.sector_size
  decode_simple_string(save_data, name_offset, 8)
}

/// Parse play time from save data (simplified)
pub fn parse_play_time_simple(save_data : Bytes, config : GameConfig) -> PlayTimeData {
  // Simplified: assume play time is at known offset in sector 0 
  let time_offset = 14 * config.sector_size + config.play_time_hours
  let hours = read_u16_le(save_data, time_offset)
  let minutes = read_u8(save_data, time_offset + 2)
  let seconds = read_u8(save_data, time_offset + 3)
  { hours, minutes, seconds }
}

/// Main simplified parse function
pub fn parse_save_file_simple(save_data : Bytes, config : GameConfig) -> SaveData {
  let party_pokemon = parse_party_simple(save_data, config)
  let player_name = parse_player_name_simple(save_data, config)
  let play_time = parse_play_time_simple(save_data, config)
  
  {
    party_pokemon,
    player_name,
    play_time,
    active_slot: 14 // Simplified: always use slot 2
  }
}