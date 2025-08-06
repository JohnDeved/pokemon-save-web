package core

import (
	"encoding/binary"
	"fmt"
)

// PokemonData represents a Pokemon with all its data
type PokemonData struct {
	data   []byte
	config GameConfig
	offsets PokemonOffsets
	saveLayout SaveLayout
}

// NewPokemonData creates a new Pokemon data instance
func NewPokemonData(data []byte, config GameConfig) (*PokemonData, error) {
	if len(data) < config.GetPokemonSize() {
		return nil, fmt.Errorf("insufficient data for Pokemon: %d bytes", len(data))
	}
	
	// Merge config overrides with vanilla defaults
	offsets := VanillaPokemonOffsets
	for k, v := range config.GetOffsetOverrides() {
		switch k {
		case "personality":
			offsets.Personality = v
		case "otId":
			offsets.OTID = v
		case "nickname":
			offsets.Nickname = v
		case "nicknameLength":
			offsets.NicknameLength = v
		case "otName":
			offsets.OTName = v
		case "otNameLength":
			offsets.OTNameLength = v
		case "currentHp":
			offsets.CurrentHP = v
		case "maxHp":
			offsets.MaxHP = v
		case "attack":
			offsets.Attack = v
		case "defense":
			offsets.Defense = v
		case "speed":
			offsets.Speed = v
		case "spAttack":
			offsets.SpAttack = v
		case "spDefense":
			offsets.SpDefense = v
		case "status":
			offsets.Status = v
		case "level":
			offsets.Level = v
		}
	}
	
	// Merge save layout overrides
	saveLayout := VanillaSaveLayout
	for k, v := range config.GetSaveLayoutOverrides() {
		switch k {
		case "sectorSize":
			saveLayout.SectorSize = v
		case "sectorDataSize":
			saveLayout.SectorDataSize = v
		case "sectorCount":
			saveLayout.SectorCount = v
		case "slotsPerSave":
			saveLayout.SlotsPerSave = v
		case "saveBlockSize":
			saveLayout.SaveBlockSize = v
		case "partyOffset":
			saveLayout.PartyOffset = v
		case "partyCountOffset":
			saveLayout.PartyCountOffset = v
		case "playTimeHours":
			saveLayout.PlayTimeHours = v
		case "playTimeMinutes":
			saveLayout.PlayTimeMinutes = v
		case "playTimeSeconds":
			saveLayout.PlayTimeSeconds = v
		case "playTimeMS":
			saveLayout.PlayTimeMS = v
		}
	}
	
	return &PokemonData{
		data:       data,
		config:     config,
		offsets:    offsets,
		saveLayout: saveLayout,
	}, nil
}

// Basic unencrypted properties (common to all games)
func (p *PokemonData) GetPersonality() uint32 {
	return binary.LittleEndian.Uint32(p.data[p.offsets.Personality:])
}

func (p *PokemonData) GetOTID() uint32 {
	return binary.LittleEndian.Uint32(p.data[p.offsets.OTID:])
}

func (p *PokemonData) GetCurrentHP() uint16 {
	return binary.LittleEndian.Uint16(p.data[p.offsets.CurrentHP:])
}

func (p *PokemonData) GetMaxHP() uint16 {
	return binary.LittleEndian.Uint16(p.data[p.offsets.MaxHP:])
}

func (p *PokemonData) SetMaxHP(value uint16) {
	binary.LittleEndian.PutUint16(p.data[p.offsets.MaxHP:], value)
}

func (p *PokemonData) GetAttack() uint16 {
	return binary.LittleEndian.Uint16(p.data[p.offsets.Attack:])
}

func (p *PokemonData) SetAttack(value uint16) {
	binary.LittleEndian.PutUint16(p.data[p.offsets.Attack:], value)
}

func (p *PokemonData) GetDefense() uint16 {
	return binary.LittleEndian.Uint16(p.data[p.offsets.Defense:])
}

func (p *PokemonData) SetDefense(value uint16) {
	binary.LittleEndian.PutUint16(p.data[p.offsets.Defense:], value)
}

