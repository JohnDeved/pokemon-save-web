// +build !js,!wasm

package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"strings"
	"github.com/JohnDeved/pokemon-save-web/parser/core"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run parser/main.go <save_file.sav> [--debug] [--toBytes=text] [--toString=hex]")
		fmt.Println("  --debug      Show detailed debug information")
		fmt.Println("  --toBytes    Convert text to GBA bytes")
		fmt.Println("  --toString   Convert hex bytes to GBA string")
		os.Exit(1)
	}

	// Parse command line arguments
	debug := false
	var toBytes, toString string
	
	for _, arg := range os.Args[1:] {
		if arg == "--debug" {
			debug = true
		} else if strings.HasPrefix(arg, "--toBytes=") {
			toBytes = strings.TrimPrefix(arg, "--toBytes=")
		} else if strings.HasPrefix(arg, "--toString=") {
			toString = strings.TrimPrefix(arg, "--toString=")
		}
	}

	// Handle string conversion utilities
	if toBytes != "" {
		encoded := core.EncodePokemonText(toBytes, len(toBytes)+5)
		fmt.Printf("Text '%s' encoded to bytes: ", toBytes)
		for i, b := range encoded {
			if i > 0 {
				fmt.Print(" ")
			}
			fmt.Printf("%02X", b)
		}
		fmt.Println()
		return
	}

	if toString != "" {
		// Parse hex string to bytes
		hexStr := strings.ReplaceAll(toString, " ", "")
		hexStr = strings.ReplaceAll(hexStr, ",", "")
		
		var data []byte
		for i := 0; i < len(hexStr); i += 2 {
			if i+1 >= len(hexStr) {
				break
			}
			var b byte
			if _, err := fmt.Sscanf(hexStr[i:i+2], "%02X", &b); err != nil {
				fmt.Printf("Error parsing hex: %v\n", err)
				return
			}
			data = append(data, b)
		}
		
		decoded := core.DecodePokemonText(data)
		fmt.Printf("Hex '%s' decoded to text: '%s'\n", toString, decoded)
		return
	}

	// Parse save file
	filename := os.Args[1]
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		fmt.Printf("Error reading file: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Loaded save file: %s (%d bytes)\n", filename, len(data))

	// Create parser and load data
	parser := core.NewPokemonSaveParser(nil, nil)
	if err := parser.LoadSaveData(data); err != nil {
		fmt.Printf("Error loading save data: %v\n", err)
		os.Exit(1)
	}

	// Parse save file
	saveData, err := parser.ParseSaveFile()
	if err != nil {
		fmt.Printf("Error parsing save file: %v\n", err)
		os.Exit(1)
	}

	// Display results
	config := parser.GetGameConfig()
	fmt.Printf("Game: %s\n", config.GetName())
	fmt.Printf("Player: %s\n", saveData.PlayerName)
	fmt.Printf("Play Time: %02d:%02d:%02d\n", 
		saveData.PlayTime.Hours, 
		saveData.PlayTime.Minutes, 
		saveData.PlayTime.Seconds)
	fmt.Printf("Active Slot: %d\n", saveData.ActiveSlot)
	fmt.Printf("Party Pokemon: %d\n", len(saveData.PartyPokemon))

	if len(saveData.PartyPokemon) > 0 {
		fmt.Println("\nParty Summary:")
		fmt.Println("Slot  Nickname     Level  Nature     HP             Attack  Defense  Speed   SpA     SpD")
		fmt.Println("----  ------------ -----  --------   -------------- ------- -------- ------- ------- -------")
		
		for i, pokemon := range saveData.PartyPokemon {
			hpBars := 20
			if pokemon.GetMaxHP() > 0 {
				hpBars = int(20 * pokemon.GetCurrentHP() / pokemon.GetMaxHP())
			}
			hpBar := strings.Repeat("█", hpBars) + strings.Repeat("░", 20-hpBars)
			
			fmt.Printf("%-4d  %-12s %-5d  %-8s   [%s] %-7d %-8d %-7d %-7d %-7d\n",
				i+1,
				pokemon.GetNickname(),
				pokemon.GetLevel(),
				pokemon.GetNature(),
				hpBar,
				pokemon.GetAttack(),
				pokemon.GetDefense(),
				pokemon.GetSpeed(),
				pokemon.GetSpAttack(),
				pokemon.GetSpDefense(),
			)
		}
	}

	if debug {
		fmt.Println("\nDebug Information:")
		if len(saveData.PartyPokemon) > 0 {
			for i, pokemon := range saveData.PartyPokemon {
				fmt.Printf("\nPokemon %d JSON:\n", i+1)
				jsonData, _ := json.MarshalIndent(pokemon.ToJSON(), "", "  ")
				fmt.Println(string(jsonData))
			}
		}
	}
}