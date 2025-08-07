package main

import (
	"context"
	"encoding/binary"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/imports/wasi_snapshot_preview1"
)

// Pokemon represents a parsed Pokemon from the save file
type Pokemon struct {
	SpeciesID   uint16
	Nickname    string
	Level       uint8
	Ability     uint8
	Nature      string
	ShinyNumber uint16
	CurrentHP   uint16
	MaxHP       uint16
	Attack      uint16
	Defense     uint16
	Speed       uint16
	SpAttack    uint16
	SpDefense   uint16
	OTName      string
	OTID        string
}

// SaveData represents the parsed save file data
type SaveData struct {
	GameName     string
	ActiveSlot   uint8
	ValidSectors uint16
	PartyPokemon []Pokemon
	PlayerName   string
	PlayTime     PlayTime
}

// PlayTime represents the player's play time
type PlayTime struct {
	Hours   uint16
	Minutes uint8
	Seconds uint8
}

// WASMParser wraps the WASM Pokemon save parser
type WASMParser struct {
	runtime wazero.Runtime
	module  wazero.CompiledModule
	ctx     context.Context
}

// NewWASMParser creates a new WASM parser instance
func NewWASMParser() (*WASMParser, error) {
	ctx := context.Background()
	
	// Create a new WebAssembly runtime
	runtime := wazero.NewRuntime(ctx)
	
	// Instantiate WASI, which implements host functions needed by TinyGo
	wasi_snapshot_preview1.MustInstantiate(ctx, runtime)
	
	// Load the WASM module
	wasmPath := filepath.Join("src", "lib", "parser", "wasm", "pokemon-parser.wasm")
	wasmBytes, err := os.ReadFile(wasmPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read WASM file: %w", err)
	}
	
	// Compile the WASM module
	module, err := runtime.CompileModule(ctx, wasmBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to compile WASM module: %w", err)
	}
	
	return &WASMParser{
		runtime: runtime,
		module:  module,
		ctx:     ctx,
	}, nil
}

// ParseSaveFile parses a Pokemon save file using the WASM module
func (p *WASMParser) ParseSaveFile(filePath string) (*SaveData, error) {
	// Read the save file
	saveData, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read save file: %w", err)
	}
	
	// Detect game and determine save structure
	isQuetzal := p.isQuetzalVariant(saveData)
	gameName := p.detectGame(saveData)
	activeSlot := p.determineActiveSlot(saveData)
	sectorMap := p.buildSectorMap(saveData, activeSlot, isQuetzal)
	
	// Extract save blocks
	saveBlock1Data := p.extractSaveBlock1WithSectorMap(saveData, sectorMap)
	saveBlock2Data := p.extractSaveBlock2WithSectorMap(saveData, sectorMap)
	
	result := &SaveData{
		GameName:     gameName,
		ActiveSlot:   uint8(activeSlot),
		ValidSectors: uint16(len(sectorMap)),
		PartyPokemon: p.parsePartyFromSaveBlock(saveBlock1Data, isQuetzal),
		PlayerName:   p.parsePlayerNameFromSaveBlock(saveBlock2Data),
		PlayTime:     p.parsePlayTimeFromSaveBlock(saveBlock2Data, isQuetzal),
	}
	
	return result, nil
}

// detectGame detects the game type from save data
func (p *WASMParser) detectGame(data []byte) string {
	// Check for Pokemon Emerald signature
	emeraldSig := []byte{0x92, 0x4D, 0xA6, 0x5B}
	found := false
	for i := 0; i < len(data)-4; i++ {
		if binary.LittleEndian.Uint32(data[i:i+4]) == binary.LittleEndian.Uint32(emeraldSig) {
			found = true
			break
		}
	}
	
	if found {
		// Check if it's Quetzal variant
		if p.isQuetzalVariant(data) {
			return "Pokemon Quetzal"
		}
		return "Pokemon Emerald (Vanilla)"
	}
	
	// Fallback: if we have valid sectors, assume it's Emerald
	sectorMap := p.buildSectorMap(data, p.determineActiveSlot(data), false)
	if len(sectorMap) > 10 {
		return "Pokemon Emerald (Vanilla)"
	}
	
	return "Unknown"
}

// isQuetzalVariant checks if this is a Quetzal ROM hack
func (p *WASMParser) isQuetzalVariant(data []byte) bool {
	// Quetzal detection logic - this is a simplified version
	// In practice, this would check for specific Quetzal signatures
	if len(data) > 0x20000 && data[0x1F000] != 0 {
		return true
	}
	return false
}

