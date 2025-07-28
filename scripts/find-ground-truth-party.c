#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>

#define POKEMON_SIZE 104
#define PARTY_SIZE 6

// Ground truth party data from quetzal_ground_truth.json
typedef struct {
    uint16_t species_id;
    uint8_t level;
    char nickname[11];
} GroundTruthPokemon;

GroundTruthPokemon GROUND_TRUTH_PARTY[PARTY_SIZE] = {
    {208, 44, "Steelix"},   // speciesId: 208, level: 44
    {286, 45, "Breloom"},   // speciesId: 286, level: 45  
    {143, 47, "Snorlax"},   // speciesId: 143, level: 47
    {272, 45, "Ludicolo"},  // speciesId: 272, level: 45
    {6, 41, "Rayquaza"},    // speciesId: 6, level: 41
    {561, 37, "Sigilyph"}   // speciesId: 561, level: 37
};

// Function to search for a nickname in memory
bool find_nickname_in_memory(const uint8_t* memory, size_t memory_size, const char* nickname, 
                             uint32_t* found_addresses, int* num_found, int max_found) {
    *num_found = 0;
    size_t nickname_len = strlen(nickname);
    
    for (size_t i = 0; i <= memory_size - nickname_len; i++) {
        if (memcmp(memory + i, nickname, nickname_len) == 0) {
            if (*num_found < max_found) {
                found_addresses[*num_found] = i;
                (*num_found)++;
            }
        }
    }
    
    return *num_found > 0;
}

// Function to validate Pokemon data at a given address
bool validate_pokemon_data(const uint8_t* memory, size_t memory_size, uint32_t pokemon_address, 
                          const GroundTruthPokemon* expected) {
    if (pokemon_address + POKEMON_SIZE > memory_size) {
        return false;
    }
    
    const uint8_t* pokemon_data = memory + pokemon_address;
    
    // Check species ID at various possible offsets
    const int SPECIES_OFFSETS[] = {0x20, 0x28, 0x2C, 0x30, -1};
    bool species_match = false;
    
    for (int i = 0; SPECIES_OFFSETS[i] != -1; i++) {
        int offset = SPECIES_OFFSETS[i];
        if (offset + 2 <= POKEMON_SIZE) {
            uint16_t species = *(uint16_t*)(pokemon_data + offset);
            if (species == expected->species_id) {
                species_match = true;
                printf("      ✅ Species ID %d matches at offset 0x%02X\n", species, offset);
                break;
            }
        }
    }
    
    // Check level at various possible offsets
    const int LEVEL_OFFSETS[] = {0x54, 0x58, 0x5C, 0x60, -1};
    bool level_match = false;
    
    for (int i = 0; LEVEL_OFFSETS[i] != -1; i++) {
        int offset = LEVEL_OFFSETS[i];
        if (offset < POKEMON_SIZE) {
            uint8_t level = pokemon_data[offset];
            if (level == expected->level) {
                level_match = true;
                printf("      ✅ Level %d matches at offset 0x%02X\n", level, offset);
                break;
            }
        }
    }
    
    return species_match && level_match;
}

