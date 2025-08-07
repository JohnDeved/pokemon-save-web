/// WebAssembly interface for Pokemon save parser
/// This module provides the JavaScript-callable functions

// Global storage for parsed save data and configs (using references)
let current_save_data : Ref[Option[SaveData]] = { val: None }
let current_config : Ref[GameConfig] = { val: default_emerald_config() }

/// Initialize parser with default Emerald config
/// Export to JavaScript as: init_parser()
pub fn init_parser() -> Unit {
  current_config.val = default_emerald_config()
  current_save_data.val = None
}

/// Set custom game configuration
/// Export to JavaScript as: set_config(name, signature, pokemon_size, max_party_size)
pub fn set_config(name : String, signature : Int, pokemon_size : Int, max_party_size : Int) -> Unit {
  current_config.val = {
    name,
    signature,
    pokemon_size,
    max_party_size,
    sector_size: 4096,
    sector_data_size: 3968,
    save_block_size: 3968 * 4,
    party_offset: 0x238,
    party_count_offset: 0x234,
    play_time_hours: 0x0E,
    play_time_minutes: 0x10,
    play_time_seconds: 0x11,
    memory_addresses: None,
  }
}

/// Parse save file from raw bytes  
/// Export to JavaScript as: parse_save_data(save_bytes)
pub fn parse_save_data(save_bytes : Bytes) -> Bool {
  let save_data = parse_save_file_simple(save_bytes, current_config.val)
  current_save_data.val = Some(save_data)
  true
}

/// Get number of Pokemon in party
/// Export to JavaScript as: get_party_count()
pub fn get_party_count() -> Int {
  match current_save_data.val {
    Some(data) => data.party_pokemon.length()
    None => 0
  }
}

/// Get Pokemon species ID by party index
/// Export to JavaScript as: get_pokemon_species_id(index)
pub fn get_pokemon_species_id(index : Int) -> Int {
  match current_save_data.val {
    Some(data) => {
      if index >= 0 && index < data.party_pokemon.length() {
        data.party_pokemon[index].species_id
      } else {
        0
      }
    }
    None => 0
  }
}

/// Get Pokemon nickname by party index
/// Export to JavaScript as: get_pokemon_nickname(index)
pub fn get_pokemon_nickname(index : Int) -> String {
  match current_save_data.val {
    Some(data) => {
      if index >= 0 && index < data.party_pokemon.length() {
        data.party_pokemon[index].nickname
      } else {
        ""
      }
    }
    None => ""
  }
}

/// Get Pokemon level by party index
/// Export to JavaScript as: get_pokemon_level(index) 
pub fn get_pokemon_level(index : Int) -> Int {
  match current_save_data.val {
    Some(data) => {
      if index >= 0 && index < data.party_pokemon.length() {
        data.party_pokemon[index].level
      } else {
        0
      }
    }
    None => 0
  }
}

/// Get Pokemon current HP by party index
/// Export to JavaScript as: get_pokemon_current_hp(index)
pub fn get_pokemon_current_hp(index : Int) -> Int {
  match current_save_data.val {
    Some(data) => {
      if index >= 0 && index < data.party_pokemon.length() {
        data.party_pokemon[index].current_hp
      } else {
        0
      }
    }
    None => 0
  }
}

/// Get Pokemon max HP by party index
/// Export to JavaScript as: get_pokemon_max_hp(index)
pub fn get_pokemon_max_hp(index : Int) -> Int {
  match current_save_data.val {
    Some(data) => {
      if index >= 0 && index < data.party_pokemon.length() {
        data.party_pokemon[index].max_hp
      } else {
        0
      }
    }
    None => 0
  }
}

/// Get Pokemon attack stat by party index
/// Export to JavaScript as: get_pokemon_attack(index)
pub fn get_pokemon_attack(index : Int) -> Int {
  match current_save_data.val {
    Some(data) => {
      if index >= 0 && index < data.party_pokemon.length() {
        data.party_pokemon[index].attack
      } else {
        0
      }
    }
    None => 0
  }
}

/// Get Pokemon defense stat by party index
/// Export to JavaScript as: get_pokemon_defense(index)
pub fn get_pokemon_defense(index : Int) -> Int {
  match current_save_data.val {
    Some(data) => {
      if index >= 0 && index < data.party_pokemon.length() {
        data.party_pokemon[index].defense
      } else {
        0
      }
    }
    None => 0
  }
}