func (p *PokemonData) GetSpeed() uint16 {
	return binary.LittleEndian.Uint16(p.data[p.offsets.Speed:])
}

func (p *PokemonData) SetSpeed(value uint16) {
	binary.LittleEndian.PutUint16(p.data[p.offsets.Speed:], value)
}

func (p *PokemonData) GetSpAttack() uint16 {
	return binary.LittleEndian.Uint16(p.data[p.offsets.SpAttack:])
}

func (p *PokemonData) SetSpAttack(value uint16) {
	binary.LittleEndian.PutUint16(p.data[p.offsets.SpAttack:], value)
}

func (p *PokemonData) GetSpDefense() uint16 {
	return binary.LittleEndian.Uint16(p.data[p.offsets.SpDefense:])
}

func (p *PokemonData) SetSpDefense(value uint16) {
	binary.LittleEndian.PutUint16(p.data[p.offsets.SpDefense:], value)
}

func (p *PokemonData) GetStatus() uint8 {
	return p.data[p.offsets.Status]
}

func (p *PokemonData) GetLevel() uint8 {
	return p.data[p.offsets.Level]
}

func (p *PokemonData) GetNickname() string {
	nicknameData := p.data[p.offsets.Nickname : p.offsets.Nickname+p.offsets.NicknameLength]
	return DecodePokemonText(nicknameData)
}

func (p *PokemonData) SetNickname(nickname string) {
	nicknameData := EncodePokemonText(nickname, p.offsets.NicknameLength)
	copy(p.data[p.offsets.Nickname:p.offsets.Nickname+p.offsets.NicknameLength], nicknameData)
}

func (p *PokemonData) GetOTName() string {
	otNameData := p.data[p.offsets.OTName : p.offsets.OTName+p.offsets.OTNameLength]
	return DecodePokemonText(otNameData)
}

func (p *PokemonData) SetOTName(otName string) {
	otNameData := EncodePokemonText(otName, p.offsets.OTNameLength)
	copy(p.data[p.offsets.OTName:p.offsets.OTName+p.offsets.OTNameLength], otNameData)
}

// Game-specific behavior delegation
func (p *PokemonData) GetNature() string {
	return p.config.CalculateNature(p.GetPersonality())
}

func (p *PokemonData) IsShiny() bool {
	return p.config.IsShiny(p.GetPersonality(), p.GetOTID())
}

func (p *PokemonData) GetShinyValue() uint32 {
	return p.config.GetShinyValue(p.GetPersonality(), p.GetOTID())
}

// Stats calculation (simplified - would need more complex logic for EVs/IVs)
func (p *PokemonData) GetStats() PokemonStats {
	return PokemonStats{
		HP:        p.GetMaxHP(),
		Attack:    p.GetAttack(),
		Defense:   p.GetDefense(),
		Speed:     p.GetSpeed(),
		SpAttack:  p.GetSpAttack(),
		SpDefense: p.GetSpDefense(),
	}
}

// OTID string representation
func (p *PokemonData) GetOTIDString() string {
	otid := p.GetOTID()
	return fmt.Sprintf("%05d", otid&0xFFFF) // Public ID only
}

// JSON marshaling support
func (p *PokemonData) ToJSON() map[string]interface{} {
	return map[string]interface{}{
		"nickname":     p.GetNickname(),
		"ot_name":      p.GetOTName(),
		"ot_id":        p.GetOTIDString(),
		"level":        p.GetLevel(),
		"personality":  p.GetPersonality(),
		"current_hp":   p.GetCurrentHP(),
		"max_hp":       p.GetMaxHP(),
		"attack":       p.GetAttack(),
		"defense":      p.GetDefense(),
		"speed":        p.GetSpeed(),
		"sp_attack":    p.GetSpAttack(),
		"sp_defense":   p.GetSpDefense(),
		"status":       p.GetStatus(),
		"nature":       p.GetNature(),
		"is_shiny":     p.IsShiny(),
		"shiny_value":  p.GetShinyValue(),
		"stats":        p.GetStats(),
	}
}