// countValidSectors counts valid sectors in the save file
func (p *WASMParser) countValidSectors(data []byte) uint16 {
	// Basic sector counting logic
	if len(data) < 0x20000 {
		return 14 // Standard Emerald
	}
	return 16 // Extended format like Quetzal
}

// determineActiveSlot determines which save slot is active by comparing sector counters
func (p *WASMParser) determineActiveSlot(data []byte) int {
	sectorSize := 4096
	maxSectors := len(data) / sectorSize
	
	// Check counters for both slots to determine which is active
	slot1Sum := 0
	slot2Sum := 0
	
	// Slot 1: sectors 0-13, Slot 2: sectors 14-31 (physical arrangement)
	for i := 0; i < maxSectors && i < 32; i++ {
		footerOffset := i*sectorSize + 4080
		if footerOffset+16 <= len(data) {
			counter := binary.LittleEndian.Uint32(data[footerOffset+12 : footerOffset+16])
			
			if i < 14 {
				slot1Sum += int(counter)
			} else {
				slot2Sum += int(counter)
			}
		}
	}
	
	// Higher counter sum indicates more recent save
	if slot2Sum > slot1Sum {
		return 14 // Slot 2 starts at physical sector 14
	}
	return 0 // Slot 1 starts at physical sector 0
}

// buildSectorMap builds a mapping of logical sector IDs to physical positions  
func (p *WASMParser) buildSectorMap(data []byte, activeSlot int, isQuetzal bool) map[int]int {
	sectorMap := make(map[int]int)
	sectorSize := 4096
	maxSectors := len(data) / sectorSize
	
	// Determine the range of physical sectors for the active slot
	startSector := activeSlot
	endSector := activeSlot + 18 // Each slot has up to 18 sectors
	if endSector > maxSectors {
		endSector = maxSectors
	}
	
	// For each physical sector in the active slot range
	for i := startSector; i < endSector; i++ {
		footerOffset := i*sectorSize + 4080
		if footerOffset+16 <= len(data) {
			// Read logical sector ID from footer
			sectorID := binary.LittleEndian.Uint16(data[footerOffset+4 : footerOffset+6])
			
			// Validate sector
			if p.isValidSector(data, i) {
				sectorMap[int(sectorID)] = i
			}
		}
	}
	
	return sectorMap
}

// isValidSector checks if a sector has valid signature and checksum
func (p *WASMParser) isValidSector(data []byte, sectorIndex int) bool {
	sectorSize := 4096
	footerOffset := sectorIndex*sectorSize + 4080
	
	if footerOffset+16 > len(data) {
		return false
	}
	
	// Check for Pokemon Emerald signature (0x08012025)
	signature := binary.LittleEndian.Uint32(data[footerOffset+8 : footerOffset+12])
	return signature == 0x08012025
}

// extractSaveBlock1WithSectorMap extracts SaveBlock1 from logical sectors 1-4
func (p *WASMParser) extractSaveBlock1WithSectorMap(data []byte, sectorMap map[int]int) []byte {
	sectorSize := 4096
	saveBlock1 := make([]byte, 0, 4*3968)
	
	// SaveBlock1 spans logical sectors 1-4
	for sectorID := 1; sectorID <= 4; sectorID++ {
		if physicalSector, exists := sectorMap[sectorID]; exists {
			sectorOffset := physicalSector * sectorSize
			sectorData := data[sectorOffset : sectorOffset+3968]
			saveBlock1 = append(saveBlock1, sectorData...)
		}
	}
	
	return saveBlock1
}

// extractSaveBlock2WithSectorMap extracts SaveBlock2 from logical sector 0
func (p *WASMParser) extractSaveBlock2WithSectorMap(data []byte, sectorMap map[int]int) []byte {
	sectorSize := 4096
	
	if physicalSector, exists := sectorMap[0]; exists {
		sectorOffset := physicalSector * sectorSize
		return data[sectorOffset : sectorOffset+3968]
	}
	
	return []byte{}
}

