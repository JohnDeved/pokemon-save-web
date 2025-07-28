#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>

#define POKEMON_SIZE 104
#define PARTY_SIZE 6
#define MAX_POKEMON_ID 1010
#define MIN_POKEMON_LEVEL 1
#define MAX_POKEMON_LEVEL 100

// Known Pokemon species IDs from Quetzal (sample from ground truth)
const uint16_t KNOWN_QUETZAL_SPECIES[] = {
    252, 259, 254, 255, 144, 145, 146, 150, 151, // From ground truth
    1, 4, 7, 25, 39, 104, 113, 129, 130, 131, 132, 143, 149, // Common Pokemon
    0 // Sentinel
};

typedef struct {
    uint32_t address;
    uint8_t confidence;
    uint16_t species_id;
    uint8_t level;
    char nickname[11];
} PokemonCandidate;

typedef struct {
    uint32_t address;
    uint8_t count;
    PokemonCandidate pokemon[PARTY_SIZE];
    uint8_t total_confidence;
} PartyCandidate;

// Function to check if a species ID is known/valid for Quetzal
bool is_valid_species(uint16_t species_id) {
    if (species_id == 0 || species_id > MAX_POKEMON_ID) return false;
    
    // Check against known Quetzal species
    for (int i = 0; KNOWN_QUETZAL_SPECIES[i] != 0; i++) {
        if (KNOWN_QUETZAL_SPECIES[i] == species_id) return true;
    }
    
    // Also accept common Pokemon IDs (1-151, 252-386 for Gen 3 ranges)
    return (species_id >= 1 && species_id <= 151) || 
           (species_id >= 252 && species_id <= 386) ||
           (species_id >= 387 && species_id <= 493); // Some Gen 4
}

// Function to check if a level is valid
bool is_valid_level(uint8_t level) {
    return level >= MIN_POKEMON_LEVEL && level <= MAX_POKEMON_LEVEL;
}

// Function to extract nickname from Pokemon data (assuming null-terminated)
void extract_nickname(const uint8_t* data, char* nickname) {
    // Nickname is typically at offset 0x08-0x11 in most Pokemon structures
    // For Quetzal, we'll check multiple common offsets
    const int NICKNAME_OFFSETS[] = {0x08, 0x10, 0x18, 0x20, -1};
    
    for (int i = 0; NICKNAME_OFFSETS[i] != -1; i++) {
        int offset = NICKNAME_OFFSETS[i];
        if (offset + 10 >= POKEMON_SIZE) continue;
        
        // Check if this looks like a valid nickname (printable chars)
        bool valid = true;
        for (int j = 0; j < 10; j++) {
            uint8_t c = data[offset + j];
            if (c == 0) break; // Null terminator
            if (c < 32 || c > 126) { // Not printable ASCII
                valid = false;
                break;
            }
        }
        
        if (valid) {
            strncpy(nickname, (char*)(data + offset), 10);
            nickname[10] = '\0';
            return;
        }
    }
    
    strcpy(nickname, "Unknown");
}

// Function to analyze a potential Pokemon structure
uint8_t analyze_pokemon_structure(const uint8_t* data, PokemonCandidate* candidate, uint32_t address) {
    candidate->address = address;
    candidate->confidence = 0;
    
    // Check species ID at offset 0x28 (Quetzal offset)
    uint16_t species = *(uint16_t*)(data + 0x28);
    candidate->species_id = species;
    
    if (!is_valid_species(species)) {
        return 0; // Invalid species, confidence 0
    }
    candidate->confidence += 40; // +40 for valid species
    
    // Check level at offset 0x58 (Quetzal offset)  
    uint8_t level = data[0x58];
    candidate->level = level;
    
    if (!is_valid_level(level)) {
        return candidate->confidence / 2; // Reduce confidence if invalid level
    }
    candidate->confidence += 30; // +30 for valid level
    
    // Check HP values (current HP should be <= max HP)
    uint16_t current_hp = *(uint16_t*)(data + 0x23); // Current HP offset
    uint16_t max_hp = *(uint16_t*)(data + 0x5A);     // Max HP offset
    
    if (current_hp > 0 && current_hp <= max_hp && max_hp < 1000) {
        candidate->confidence += 20; // +20 for reasonable HP values
    }
    
    // Check stats are reasonable (not 0, not too high)
    uint16_t attack = *(uint16_t*)(data + 0x5C);
    uint16_t defense = *(uint16_t*)(data + 0x5E);
    
    if (attack > 0 && attack < 1000 && defense > 0 && defense < 1000) {
        candidate->confidence += 10; // +10 for reasonable stats
    }
    
    // Extract nickname
    extract_nickname(data, candidate->nickname);
    
    return candidate->confidence;
}