/// Get Pokemon speed stat by party index
/// Export to JavaScript as: get_pokemon_speed(index)
pub fn get_pokemon_speed(index : Int) -> Int {
  match current_save_data.val {
    Some(data) => {
      if index >= 0 && index < data.party_pokemon.length() {
        data.party_pokemon[index].speed
      } else {
        0
      }
    }
    None => 0
  }
}

/// Get Pokemon special attack stat by party index
/// Export to JavaScript as: get_pokemon_sp_attack(index)
pub fn get_pokemon_sp_attack(index : Int) -> Int {
  match current_save_data.val {
    Some(data) => {
      if index >= 0 && index < data.party_pokemon.length() {
        data.party_pokemon[index].sp_attack
      } else {
        0
      }
    }
    None => 0
  }
}

/// Get Pokemon special defense stat by party index
/// Export to JavaScript as: get_pokemon_sp_defense(index)
pub fn get_pokemon_sp_defense(index : Int) -> Int {
  match current_save_data.val {
    Some(data) => {
      if index >= 0 && index < data.party_pokemon.length() {
        data.party_pokemon[index].sp_defense
      } else {
        0
      }
    }
    None => 0
  }
}

/// Get Pokemon nature by party index
/// Export to JavaScript as: get_pokemon_nature(index)
pub fn get_pokemon_nature(index : Int) -> String {
  match current_save_data.val {
    Some(data) => {
      if index >= 0 && index < data.party_pokemon.length() {
        data.party_pokemon[index].nature
      } else {
        ""
      }
    }
    None => ""
  }
}

/// Get Pokemon OT name by party index
/// Export to JavaScript as: get_pokemon_ot_name(index)
pub fn get_pokemon_ot_name(index : Int) -> String {
  match current_save_data.val {
    Some(data) => {
      if index >= 0 && index < data.party_pokemon.length() {
        data.party_pokemon[index].ot_name
      } else {
        ""
      }
    }
    None => ""
  }
}

/// Get Pokemon OT ID by party index
/// Export to JavaScript as: get_pokemon_ot_id(index)
pub fn get_pokemon_ot_id(index : Int) -> Int {
  match current_save_data.val {
    Some(data) => {
      if index >= 0 && index < data.party_pokemon.length() {
        data.party_pokemon[index].ot_id
      } else {
        0
      }
    }
    None => 0
  }
}

/// Get Pokemon ability number by party index
/// Export to JavaScript as: get_pokemon_ability_number(index)
pub fn get_pokemon_ability_number(index : Int) -> Int {
  match current_save_data.val {
    Some(data) => {
      if index >= 0 && index < data.party_pokemon.length() {
        data.party_pokemon[index].ability_number
      } else {
        0
      }
    }
    None => 0
  }
}

/// Get Pokemon shiny number by party index
/// Export to JavaScript as: get_pokemon_shiny_number(index)
pub fn get_pokemon_shiny_number(index : Int) -> Int {
  match current_save_data.val {
    Some(data) => {
      if index >= 0 && index < data.party_pokemon.length() {
        data.party_pokemon[index].shiny_number
      } else {
        0
      }
    }
    None => 0
  }
}

/// Get player name
/// Export to JavaScript as: get_player_name()
pub fn get_player_name() -> String {
  match current_save_data.val {
    Some(data) => data.player_name
    None => ""
  }
}

/// Get play time hours
/// Export to JavaScript as: get_play_time_hours()
pub fn get_play_time_hours() -> Int {
  match current_save_data.val {
    Some(data) => data.play_time.hours
    None => 0
  }
}

/// Get play time minutes
/// Export to JavaScript as: get_play_time_minutes()
pub fn get_play_time_minutes() -> Int {
  match current_save_data.val {
    Some(data) => data.play_time.minutes
    None => 0
  }
}

/// Get play time seconds
/// Export to JavaScript as: get_play_time_seconds()
pub fn get_play_time_seconds() -> Int {
  match current_save_data.val {
    Some(data) => data.play_time.seconds
    None => 0
  }
}

/// Get active save slot
/// Export to JavaScript as: get_active_slot()
pub fn get_active_slot() -> Int {
  match current_save_data.val {
    Some(data) => data.active_slot
    None => 0
  }
}

/// Get current game configuration name
/// Export to JavaScript as: get_config_name()
pub fn get_config_name() -> String {
  current_config.val.name
}