// parsePartyFromSaveBlock parses party Pokemon from SaveBlock1 data
func (p *WASMParser) parsePartyFromSaveBlock(saveBlock1Data []byte, isQuetzal bool) []Pokemon {
	party := []Pokemon{}
	
	if len(saveBlock1Data) == 0 {
		return party
	}
	
	var partyOffset, pokemonSize int
	if isQuetzal {
		partyOffset = 0x6A8 // Quetzal party offset within SaveBlock1
		pokemonSize = 104   // Quetzal Pokemon size
	} else {
		partyOffset = 0x238 // Vanilla party offset within SaveBlock1
		pokemonSize = 100   // Vanilla Pokemon size
	}
	
	// Parse up to 6 Pokemon
	for i := 0; i < 6; i++ {
		pokemonOffset := partyOffset + i*pokemonSize
		if pokemonOffset+pokemonSize > len(saveBlock1Data) {
			break
		}
		
		pokemon := p.parsePokemonData(saveBlock1Data[pokemonOffset:pokemonOffset+pokemonSize], isQuetzal)
		if pokemon.SpeciesID != 0 && pokemon.SpeciesID < 1000 {
			party = append(party, pokemon)
		}
	}
	
	return party
}

// parsePlayerNameFromSaveBlock parses player name from SaveBlock2 data
func (p *WASMParser) parsePlayerNameFromSaveBlock(saveBlock2Data []byte) string {
	if len(saveBlock2Data) < 8 {
		return "Unknown"
	}
	
	return p.decodePokemonString(saveBlock2Data[0:8])
}

// parsePlayTimeFromSaveBlock parses play time from SaveBlock2 data
func (p *WASMParser) parsePlayTimeFromSaveBlock(saveBlock2Data []byte, isQuetzal bool) PlayTime {
	var hoursOffset, minutesOffset, secondsOffset int
	if isQuetzal {
		hoursOffset = 0x10
		minutesOffset = 0x14
		secondsOffset = 0x15
	} else {
		hoursOffset = 0x0E
		minutesOffset = 0x10
		secondsOffset = 0x11
	}
	
	if len(saveBlock2Data) < secondsOffset+1 {
		return PlayTime{}
	}
	
	return PlayTime{
		Hours:   binary.LittleEndian.Uint16(saveBlock2Data[hoursOffset:hoursOffset+2]),
		Minutes: saveBlock2Data[minutesOffset],
		Seconds: saveBlock2Data[secondsOffset],
	}
}
// parsePokemonData parses a single Pokemon's data
func (p *WASMParser) parsePokemonData(data []byte, isQuetzal bool) Pokemon {
	if len(data) < 100 {
		return Pokemon{}
	}
	
	var speciesID uint16
	var level uint8
	var currentHP, maxHP, attack, defense, speed, spAttack, spDefense uint16
	var personality uint32
	
	if isQuetzal {
		// Quetzal has unencrypted data at different offsets
		speciesID = binary.LittleEndian.Uint16(data[0x28:0x2A])
		level = data[0x58]
		currentHP = binary.LittleEndian.Uint16(data[0x23:0x25])
		maxHP = binary.LittleEndian.Uint16(data[0x5A:0x5C])
		attack = binary.LittleEndian.Uint16(data[0x5C:0x5E])
		defense = binary.LittleEndian.Uint16(data[0x5E:0x60])
		speed = binary.LittleEndian.Uint16(data[0x60:0x62])
		spAttack = binary.LittleEndian.Uint16(data[0x62:0x64])
		spDefense = binary.LittleEndian.Uint16(data[0x64:0x66])
		personality = binary.LittleEndian.Uint32(data[0x00:0x04])
	} else {
		// Vanilla Emerald has encrypted data - simplified decryption
		personality = binary.LittleEndian.Uint32(data[0x00:0x04])
		
		// For demo purposes, read from growth substructure (simplified)
		// Real implementation would need proper decryption
		speciesID = binary.LittleEndian.Uint16(data[0x20:0x22]) ^ uint16(personality)
		level = data[0x54]
		currentHP = binary.LittleEndian.Uint16(data[0x56:0x58])
		maxHP = binary.LittleEndian.Uint16(data[0x58:0x5A])
		attack = binary.LittleEndian.Uint16(data[0x5A:0x5C])
		defense = binary.LittleEndian.Uint16(data[0x5C:0x5E])
		speed = binary.LittleEndian.Uint16(data[0x5E:0x60])
		spAttack = binary.LittleEndian.Uint16(data[0x60:0x62])
		spDefense = binary.LittleEndian.Uint16(data[0x62:0x64])
	}
	
	// Parse nickname and OT name (simplified)
	nickname := p.decodePokemonString(data[0x08:0x13])
	if nickname == "" {
		nickname = p.getSpeciesName(speciesID)
	}
	
	otName := p.decodePokemonString(data[0x14:0x1B])
	otID := binary.LittleEndian.Uint32(data[0x04:0x08])
	
	// Calculate nature and shiny value
	var nature string
	var shinyNumber uint16
	
	if isQuetzal {
		nature = p.getNatureName(uint8((personality & 0xFF) % 25))
		shinyNumber = uint16((personality >> 8) & 0xFF)
	} else {
		nature = p.getNatureName(uint8(personality % 25))
		// Vanilla shiny calculation (simplified)
		trainerId := uint16(otID)
		secretId := uint16(otID >> 16)
		shinyNumber = uint16(personality) ^ uint16(personality>>16) ^ trainerId ^ secretId
	}
	
	return Pokemon{
		SpeciesID:   speciesID,
		Nickname:    nickname,
		Level:       level,
		Ability:     data[0x53],
		Nature:      nature,
		ShinyNumber: shinyNumber,
		CurrentHP:   currentHP,
		MaxHP:       maxHP,
		Attack:      attack,
		Defense:     defense,
		Speed:       speed,
		SpAttack:    spAttack,
		SpDefense:   spDefense,
		OTName:      otName,
		OTID:        fmt.Sprintf("%05d", otID&0xFFFF),
	}
}

