package core

import (
	"encoding/binary"
	"fmt"
)

// PokemonSaveParser represents the main save file parser
type PokemonSaveParser struct {
	saveData      []byte
	activeSlotStart int
	sectorMap     map[int]int
	forcedSlot    *int // 1 or 2
	config        GameConfig
	saveFileName  string
}

// NewPokemonSaveParser creates a new save parser instance
func NewPokemonSaveParser(forcedSlot *int, gameConfig GameConfig) *PokemonSaveParser {
	return &PokemonSaveParser{
		sectorMap:  make(map[int]int),
		forcedSlot: forcedSlot,
		config:     gameConfig,
	}
}

// LoadSaveData loads save data from bytes
func (p *PokemonSaveParser) LoadSaveData(data []byte) error {
	// Always clear sectorMap before loading new data
	p.sectorMap = make(map[int]int)
	p.saveData = make([]byte, len(data))
	copy(p.saveData, data)
	
	// Auto-detect game config if not provided
	if p.config == nil {
		detectedConfig, err := p.detectGameConfig(data)
		if err != nil {
			return fmt.Errorf("failed to detect game config: %w", err)
		}
		p.config = detectedConfig
	}
	
	return nil
}

// GetGameConfig returns the current game configuration
func (p *PokemonSaveParser) GetGameConfig() GameConfig {
	return p.config
}

// ParseSaveFile parses the loaded save data and returns SaveData
func (p *PokemonSaveParser) ParseSaveFile() (*SaveData, error) {
	if p.saveData == nil {
		return nil, fmt.Errorf("no save data loaded")
	}
	
	if p.config == nil {
		return nil, fmt.Errorf("no game config available")
	}
	
	// Determine active slot
	activeSlot := p.determineActiveSlot()
	
	// Calculate active slot start position
	saveLayout := p.config.GetSaveLayout()
	p.activeSlotStart = activeSlot * saveLayout.SaveBlockSize
	
	// Parse player name
	playerName, err := p.parsePlayerName()
	if err != nil {
		return nil, fmt.Errorf("failed to parse player name: %w", err)
	}
	
	// Parse play time
	playTime, err := p.parsePlayTime()
	if err != nil {
		return nil, fmt.Errorf("failed to parse play time: %w", err)
	}
	
	// Parse party Pokemon
	partyPokemon, err := p.parsePartyPokemon()
	if err != nil {
		return nil, fmt.Errorf("failed to parse party Pokemon: %w", err)
	}
	
	return &SaveData{
		PartyPokemon: partyPokemon,
		PlayerName:   playerName,
		PlayTime:     *playTime,
		ActiveSlot:   activeSlot,
		SectorMap:    p.sectorMap,
		RawSaveData:  p.saveData,
	}, nil
}

// detectGameConfig attempts to auto-detect the game configuration
func (p *PokemonSaveParser) detectGameConfig(data []byte) (GameConfig, error) {
	// This would need to be implemented with actual game configs
	// For now, return a basic vanilla config
	return NewVanillaEmeraldConfig(), nil
}

// determineActiveSlot determines which save slot is active
func (p *PokemonSaveParser) determineActiveSlot() int {
	if p.forcedSlot != nil {
		return *p.forcedSlot
	}
	
	// Use config's method if available
	getCounterSum := func(offsets []int) uint32 {
		var sum uint32
		for _, offset := range offsets {
			if offset+4 <= len(p.saveData) {
				sum += binary.LittleEndian.Uint32(p.saveData[offset:])
			}
		}
		return sum
	}
	
	return p.config.DetermineActiveSlot(getCounterSum)
}

// parsePlayerName extracts the player name from save data
func (p *PokemonSaveParser) parsePlayerName() (string, error) {
	// This is a simplified implementation
	// Real implementation would need to handle different game layouts
	// Placeholder - would need proper offset calculation
	playerNameOffset := p.activeSlotStart + 0x00 // This needs proper calculation
	if playerNameOffset+8 > len(p.saveData) {
		return "Unknown", nil
	}
	
	playerNameData := p.saveData[playerNameOffset : playerNameOffset+8]
	return DecodePokemonText(playerNameData), nil
}

// parsePlayTime extracts play time information
func (p *PokemonSaveParser) parsePlayTime() (*PlayTimeData, error) {
	saveLayout := p.config.GetSaveLayout()
	
	hoursOffset := p.activeSlotStart + saveLayout.PlayTimeHours
	minutesOffset := p.activeSlotStart + saveLayout.PlayTimeMinutes
	secondsOffset := p.activeSlotStart + saveLayout.PlayTimeSeconds
	
	if secondsOffset+1 > len(p.saveData) {
		return &PlayTimeData{Hours: 0, Minutes: 0, Seconds: 0}, nil
	}
	
	hours := binary.LittleEndian.Uint16(p.saveData[hoursOffset:])
	minutes := p.saveData[minutesOffset]
	seconds := p.saveData[secondsOffset]
	
	return &PlayTimeData{
		Hours:   hours,
		Minutes: minutes,
		Seconds: seconds,
	}, nil
}

