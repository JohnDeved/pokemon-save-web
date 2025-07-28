#!/usr/bin/env python3

import struct
import sys

def find_any_party_pattern(memory_data, base_address, dump_name):
    """Find any party pattern with valid Pokemon structures"""
    print(f"🔍 Analyzing {dump_name} for ANY party pattern:")
    
    # Different offset combinations to try based on what worked for dump1
    configurations = [
        {"stride": 104, "species_offset": 0x28, "level_offset": 0x58},
        {"stride": 104, "species_offset": 0x2C, "level_offset": 0x5C},
        {"stride": 104, "species_offset": 0x30, "level_offset": 0x60}
    ]
    
    party_candidates = []
    
    for config in configurations:
        stride = config["stride"]
        species_off = config["species_offset"]
        level_off = config["level_offset"]
        
        print(f"  🔍 Trying stride={stride}, species_offset=0x{species_off:02X}, level_offset=0x{level_off:02X}")
        
        # Search through memory with 4-byte alignment
        for offset in range(0, len(memory_data) - (6 * stride), 4):
            party_info = []
            valid_pokemon_count = 0
            
            # Check up to 6 Pokemon starting at this offset
            for i in range(6):
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
                
                # Check if this looks like a valid Pokemon
                # Valid species: 1-1010, common ranges: 1-151, 252-493, 494-649, 650-721
                # Valid level: 1-100
                is_valid = False
                if 1 <= species <= 1010 and 1 <= level <= 100:
                    # Additional validation: common species ranges
                    if ((1 <= species <= 151) or     # Gen 1
                        (152 <= species <= 251) or   # Gen 2
                        (252 <= species <= 386) or   # Gen 3
                        (387 <= species <= 493) or   # Gen 4
                        (494 <= species <= 649) or   # Gen 5
                        (650 <= species <= 721)):    # Gen 6
                        is_valid = True
                
                if is_valid:
                    valid_pokemon_count += 1
                    party_info.append(f"Pokemon{i+1}: Species {species}, Level {level} ✅")
                else:
                    party_info.append(f"Pokemon{i+1}: Species {species}, Level {level} ❌")
                    if i == 0:  # If first Pokemon is invalid, skip this location
                        break
            
            # Report locations with at least 3 valid Pokemon
            if valid_pokemon_count >= 3:
                address = base_address + offset
                print(f"    🎯 Found {valid_pokemon_count}/6 valid Pokemon at address 0x{address:08X} (offset 0x{offset:08X})")
                for info in party_info[:valid_pokemon_count]:
                    print(f"      {info}")
                
                if valid_pokemon_count >= 6:
                    party_candidates.append({
                        'address': address,
                        'offset': offset,
                        'stride': stride,
                        'species_offset': species_off,
                        'level_offset': level_off,
                        'valid_count': valid_pokemon_count
                    })
                    print(f"    🎉 *** COMPLETE PARTY FOUND at 0x{address:08X} ***")
                print()
    
    return party_candidates

def main():
    if len(sys.argv) != 4:
        print("Usage: python3 find_any_party.py <dump1.bin> <dump2.bin> <base_address_hex>")
        print("Example: python3 find_any_party.py quetzal1_ewram.bin quetzal2_ewram.bin 0x02000000")
        sys.exit(1)
    
    file1 = sys.argv[1]
    file2 = sys.argv[2]
    base_address = int(sys.argv[3], 16)
    
    print("🔍 Searching for ANY party patterns in memory dumps")
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
    dump1_parties = find_any_party_pattern(memory1, base_address, "DUMP 1")
    print()
    dump2_parties = find_any_party_pattern(memory2, base_address, "DUMP 2")
    
    # Summary
    print("\n📋 SUMMARY:")
    print(f"DUMP 1 complete parties found: {len(dump1_parties)}")
    for party in dump1_parties:
        print(f"  Address: 0x{party['address']:08X}, Valid Pokemon: {party['valid_count']}, Stride: {party['stride']}, Species+0x{party['species_offset']:02X}, Level+0x{party['level_offset']:02X}")
    
    print(f"DUMP 2 complete parties found: {len(dump2_parties)}")
    for party in dump2_parties:
        print(f"  Address: 0x{party['address']:08X}, Valid Pokemon: {party['valid_count']}, Stride: {party['stride']}, Species+0x{party['species_offset']:02X}, Level+0x{party['level_offset']:02X}")
    
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
            if dump1_parties and dump2_parties:
                print("📍 Party addresses found:")
                print(f"  DUMP 1: 0x{dump1_parties[0]['address']:08X}")
                print(f"  DUMP 2: 0x{dump2_parties[0]['address']:08X}")
                print(f"  Difference: {dump2_parties[0]['address'] - dump1_parties[0]['address']} bytes")
    else:
        print(f"\n❌ Could not find complete party in one or both dumps")

if __name__ == "__main__":
    main()