// Function to find the party starting from a nickname location
uint32_t find_party_start_from_nickname(const uint8_t* memory, size_t memory_size, 
                                       uint32_t nickname_address, uint32_t base_address) {
    // Search backwards and forwards from nickname to find the start of Pokemon data
    // Nickname could be at various offsets within the Pokemon structure
    const int SEARCH_RANGE = 128; // Search 128 bytes before and after nickname
    
    uint32_t start_search = (nickname_address > SEARCH_RANGE) ? nickname_address - SEARCH_RANGE : 0;
    uint32_t end_search = (nickname_address + SEARCH_RANGE < memory_size) ? 
                         nickname_address + SEARCH_RANGE : memory_size;
    
    // Try every 4-byte aligned address in the search range
    for (uint32_t test_addr = start_search; test_addr <= end_search; test_addr += 4) {
        if (test_addr + POKEMON_SIZE > memory_size) continue;
        
        // Check if this could be the start of the first Pokemon
        if (validate_pokemon_data(memory, memory_size, test_addr, &GROUND_TRUTH_PARTY[0])) {
            printf("    🎯 Found potential party start at memory offset 0x%08X (address 0x%08X)\n", 
                   test_addr, base_address + test_addr);
            
            // Validate the entire party
            bool full_party_valid = true;
            for (int i = 0; i < PARTY_SIZE; i++) {
                uint32_t pokemon_addr = test_addr + (i * POKEMON_SIZE);
                printf("    🔍 Checking Pokemon %d (%s) at offset 0x%08X\n", 
                       i + 1, GROUND_TRUTH_PARTY[i].nickname, pokemon_addr);
                
                if (!validate_pokemon_data(memory, memory_size, pokemon_addr, &GROUND_TRUTH_PARTY[i])) {
                    printf("      ❌ Pokemon %d validation failed\n", i + 1);
                    full_party_valid = false;
                    break;
                } else {
                    printf("      ✅ Pokemon %d validated successfully\n", i + 1);
                }
            }
            
            if (full_party_valid) {
                return base_address + test_addr;
            }
        }
    }
    
    return 0; // Not found
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
    
    printf("🔍 Searching for ground truth party in memory dumps\n");
    printf("📄 File 1: %s\n", file1);
    printf("📄 File 2: %s\n", file2);
    printf("🎯 Base address: 0x%08X\n", base_address);
    printf("\n📋 Looking for party: Steelix(208/44), Breloom(286/45), Snorlax(143/47), Ludicolo(272/45), Rayquaza(6/41), Sigilyph(561/37)\n\n");
    
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
    
    printf("✅ Loaded memory dumps (%zu and %zu bytes)\n\n", size1, size2);
    
    // Search for each Pokemon nickname in dump 1
    printf("🔍 DUMP 1 Analysis:\n");
    uint32_t party_address_dump1 = 0;
    
    for (int i = 0; i < PARTY_SIZE; i++) {
        printf("📝 Searching for '%s' in dump 1...\n", GROUND_TRUTH_PARTY[i].nickname);
        
        uint32_t found_addresses[100];
        int num_found;
        
        if (find_nickname_in_memory(memory1, size1, GROUND_TRUTH_PARTY[i].nickname, 
                                  found_addresses, &num_found, 100)) {
            printf("  ✅ Found '%s' at %d location(s):\n", GROUND_TRUTH_PARTY[i].nickname, num_found);
            
            for (int j = 0; j < num_found; j++) {
                printf("    📍 Memory offset 0x%08X (address 0x%08X)\n", 
                       found_addresses[j], base_address + found_addresses[j]);
                
                // Try to find party start from this nickname
                uint32_t potential_party = find_party_start_from_nickname(memory1, size1, 
                                                                        found_addresses[j], base_address);
                if (potential_party > 0 && party_address_dump1 == 0) {
                    party_address_dump1 = potential_party;
                    printf("    🎉 FOUND COMPLETE PARTY starting at address 0x%08X!\n", potential_party);
                }
            }
        } else {
            printf("  ❌ '%s' not found in dump 1\n", GROUND_TRUTH_PARTY[i].nickname);
        }
        printf("\n");
    }
    
    // Search for each Pokemon nickname in dump 2
    printf("🔍 DUMP 2 Analysis:\n");
    uint32_t party_address_dump2 = 0;
    
    for (int i = 0; i < PARTY_SIZE; i++) {
        printf("📝 Searching for '%s' in dump 2...\n", GROUND_TRUTH_PARTY[i].nickname);
        
        uint32_t found_addresses[100];
        int num_found;
        
        if (find_nickname_in_memory(memory2, size2, GROUND_TRUTH_PARTY[i].nickname, 
                                  found_addresses, &num_found, 100)) {
            printf("  ✅ Found '%s' at %d location(s):\n", GROUND_TRUTH_PARTY[i].nickname, num_found);
            
            for (int j = 0; j < num_found; j++) {
                printf("    📍 Memory offset 0x%08X (address 0x%08X)\n", 
                       found_addresses[j], base_address + found_addresses[j]);
                
                // Try to find party start from this nickname
                uint32_t potential_party = find_party_start_from_nickname(memory2, size2, 
                                                                        found_addresses[j], base_address);
                if (potential_party > 0 && party_address_dump2 == 0) {
                    party_address_dump2 = potential_party;
                    printf("    🎉 FOUND COMPLETE PARTY starting at address 0x%08X!\n", potential_party);
                }
            }
        } else {
            printf("  ❌ '%s' not found in dump 2\n", GROUND_TRUTH_PARTY[i].nickname);
        }
        printf("\n");
    }
    
    // Summary
    printf("📋 SUMMARY:\n");
    printf("Dump 1 party address: 0x%08X\n", party_address_dump1);
    printf("Dump 2 party address: 0x%08X\n", party_address_dump2);
    
    if (party_address_dump1 > 0 && party_address_dump2 > 0) {
        if (party_address_dump1 == party_address_dump2) {
            printf("🎯 ✅ CONSISTENT ADDRESS FOUND: 0x%08X\n", party_address_dump1);
            printf("🎉 This address can be used for reliable memory reading!\n");
        } else {
            printf("❌ Addresses differ between dumps (0x%08X vs 0x%08X)\n", 
                   party_address_dump1, party_address_dump2);
            printf("💡 This confirms dynamic memory allocation in Quetzal\n");
        }
    } else {
        printf("❌ Could not find complete party in one or both dumps\n");
    }
    
    // Cleanup
    free(memory1);
    free(memory2);
    
    return 0;
}