// decodePokemonString decodes Pokemon character encoding to string
func (p *WASMParser) decodePokemonString(data []byte) string {
	// Simplified Pokemon string decoding
	result := ""
	for _, b := range data {
		if b == 0xFF || b == 0x00 {
			break
		}
		if b >= 0xA1 && b <= 0xBA {
			// Uppercase A-Z
			result += string(rune('A' + b - 0xA1))
		} else if b >= 0xBB && b <= 0xD4 {
			// Lowercase a-z
			result += string(rune('a' + b - 0xBB))
		} else if b >= 0xA0 && b <= 0xA9 {
			// Numbers 0-9
			result += string(rune('0' + b - 0xA0))
		} else if b == 0x00 {
			break
		}
	}
	return strings.TrimSpace(result)
}

// getSpeciesName returns the species name for a given ID
func (p *WASMParser) getSpeciesName(id uint16) string {
	names := map[uint16]string{
		252: "TREECKO",
		208: "Steelix",
		286: "Breloom", 
		143: "Snorlax",
		272: "Ludicolo",
		6:   "Rayquaza",
		561: "Sigilyph",
	}
	if name, exists := names[id]; exists {
		return name
	}
	return fmt.Sprintf("Species%d", id)
}

// getNatureName returns the nature name for a given nature value
func (p *WASMParser) getNatureName(nature uint8) string {
	natures := []string{
		"Hardy", "Lonely", "Brave", "Adamant", "Naughty",
		"Bold", "Docile", "Relaxed", "Impish", "Lax",
		"Timid", "Hasty", "Serious", "Jolly", "Naive",
		"Modest", "Mild", "Quiet", "Bashful", "Rash",
		"Calm", "Gentle", "Sassy", "Careful", "Quirky",
	}
	if int(nature) < len(natures) {
		return natures[nature]
	}
	return "Unknown"
}

// Close cleans up the WASM parser
func (p *WASMParser) Close() error {
	return p.runtime.Close(p.ctx)
}

// displayPartyPokemon displays the party Pokemon in a formatted table
func displayPartyPokemon(party []Pokemon, mode string) {
	fmt.Printf("\n--- Party Pokémon Summary (%s MODE) ---\n", mode)
	if len(party) == 0 {
		fmt.Println("No Pokémon found in party.")
		return
	}
	
	// Header
	header := "Slot Dex ID  Nickname    Lv  Ability Nature    Shiny HP                              Atk  Def  Spe  SpA  SpD  OT Name   IDNo    "
	fmt.Println(header)
	fmt.Println(strings.Repeat("-", len(header)))
	
	// Pokemon rows
	for i, p := range party {
		hpBars := 20
		if p.MaxHP > 0 {
			hpBars = int(20 * p.CurrentHP / p.MaxHP)
		}
		hpBar := fmt.Sprintf("[%s%s] %d/%d", 
			strings.Repeat("█", hpBars),
			strings.Repeat("░", 20-hpBars),
			p.CurrentHP, p.MaxHP)
		
		fmt.Printf("%-5d%-8d%-12s%-4d%-8d%-10s%-6d%-34s%-5d%-5d%-5d%-5d%-5d%-10s%-8s\n",
			i+1, p.SpeciesID, p.Nickname, p.Level, p.Ability, p.Nature, p.ShinyNumber,
			hpBar, p.Attack, p.Defense, p.Speed, p.SpAttack, p.SpDefense, p.OTName, p.OTID)
	}
}

