package core

// PlayTimeData represents the play time information
type PlayTimeData struct {
	Hours   uint16 `json:"hours"`
	Minutes uint8  `json:"minutes"`
	Seconds uint8  `json:"seconds"`
}

// PokemonStats represents Pokemon battle statistics
type PokemonStats struct {
	HP        uint16 `json:"hp"`
	Attack    uint16 `json:"attack"`
	Defense   uint16 `json:"defense"`
	Speed     uint16 `json:"speed"`
	SpAttack  uint16 `json:"sp_attack"`
	SpDefense uint16 `json:"sp_defense"`
}

// MoveData represents a Pokemon move with its PP
type MoveData struct {
	ID uint16 `json:"id"`
	PP uint8  `json:"pp"`
}

// PokemonMoves represents all four moves of a Pokemon
type PokemonMoves struct {
	Move1 MoveData `json:"move1"`
	Move2 MoveData `json:"move2"`
	Move3 MoveData `json:"move3"`
	Move4 MoveData `json:"move4"`
}

// PokemonEVs represents effort values
type PokemonEVs struct {
	HP        uint8 `json:"hp"`
	Attack    uint8 `json:"attack"`
	Defense   uint8 `json:"defense"`
	Speed     uint8 `json:"speed"`
	SpAttack  uint8 `json:"sp_attack"`
	SpDefense uint8 `json:"sp_defense"`
}

// PokemonIVs represents individual values
type PokemonIVs struct {
	HP        uint8 `json:"hp"`
	Attack    uint8 `json:"attack"`
	Defense   uint8 `json:"defense"`
	Speed     uint8 `json:"speed"`
	SpAttack  uint8 `json:"sp_attack"`
	SpDefense uint8 `json:"sp_defense"`
}

// SectorInfo represents save file sector information
type SectorInfo struct {
	ID       uint8  `json:"id"`
	Checksum uint16 `json:"checksum"`
	Counter  uint32 `json:"counter"`
	Valid    bool   `json:"valid"`
}

// SaveData represents the complete parsed save data
type SaveData struct {
	PartyPokemon []PokemonData  `json:"party_pokemon"`
	PlayerName   string         `json:"player_name"`
	PlayTime     PlayTimeData   `json:"play_time"`
	ActiveSlot   int            `json:"active_slot"`
	SectorMap    map[int]int    `json:"sector_map,omitempty"`
	RawSaveData  []byte         `json:"raw_save_data,omitempty"`
}

// Mapping interfaces for ID translation
type BaseMapping struct {
	Name   string `json:"name"`
	IDName string `json:"id_name"`
}

type PokemonMapping struct {
	BaseMapping
	ID int `json:"id"`
}

type ItemMapping struct {
	BaseMapping
	ID *int `json:"id"` // Allow nil for unmapped items
}

type MoveMapping struct {
	BaseMapping
	ID *int `json:"id"` // Allow nil for unmapped moves
}

// Vanilla Pokemon Emerald configuration constants
const (
	VanillaEmeraldSignature = 0x08012025
)

// PokemonOffsets defines the vanilla Pokemon data layout
type PokemonOffsets struct {
	Personality    int
	OTID           int
	Nickname       int
	NicknameLength int
	OTName         int
	OTNameLength   int
	CurrentHP      int
	MaxHP          int
	Attack         int
	Defense        int
	Speed          int
	SpAttack       int
	SpDefense      int
	Status         int
	Level          int
}

// VanillaPokemonOffsets represents the vanilla Pokemon Emerald data structure
var VanillaPokemonOffsets = PokemonOffsets{
	Personality:    0x00,
	OTID:           0x04,
	Nickname:       0x08,
	NicknameLength: 10,
	OTName:         0x14,
	OTNameLength:   7,
	CurrentHP:      0x56,
	MaxHP:          0x58,
	Attack:         0x5A,
	Defense:        0x5C,
	Speed:          0x5E,
	SpAttack:       0x60,
	SpDefense:      0x62,
	Status:         0x50,
	Level:          0x54,
}

// SaveLayout defines the vanilla save file structure
type SaveLayout struct {
	SectorSize       int
	SectorDataSize   int
	SectorCount      int
	SlotsPerSave     int
	SaveBlockSize    int
	PartyOffset      int
	PartyCountOffset int
	PlayTimeHours    int
	PlayTimeMinutes  int
	PlayTimeSeconds  int
	PlayTimeMS       int
}

// VanillaSaveLayout represents the vanilla Pokemon Emerald save structure
var VanillaSaveLayout = SaveLayout{
	SectorSize:       4096,
	SectorDataSize:   3968,
	SectorCount:      32,
	SlotsPerSave:     18,
	SaveBlockSize:    3968 * 4,
	PartyOffset:      0x238,
	PartyCountOffset: 0x234,
	PlayTimeHours:    0x0E,
	PlayTimeMinutes:  0x10,
	PlayTimeSeconds:  0x11,
	PlayTimeMS:       0x12,
}

// GameConfig interface represents game-specific configuration
type GameConfig interface {
	GetName() string
	GetSignature() uint32
	GetPokemonSize() int
	GetMaxPartySize() int
	GetOffsetOverrides() map[string]int
	GetSaveLayoutOverrides() map[string]int
	GetSaveLayout() SaveLayout
	GetMappings() *GameMappings
	CanHandle(saveData []byte) bool
	CanHandleMemory(gameTitle string) bool
	DetermineActiveSlot(getCounterSum func([]int) uint32) int
	CalculateNature(personality uint32) string
	IsShiny(personality uint32, otID uint32) bool
	GetShinyValue(personality uint32, otID uint32) uint32
}

// GameMappings represents ID mapping data
type GameMappings struct {
	Pokemon map[int]PokemonMapping
	Items   map[int]ItemMapping
	Moves   map[int]MoveMapping
}

// MemoryAddresses for emulator integration
type MemoryAddresses struct {
	PartyData      uint32
	PartyCount     uint32
	EnemyParty     uint32
	EnemyPartyCount uint32
	PlayerName     *uint32
	PlayTime       *uint32
}

// PreloadRegion for memory watching
type PreloadRegion struct {
	Address uint32
	Size    int
}