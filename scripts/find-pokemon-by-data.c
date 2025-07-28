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

// Function to search for species ID and level combinations
void find_pokemon_by_data(const uint8_t* memory, size_t memory_size, uint32_t base_address, const char* dump_name) {
    printf("🔍 Searching for ground truth Pokemon in %s:\n", dump_name);
    
    for (int p = 0; p < PARTY_SIZE; p++) {
        printf("📝 Looking for %s (Species %d, Level %d):\n", 
               GROUND_TRUTH_PARTY[p].nickname, 
               GROUND_TRUTH_PARTY[p].species_id, 
               GROUND_TRUTH_PARTY[p].level);
        
        int found_count = 0;
        
        // Search through memory with 4-byte alignment
        for (size_t offset = 0; offset + POKEMON_SIZE <= memory_size; offset += 4) {
            // Try different species ID offsets (common in Pokemon structures)
            const int SPECIES_OFFSETS[] = {0x20, 0x28, 0x2C, 0x30, -1};
            const int LEVEL_OFFSETS[] = {0x54, 0x58, 0x5C, 0x60, -1};
            
            for (int so = 0; SPECIES_OFFSETS[so] != -1; so++) {
                for (int lo = 0; LEVEL_OFFSETS[lo] != -1; lo++) {
                    int species_offset = SPECIES_OFFSETS[so];
                    int level_offset = LEVEL_OFFSETS[lo];
                    
                    if (offset + species_offset + 2 > memory_size || 
                        offset + level_offset >= memory_size) continue;
                    
                    uint16_t species = *(uint16_t*)(memory + offset + species_offset);
                    uint8_t level = memory[offset + level_offset];
                    
                    if (species == GROUND_TRUTH_PARTY[p].species_id && 
                        level == GROUND_TRUTH_PARTY[p].level) {
                        
                        printf("  ✅ Found at offset 0x%08lX (address 0x%08lX)\n", 
                               offset, base_address + offset);
                        printf("      Species at offset +0x%02X, Level at offset +0x%02X\n", 
                               species_offset, level_offset);
                        
                        // Print some context around this location
                        printf("      Memory context: ");
                        for (int i = -8; i <= 8; i++) {
                            if (offset + i >= 0 && offset + i < memory_size) {
                                printf("%02X ", memory[offset + i]);
                            }
                        }
                        printf("\n");
                        
                        found_count++;
                        if (found_count >= 5) break; // Limit output
                    }
                }
                if (found_count >= 5) break;
            }
            if (found_count >= 5) break;
        }
        
        if (found_count == 0) {
            printf("  ❌ Not found\n");
        }
        printf("\n");
    }
}

// Function to search for the complete party pattern
void find_party_pattern(const uint8_t* memory, size_t memory_size, uint32_t base_address, const char* dump_name) {
    printf("🎯 Searching for complete party pattern in %s:\n", dump_name);
    
    // Try different stride patterns (104 bytes is expected, but let's be flexible)
    const int STRIDE_OPTIONS[] = {104, 100, 108, 112, 96, -1};
    const int SPECIES_OFFSETS[] = {0x20, 0x28, 0x2C, 0x30, -1};
    const int LEVEL_OFFSETS[] = {0x54, 0x58, 0x5C, 0x60, -1};
    
    for (int stride_idx = 0; STRIDE_OPTIONS[stride_idx] != -1; stride_idx++) {
        int stride = STRIDE_OPTIONS[stride_idx];
        
        for (int so = 0; SPECIES_OFFSETS[so] != -1; so++) {
            for (int lo = 0; LEVEL_OFFSETS[lo] != -1; lo++) {
                int species_offset = SPECIES_OFFSETS[so];
                int level_offset = LEVEL_OFFSETS[lo];
                
                printf("  🔍 Trying stride %d, species offset 0x%02X, level offset 0x%02X\n", 
                       stride, species_offset, level_offset);
                
                // Search through memory
                for (size_t base_offset = 0; base_offset + (PARTY_SIZE * stride) <= memory_size; base_offset += 4) {
                    int matches = 0;
                    
                    // Check all 6 Pokemon in sequence
                    for (int p = 0; p < PARTY_SIZE; p++) {
                        size_t pokemon_offset = base_offset + (p * stride);
                        
                        if (pokemon_offset + species_offset + 2 > memory_size || 
                            pokemon_offset + level_offset >= memory_size) break;
                        
                        uint16_t species = *(uint16_t*)(memory + pokemon_offset + species_offset);
                        uint8_t level = memory[pokemon_offset + level_offset];
                        
                        if (species == GROUND_TRUTH_PARTY[p].species_id && 
                            level == GROUND_TRUTH_PARTY[p].level) {
                            matches++;
                        } else {
                            break; // Must match in sequence
                        }
                    }
                    
                    if (matches >= 3) { // At least 3 Pokemon match
                        printf("    🎉 Found %d/%d Pokemon starting at offset 0x%08lX (address 0x%08lX)\n", 
                               matches, PARTY_SIZE, base_offset, base_address + base_offset);
                        
                        // Print details of each Pokemon found
                        for (int p = 0; p < matches; p++) {
                            size_t pokemon_offset = base_offset + (p * stride);
                            uint16_t species = *(uint16_t*)(memory + pokemon_offset + species_offset);
                            uint8_t level = memory[pokemon_offset + level_offset];
                            
                            printf("      Pokemon %d: Species %d, Level %d (%s) ✅\n", 
                                   p + 1, species, level, GROUND_TRUTH_PARTY[p].nickname);
                        }
                        
                        if (matches == PARTY_SIZE) {
                            printf("    🎯 *** COMPLETE PARTY FOUND at address 0x%08lX ***\n", 
                                   base_address + base_offset);
                        }
                        printf("\n");
                    }
                }
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
    
    printf("🔍 Searching for ground truth party by species ID and level\n");
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
    
    // Search for individual Pokemon first
    find_pokemon_by_data(memory1, size1, base_address, "DUMP 1");
    find_pokemon_by_data(memory2, size2, base_address, "DUMP 2");
    
    // Search for complete party patterns
    find_party_pattern(memory1, size1, base_address, "DUMP 1");
    find_party_pattern(memory2, size2, base_address, "DUMP 2");
    
    // Cleanup
    free(memory1);
    free(memory2);
    
    return 0;
}