// Function to find potential party data in memory
void find_party_candidates(const uint8_t* memory, size_t memory_size, uint32_t base_address, 
                          PartyCandidate* candidates, int* num_candidates, int max_candidates) {
    *num_candidates = 0;
    
    // Scan memory for potential party starts
    for (size_t offset = 0; offset + (PARTY_SIZE * POKEMON_SIZE) < memory_size; offset += 4) {
        PartyCandidate party;
        party.address = base_address + offset;
        party.count = 0;
        party.total_confidence = 0;
        
        // Try to parse 6 Pokemon starting at this offset
        bool valid_party = true;
        for (int i = 0; i < PARTY_SIZE; i++) {
            const uint8_t* pokemon_data = memory + offset + (i * POKEMON_SIZE);
            uint8_t confidence = analyze_pokemon_structure(pokemon_data, &party.pokemon[i], 
                                                         party.address + (i * POKEMON_SIZE));
            
            if (confidence >= 40) { // Minimum confidence for a valid Pokemon
                party.count++;
                party.total_confidence += confidence;
            } else if (i == 0) {
                // If first Pokemon is invalid, this isn't a party
                valid_party = false;
                break;
            }
        }
        
        // Accept parties with at least 3 valid Pokemon and good total confidence
        if (valid_party && party.count >= 3 && party.total_confidence >= 200) {
            if (*num_candidates < max_candidates) {
                candidates[*num_candidates] = party;
                (*num_candidates)++;
            }
        }
    }
}

