/// Core data structures for Pokemon save file parsing
/// This module defines the basic types and structures used throughout the parser

/// Pokemon stats structure
pub struct PokemonStats {
  hp : Int
  attack : Int
  defense : Int
  speed : Int
  sp_attack : Int
  sp_defense : Int
} derive(Show, Eq)

/// Move data with ID and PP
pub struct MoveData {
  id : Int
  pp : Int
} derive(Show, Eq)

/// Complete move set for a Pokemon
pub struct PokemonMoves {
  move1 : MoveData
  move2 : MoveData
  move3 : MoveData
  move4 : MoveData
} derive(Show, Eq)

/// Play time data structure
pub struct PlayTimeData {
  hours : Int
  minutes : Int
  seconds : Int
} derive(Show, Eq)

/// Individual Values (IVs) for Pokemon stats
pub struct PokemonIVs {
  hp : Int
  attack : Int
  defense : Int
  speed : Int
  sp_attack : Int
  sp_defense : Int
} derive(Show, Eq)

/// Effort Values (EVs) for Pokemon stats
pub struct PokemonEVs {
  hp : Int
  attack : Int
  defense : Int
  speed : Int
  sp_attack : Int
  sp_defense : Int
} derive(Show, Eq)

/// Pokemon data structure containing all relevant information
pub struct Pokemon {
  // Basic data
  species_id : Int
  nickname : String
  ot_name : String
  ot_id : Int
  level : Int
  
  // Combat stats
  current_hp : Int
  max_hp : Int
  attack : Int
  defense : Int
  speed : Int
  sp_attack : Int
  sp_defense : Int
  
  // Other properties
  personality : Int
  nature : String
  ability_number : Int
  shiny_number : Int
  status : Int
  
  // Moves, IVs, EVs
  moves : PokemonMoves
  ivs : PokemonIVs
  evs : PokemonEVs
  
  // Raw data for reconstruction
  raw_bytes : Bytes
} derive(Show)

/// Save data structure containing party and meta information
pub struct SaveData {
  party_pokemon : Array[Pokemon]
  player_name : String
  play_time : PlayTimeData
  active_slot : Int
} derive(Show)

/// Memory addresses for live memory parsing
pub struct MemoryAddresses {
  party_data : Int
  party_count : Int
  enemy_party : Int
  enemy_party_count : Int
  player_name : Int
  play_time : Int
} derive(Show)

/// Game configuration for different Pokemon games/ROM hacks
pub struct GameConfig {
  name : String
  signature : Int
  pokemon_size : Int
  max_party_size : Int
  sector_size : Int
  sector_data_size : Int
  save_block_size : Int
  party_offset : Int
  party_count_offset : Int
  play_time_hours : Int
  play_time_minutes : Int
  play_time_seconds : Int
  memory_addresses : Option[MemoryAddresses]
} derive(Show)

/// Default vanilla Pokemon Emerald configuration
pub fn default_emerald_config() -> GameConfig {
  {
    name: "Pokemon Emerald",
    signature: 0x08012025,
    pokemon_size: 100,
    max_party_size: 6,
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