// parsePartyPokemon extracts party Pokemon data
func (p *PokemonSaveParser) parsePartyPokemon() ([]PokemonData, error) {
	saveLayout := p.config.GetSaveLayout()
	pokemonSize := p.config.GetPokemonSize()
	maxPartySize := p.config.GetMaxPartySize()
	
	partyCountOffset := p.activeSlotStart + saveLayout.PartyCountOffset
	partyOffset := p.activeSlotStart + saveLayout.PartyOffset
	
	if partyCountOffset+4 > len(p.saveData) {
		return nil, fmt.Errorf("invalid party count offset")
	}
	
	partyCount := binary.LittleEndian.Uint32(p.saveData[partyCountOffset:])
	if int(partyCount) > maxPartySize {
		partyCount = uint32(maxPartySize) // Clamp to maximum
	}
	
	var partyPokemon []PokemonData
	
	for i := 0; i < int(partyCount); i++ {
		pokemonOffset := partyOffset + (i * pokemonSize)
		if pokemonOffset+pokemonSize > len(p.saveData) {
			break // Not enough data for this Pokemon
		}
		
		pokemonData := p.saveData[pokemonOffset : pokemonOffset+pokemonSize]
		pokemon, err := NewPokemonData(pokemonData, p.config)
		if err != nil {
			continue // Skip invalid Pokemon
		}
		
		partyPokemon = append(partyPokemon, *pokemon)
	}
	
	return partyPokemon, nil
}

// VanillaEmeraldConfig represents a basic vanilla Pokemon Emerald configuration
type VanillaEmeraldConfig struct {
	name       string
	signature  uint32
	pokemonSize int
	maxPartySize int
}

// NewVanillaEmeraldConfig creates a new vanilla Emerald config
func NewVanillaEmeraldConfig() GameConfig {
	return &VanillaEmeraldConfig{
		name:        "Pokemon Emerald (Vanilla)",
		signature:   VanillaEmeraldSignature,
		pokemonSize: 100,
		maxPartySize: 6,
	}
}

func (c *VanillaEmeraldConfig) GetName() string { return c.name }
func (c *VanillaEmeraldConfig) GetSignature() uint32 { return c.signature }
func (c *VanillaEmeraldConfig) GetPokemonSize() int { return c.pokemonSize }
func (c *VanillaEmeraldConfig) GetMaxPartySize() int { return c.maxPartySize }
func (c *VanillaEmeraldConfig) GetOffsetOverrides() map[string]int { return make(map[string]int) }
func (c *VanillaEmeraldConfig) GetSaveLayoutOverrides() map[string]int { return make(map[string]int) }
func (c *VanillaEmeraldConfig) GetSaveLayout() SaveLayout { return VanillaSaveLayout }
func (c *VanillaEmeraldConfig) GetMappings() *GameMappings { return nil }

func (c *VanillaEmeraldConfig) CanHandle(saveData []byte) bool {
	// Simple size check for now
	return len(saveData) >= 128*1024 // 128KB minimum
}

func (c *VanillaEmeraldConfig) CanHandleMemory(gameTitle string) bool {
	// Simple title check
	return gameTitle == "POKEMON EMER" || gameTitle == "Pokemon Emerald"
}

func (c *VanillaEmeraldConfig) DetermineActiveSlot(getCounterSum func([]int) uint32) int {
	// Simple implementation - always use slot 1
	return 1
}

func (c *VanillaEmeraldConfig) CalculateNature(personality uint32) string {
	// Simple nature calculation
	natures := []string{
		"Hardy", "Lonely", "Brave", "Adamant", "Naughty",
		"Bold", "Docile", "Relaxed", "Impish", "Lax",
		"Timid", "Hasty", "Serious", "Jolly", "Naive",
		"Modest", "Mild", "Quiet", "Bashful", "Rash",
		"Calm", "Gentle", "Sassy", "Careful", "Quirky",
	}
	return natures[personality%25]
}

func (c *VanillaEmeraldConfig) IsShiny(personality uint32, otID uint32) bool {
	// Simple shiny calculation
	return (personality^otID)&0xFFF8 == 0
}

func (c *VanillaEmeraldConfig) GetShinyValue(personality uint32, otID uint32) uint32 {
	return (personality ^ otID) & 0xFFFF
}