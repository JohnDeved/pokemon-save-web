#!/usr/bin/env python3

import struct
import sys

# Ground truth party data from quetzal_ground_truth.json
GROUND_TRUTH_PARTY = [
    {"species_id": 208, "level": 44, "nickname": "Steelix"},
    {"species_id": 286, "level": 45, "nickname": "Breloom"},
    {"species_id": 143, "level": 47, "nickname": "Snorlax"},
    {"species_id": 272, "level": 45, "nickname": "Ludicolo"},
    {"species_id": 6, "level": 41, "nickname": "Rayquaza"},
    {"species_id": 561, "level": 37, "nickname": "Sigilyph"}
]

def find_party_addresses(memory_data, base_address, dump_name):
    """Find all potential party start addresses"""
    print(f"🔍 Analyzing {dump_name} for ground truth party:")
    print("📋 Expected: Steelix(208/44), Breloom(286/45), Snorlax(143/47), Ludicolo(272/45), Rayquaza(6/41), Sigilyph(561/37)")
    
    # Different offset combinations to try
    species_offsets = [0x20, 0x28, 0x2C, 0x30]
    level_offsets = [0x54, 0x58, 0x5C, 0x60]
    strides = [100, 104, 108]  # Different possible Pokemon structure sizes
    
    party_candidates = []
    
    for stride in strides:
        for species_off in species_offsets:
            for level_off in level_offsets:
                print(f"  🔍 Trying stride={stride}, species_offset=0x{species_off:02X}, level_offset=0x{level_off:02X}")
                
                # Search through memory with 4-byte alignment
                for offset in range(0, len(memory_data) - (6 * stride), 4):
                    matches = 0
                    party_info = []
                    
                    # Check if all 6 Pokemon match in sequence
                    for i, expected in enumerate(GROUND_TRUTH_PARTY):
                        pokemon_offset = offset + (i * stride)
                        
                        # Bounds check
                        if pokemon_offset + max(species_off + 2, level_off + 1) > len(memory_data):
                            break
                            
                        # Extract species ID (little endian uint16)
                        species_bytes = memory_data[pokemon_offset + species_off:pokemon_offset + species_off + 2]
                        if len(species_bytes) < 2:
                            break
                        species = struct.unpack('<H', species_bytes)[0]
                        
                        # Extract level (uint8)
                        level = memory_data[pokemon_offset + level_off]
                        
                        if species == expected["species_id"] and level == expected["level"]:
                            matches += 1
                            party_info.append(f"{expected['nickname']}({species}/{level})✅")
                        else:
                            party_info.append(f"Expected:{expected['nickname']}({expected['species_id']}/{expected['level']}) Got:({species}/{level})❌")
                            break
                    
                    # Report significant matches
                    if matches >= 3:
                        address = base_address + offset
                        print(f"    🎯 Found {matches}/6 Pokemon at address 0x{address:08X} (offset 0x{offset:08X})")
                        for info in party_info:
                            print(f"      {info}")
                        
                        if matches == 6:
                            party_candidates.append({
                                'address': address,
                                'offset': offset,
                                'stride': stride,
                                'species_offset': species_off,
                                'level_offset': level_off,
                                'matches': matches
                            })
                            print(f"    🎉 *** COMPLETE PARTY FOUND at 0x{address:08X} ***")
                        print()
    
    return party_candidates

def main():
    if len(sys.argv) != 4:
        print("Usage: python3 find_party_addresses.py <dump1.bin> <dump2.bin> <base_address_hex>")
        print("Example: python3 find_party_addresses.py quetzal1_ewram.bin quetzal2_ewram.bin 0x02000000")
        sys.exit(1)
    
    file1 = sys.argv[1]
    file2 = sys.argv[2]
    base_address = int(sys.argv[3], 16)
    
    print("🔍 Searching for exact ground truth party in memory dumps")
    print(f"📄 File 1: {file1}")
    print(f"📄 File 2: {file2}")
    print(f"🎯 Base address: 0x{base_address:08X}")
    print()
    
    # Load memory dumps
    try:
        with open(file1, 'rb') as f:
            memory1 = f.read()
        with open(file2, 'rb') as f:
            memory2 = f.read()
    except FileNotFoundError as e:
        print(f"❌ Cannot open file: {e}")
        sys.exit(1)
    
    print(f"✅ Loaded memory dumps ({len(memory1)} and {len(memory2)} bytes)")
    print()
    
    # Find party addresses in both dumps
    dump1_parties = find_party_addresses(memory1, base_address, "DUMP 1")
    print()
    dump2_parties = find_party_addresses(memory2, base_address, "DUMP 2")
    
    # Summary
    print("\n📋 SUMMARY:")
    print(f"DUMP 1 complete parties found: {len(dump1_parties)}")
    for party in dump1_parties:
        print(f"  Address: 0x{party['address']:08X}, Stride: {party['stride']}, Species+0x{party['species_offset']:02X}, Level+0x{party['level_offset']:02X}")
    
    print(f"DUMP 2 complete parties found: {len(dump2_parties)}")
    for party in dump2_parties:
        print(f"  Address: 0x{party['address']:08X}, Stride: {party['stride']}, Species+0x{party['species_offset']:02X}, Level+0x{party['level_offset']:02X}")
    
    # Check for consistent addresses
    if dump1_parties and dump2_parties:
        consistent_addresses = []
        for p1 in dump1_parties:
            for p2 in dump2_parties:
                if p1['address'] == p2['address']:
                    consistent_addresses.append(p1['address'])
        
        if consistent_addresses:
            print(f"\n🎯 ✅ CONSISTENT ADDRESSES FOUND:")
            for addr in consistent_addresses:
                print(f"  0x{addr:08X} - This address is stable across both savestates!")
        else:
            print(f"\n❌ NO CONSISTENT ADDRESSES FOUND")
            print("💡 This confirms that Quetzal uses dynamic memory allocation for party data")
    else:
        print(f"\n❌ Could not find complete party in one or both dumps")

if __name__ == "__main__":
    main()