int main(int argc, char* argv[]) {
    if (argc != 4) {
        printf("Usage: %s <memory_dump1.bin> <memory_dump2.bin> <base_address_hex>\n", argv[0]);
        printf("Example: %s quetzal1_ewram.bin quetzal2_ewram.bin 0x02000000\n", argv[0]);
        return 1;
    }
    
    const char* file1 = argv[1];
    const char* file2 = argv[2];
    uint32_t base_address = (uint32_t)strtol(argv[3], NULL, 16);
    
    printf("🔍 Analyzing memory dumps for Pokemon party data\n");
    printf("📄 File 1: %s\n", file1);
    printf("📄 File 2: %s\n", file2);
    printf("🎯 Base address: 0x%08X\n", base_address);
    
    // Load first memory dump
    FILE* f1 = fopen(file1, "rb");
    if (!f1) {
        printf("❌ Cannot open %s\n", file1);
        return 1;
    }
    
    fseek(f1, 0, SEEK_END);
    size_t size1 = ftell(f1);
    fseek(f1, 0, SEEK_SET);
    
    uint8_t* memory1 = malloc(size1);
    fread(memory1, 1, size1, f1);
    fclose(f1);
    
    // Load second memory dump
    FILE* f2 = fopen(file2, "rb");
    if (!f2) {
        printf("❌ Cannot open %s\n", file2);
        free(memory1);
        return 1;
    }
    
    fseek(f2, 0, SEEK_END);
    size_t size2 = ftell(f2);
    fseek(f2, 0, SEEK_SET);
    
    uint8_t* memory2 = malloc(size2);
    fread(memory2, 1, size2, f2);
    fclose(f2);
    
    if (size1 != size2) {
        printf("❌ Memory dump sizes don't match: %zu vs %zu\n", size1, size2);
        free(memory1);
        free(memory2);
        return 1;
    }
    
    printf("✅ Loaded memory dumps (%zu bytes each)\n", size1);
    
    // Find party candidates in both memory dumps
    const int MAX_CANDIDATES = 1000;
    PartyCandidate* candidates1 = malloc(MAX_CANDIDATES * sizeof(PartyCandidate));
    PartyCandidate* candidates2 = malloc(MAX_CANDIDATES * sizeof(PartyCandidate));
    int num1, num2;
    
    printf("🔍 Scanning first memory dump...\n");
    find_party_candidates(memory1, size1, base_address, candidates1, &num1, MAX_CANDIDATES);
    printf("Found %d potential party locations in first dump\n", num1);
    
    printf("🔍 Scanning second memory dump...\n");
    find_party_candidates(memory2, size2, base_address, candidates2, &num2, MAX_CANDIDATES);
    printf("Found %d potential party locations in second dump\n", num2);
    
    // List ALL candidates from dump 1
    printf("\n📋 ALL potential party locations in DUMP 1 (%s):\n", file1);
    printf("Address    | Confidence | Count | Pokemon Details\n");
    printf("-----------|------------|-------|----------------\n");
    
    for (int i = 0; i < num1; i++) {
        printf("0x%08X | %10d | %5d | ", 
               candidates1[i].address, 
               candidates1[i].total_confidence,
               candidates1[i].count);
               
        for (int k = 0; k < candidates1[i].count && k < 6; k++) {
            printf("ID%d(Lv%d) ", candidates1[i].pokemon[k].species_id, 
                   candidates1[i].pokemon[k].level);
        }
        printf("\n");
    }
    
    // List ALL candidates from dump 2
    printf("\n📋 ALL potential party locations in DUMP 2 (%s):\n", file2);
    printf("Address    | Confidence | Count | Pokemon Details\n");
    printf("-----------|------------|-------|----------------\n");
    
    for (int i = 0; i < num2; i++) {
        printf("0x%08X | %10d | %5d | ", 
               candidates2[i].address, 
               candidates2[i].total_confidence,
               candidates2[i].count);
               
        for (int k = 0; k < candidates2[i].count && k < 6; k++) {
            printf("ID%d(Lv%d) ", candidates2[i].pokemon[k].species_id, 
                   candidates2[i].pokemon[k].level);
        }
        printf("\n");
    }
    
    // Find EXACT address matches (not fuzzy matching)
    printf("\n🎯 Addresses with valid Pokemon data in BOTH dumps:\n");
    printf("Address    | Dump1 Confidence | Dump2 Confidence | Dump1 Pokemon | Dump2 Pokemon\n");
    printf("-----------|------------------|------------------|---------------|---------------\n");
    
    int exact_matches = 0;
    for (int i = 0; i < num1; i++) {
        for (int j = 0; j < num2; j++) {
            // Check for EXACT address match
            if (candidates1[i].address == candidates2[j].address) {
                printf("0x%08X | %16d | %16d | ",
                       candidates1[i].address, 
                       candidates1[i].total_confidence,
                       candidates2[j].total_confidence);
                       
                // Print first 3 Pokemon from dump 1
                for (int k = 0; k < candidates1[i].count && k < 3; k++) {
                    printf("ID%d(Lv%d) ", candidates1[i].pokemon[k].species_id, 
                           candidates1[i].pokemon[k].level);
                }
                printf("| ");
                
                // Print first 3 Pokemon from dump 2
                for (int k = 0; k < candidates2[j].count && k < 3; k++) {
                    printf("ID%d(Lv%d) ", candidates2[j].pokemon[k].species_id, 
                           candidates2[j].pokemon[k].level);
                }
                printf("\n");
                
                exact_matches++;
            }
        }
    }
    
    if (exact_matches == 0) {
        printf("❌ No exact address matches found between dumps\n");
        printf("💡 This means Pokemon party data is at different addresses in each savestate\n");
        printf("🔍 Check the individual dump listings above to see all potential party locations\n");
    } else {
        printf("✅ Found %d exact address matches with valid Pokemon data in both dumps\n", exact_matches);
        printf("🎯 These addresses are stable and can be used for memory reading!\n");
    }
    
    // Cleanup
    free(memory1);
    free(memory2);
    free(candidates1);
    free(candidates2);
    
    return 0;
}