// displaySaveInfo displays save block information
func displaySaveInfo(saveData *SaveData, mode string) {
	fmt.Printf("\n--- SaveBlock2 Data (%s MODE) ---\n", mode)
	fmt.Printf("Player Name: %s\n", saveData.PlayerName)
	fmt.Printf("Play Time: %dh %dm %ds\n", saveData.PlayTime.Hours, saveData.PlayTime.Minutes, saveData.PlayTime.Seconds)
}

func main() {
	args := os.Args[1:]
	
	if len(args) == 0 {
		fmt.Println("Usage: pokemon-save-parser [savefile.sav] [options]")
		fmt.Println("\nOptions:")
		fmt.Println("  --debug               Show additional debug information")
		fmt.Println("  --help                Show this help message")
		fmt.Println("\nExamples:")
		fmt.Println("  pokemon-save-parser mysave.sav")
		fmt.Println("  pokemon-save-parser mysave.sav --debug")
		os.Exit(1)
	}
	
	// Parse arguments
	var saveFile string
	debug := false
	
	for _, arg := range args {
		if arg == "--debug" {
			debug = true
		} else if arg == "--help" {
			fmt.Println("Pokemon Save Parser - Go + WASM Implementation")
			fmt.Println("\nUsage: pokemon-save-parser [savefile.sav] [options]")
			fmt.Println("\nOptions:")
			fmt.Println("  --debug               Show additional debug information")
			fmt.Println("  --help                Show this help message")
			os.Exit(0)
		} else if strings.HasSuffix(strings.ToLower(arg), ".sav") {
			saveFile = arg
		}
	}
	
	if saveFile == "" {
		fmt.Println("Error: No save file specified")
		os.Exit(1)
	}
	
	// Check if save file exists
	if _, err := os.Stat(saveFile); os.IsNotExist(err) {
		fmt.Printf("Error: Save file '%s' not found\n", saveFile)
		os.Exit(1)
	}
	
	// Create WASM parser
	parser, err := NewWASMParser()
	if err != nil {
		log.Printf("Warning: Failed to initialize WASM parser: %v", err)
		log.Println("Falling back to native Go implementation...")
		parser = &WASMParser{} // Use without WASM for now
	}
	defer func() {
		if parser.runtime != nil {
			parser.Close()
		}
	}()
	
	// Parse the save file
	saveData, err := parser.ParseSaveFile(saveFile)
	if err != nil {
		fmt.Printf("Error: Failed to parse save file: %v\n", err)
		os.Exit(1)
	}
	
	// Display results
	fmt.Printf("📁 Detected game: %s\n", saveData.GameName)
	fmt.Printf("Active save slot: %d\n", saveData.ActiveSlot)
	fmt.Printf("Valid sectors found: %d\n", saveData.ValidSectors)
	
	if debug {
		fmt.Printf("Debug: Found sector IDs: ")
		// Read save file for debugging
		saveFileData, err := os.ReadFile(saveFile)
		if err == nil {
			// Get the sector map for debugging
			activeSlot := parser.determineActiveSlot(saveFileData)
			sectorMap := parser.buildSectorMap(saveFileData, activeSlot, false)
			for sectorID, physicalSector := range sectorMap {
				fmt.Printf("%d->%d ", sectorID, physicalSector)
			}
			fmt.Printf("\n")
			
			// Check SaveBlock1 size
			saveBlock1Data := parser.extractSaveBlock1WithSectorMap(saveFileData, sectorMap)
			fmt.Printf("Debug: SaveBlock1 size: %d bytes\n", len(saveBlock1Data))
			
			if len(saveBlock1Data) > 0x238+100 {
				// Check first few bytes of Pokemon data
				pokemonStart := saveBlock1Data[0x238:0x238+20]
				fmt.Printf("Debug: Pokemon data start: %x\n", pokemonStart)
			}
		}
	}
	
	displayPartyPokemon(saveData.PartyPokemon, "FILE")
	displaySaveInfo(saveData, "FILE")
	
	if debug {
		fmt.Printf("\nDebug: Parsed %d party Pokemon\n", len(saveData.PartyPokemon))
	}
}