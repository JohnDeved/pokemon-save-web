#!/usr/bin/env node

/**
 * Comprehensive script to find a consistent way to locate party data in Quetzal ROM hack
 * 
 * User confirmed addresses:
 * - quetzal.ss0: Party data at 0x2024a14
 * - quetzal2.ss0: Party data at 0x2024a58 (68 bytes later)
 * 
 * Goal: Find a consistent method to locate these addresses without knowing the data beforehand
 */

const { MgbaWebSocketClient } = require('../src/lib/mgba/websocket-client')

async function loadSavestate(client, filename) {
  console.log(`🔄 Loading savestate: ${filename}`)
  const result = await client.evalLua(`emu:loadStateFile("/app/data/${filename}", C.SAVESTATE.SCREENSHOT)`)
  if (result.error) {
    throw new Error(`Failed to load savestate ${filename}: ${result.error}`)
  }
  // Wait for load to stabilize
  await new Promise(resolve => setTimeout(resolve, 2000))
}

async function verifyUserClaimedAddress(client, address, description) {
  console.log(`🔍 Verifying ${description} at 0x${address.toString(16)}...`)
  
  try {
    // Read party count (should be 1-6)
    const partyCount = await client.readByte(address - 4) // Party count typically 4 bytes before party data
    console.log(`   Party count: ${partyCount}`)
    
    if (partyCount < 1 || partyCount > 6) {
      console.log(`   ❌ Invalid party count: ${partyCount}`)
      return false
    }
    
    // Read first Pokemon data (104 bytes)
    const pokemonData = await client.readBytes(address, 104)
    const view = new DataView(pokemonData.buffer)
    
    // Check Quetzal Pokemon structure
    const species = view.getUint16(0x28, true)  // Species at offset 0x28
    const level = view.getUint8(0x58)           // Level at offset 0x58
    const currentHp = view.getUint16(0x23, true) // Current HP at offset 0x23
    const maxHp = view.getUint16(0x5A, true)     // Max HP at offset 0x5A
    
    console.log(`   Species: ${species}, Level: ${level}, HP: ${currentHp}/${maxHp}`)
    
    // Basic validation
    if (level < 1 || level > 100) {
      console.log(`   ❌ Invalid level: ${level}`)
      return false
    }
    
    if (currentHp > maxHp || maxHp === 0) {
      console.log(`   ❌ Invalid HP: ${currentHp}/${maxHp}`)
      return false
    }
    
    if (species === 0) {
      console.log(`   ❌ Invalid species: ${species}`)
      return false
    }
    
    console.log(`   ✅ Valid Pokemon data found at ${description}`)
    return true
    
  } catch (error) {
    console.log(`   ❌ Error reading from ${description}: ${error}`)
    return false
  }
}

async function scanForPointers(client, targetAddress, scanName) {
  console.log(`🔍 Scanning for pointers to 0x${targetAddress.toString(16)} (${scanName})...`)
  
  const candidates = []
  
  // Define scan regions
  const regions = [
    { start: 0x2020000, end: 0x2025000, name: 'EWRAM Low' },
    { start: 0x2025000, end: 0x202A000, name: 'EWRAM Mid' },
    { start: 0x202A000, end: 0x2030000, name: 'EWRAM High' },
    { start: 0x3000000, end: 0x3008000, name: 'IWRAM' },
  ]
  
  for (const region of regions) {
    console.log(`   Scanning ${region.name}: 0x${region.start.toString(16)} - 0x${region.end.toString(16)}`)
    
    for (let addr = region.start; addr < region.end; addr += 4) {
      try {
        const bytes = await client.readBytes(addr, 4)
        const view = new DataView(bytes.buffer)
        const value = view.getUint32(0, true)
        
        // Check for exact match or close match (within 16 bytes)
        const distance = Math.abs(value - targetAddress)
        if (distance <= 16) {
          let confidence = 0
          let description = ''
          
          if (distance === 0) {
            confidence = 100
            description = 'Exact pointer'
          } else if (distance <= 4) {
            confidence = 90
            description = `Near pointer (off by ${distance})`
          } else {
            confidence = 70
            description = `Close pointer (off by ${distance})`
          }
          
          candidates.push({
            address: addr,
            pointsTo: value,
            confidence,
            description
          })
          
          console.log(`     Found: 0x${addr.toString(16)} -> 0x${value.toString(16)} (${description})`)
        }
      } catch (e) {
        // Skip invalid addresses
      }
    }
  }
  
  return candidates
}

async function analyzeMemoryStructure(client, address, name) {
  console.log(`🔍 Analyzing memory structure at 0x${address.toString(16)} (${name})...`)
  
  try {
    // Read larger context around the address
    const contextSize = 64
    const startAddr = address - contextSize
    const data = await client.readBytes(startAddr, contextSize * 2)
    
    console.log(`   Memory dump around party data:`)
    
    // Print hex dump around the target address in 16-byte lines
    for (let line = 0; line < 8; line++) {
      const lineOffset = line * 16
      const lineAddr = startAddr + lineOffset
      let hexStr = `   0x${lineAddr.toString(16)}: `
      let asciiStr = ' '
      
      for (let i = 0; i < 16 && lineOffset + i < data.length; i++) {
        const byte = data[lineOffset + i]
        hexStr += byte.toString(16).padStart(2, '0') + ' '
        asciiStr += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.'
      }
      
      // Mark important addresses
      if (lineAddr <= address && address < lineAddr + 16) {
        hexStr += ' <-- PARTY DATA HERE'
      } else if (lineAddr <= address - 4 && address - 4 < lineAddr + 16) {
        hexStr += ' <-- PARTY COUNT HERE'
      }
      
      console.log(hexStr + asciiStr)
    }
    
  } catch (error) {
    console.log(`   ❌ Error analyzing structure: ${error}`)
  }
}

async function scanForStructuralPatterns(client, address, scanName) {
  console.log(`🔍 Scanning for structural patterns around 0x${address.toString(16)} (${scanName})...`)
  
  try {
    // Look for patterns that might indicate memory management structures
    const searchRadius = 0x1000 // 4KB search radius
    const patterns = []
    
    // Scan backwards from party address looking for potential headers/structures
    for (let offset = -searchRadius; offset < searchRadius; offset += 4) {
      const scanAddr = address + offset
      if (scanAddr < 0x2020000 || scanAddr >= 0x2040000) continue
      
      try {
        const bytes = await client.readBytes(scanAddr, 4)
        const view = new DataView(bytes.buffer)
        const value = view.getUint32(0, true)
        
        // Look for values that could be related to party data
        if (value === 624) { // 6 Pokemon * 104 bytes
          patterns.push({ offset, value, description: 'Party size in bytes' })
        } else if (value === 6) { // Max party count
          patterns.push({ offset, value, description: 'Max party count' })
        } else if (value === 104) { // Pokemon size
          patterns.push({ offset, value, description: 'Pokemon size' })
        } else if ((value & 0xFFFF0000) === (address & 0xFFFF0000)) { // Same memory page
          patterns.push({ offset, value, description: 'Same page pointer' })
        }
      } catch (e) {
        // Skip invalid addresses
      }
    }
    
    if (patterns.length > 0) {
      console.log(`   Found ${patterns.length} structural patterns:`)
      for (const pattern of patterns) {
        const addr = address + pattern.offset
        console.log(`     0x${addr.toString(16)} (${pattern.offset >= 0 ? '+' : ''}${pattern.offset}): ${pattern.value} (${pattern.description})`)
      }
    } else {
      console.log(`   No obvious structural patterns found`)
    }
    
  } catch (error) {
    console.log(`   ❌ Error scanning patterns: ${error}`)
  }
}

async function main() {
  const client = new MgbaWebSocketClient()
  
  try {
    console.log('🔌 Connecting to mGBA WebSocket...')
    await client.connect()
    console.log('✅ Connected to mGBA WebSocket')
    
    // User confirmed addresses
    const quetzal1PartyAddress = 0x2024a14
    const quetzal2PartyAddress = 0x2024a58
    
    console.log('\n=== VERIFYING USER CONFIRMED ADDRESSES ===')
    
    // Verify quetzal.ss0 address
    await loadSavestate(client, 'quetzal.ss0')
    const valid1 = await verifyUserClaimedAddress(client, quetzal1PartyAddress, 'quetzal.ss0 party data')
    
    // Verify quetzal2.ss0 address  
    await loadSavestate(client, 'quetzal2.ss0')
    const valid2 = await verifyUserClaimedAddress(client, quetzal2PartyAddress, 'quetzal2.ss0 party data')
    
    if (!valid1 || !valid2) {
      console.log('❌ Could not verify user claimed addresses - stopping analysis')
      return
    }
    
    console.log('\n✅ User claimed addresses verified successfully!')
    console.log(`Address difference: ${quetzal2PartyAddress - quetzal1PartyAddress} bytes (0x${(quetzal2PartyAddress - quetzal1PartyAddress).toString(16)})`)
    
    console.log('\n=== ANALYZING QUETZAL.SS0 ===')
    await loadSavestate(client, 'quetzal.ss0')
    
    // Analyze memory structure
    await analyzeMemoryStructure(client, quetzal1PartyAddress, 'quetzal.ss0')
    
    // Look for structural patterns
    await scanForStructuralPatterns(client, quetzal1PartyAddress, 'quetzal.ss0')
    
    // Look for pointers
    const pointers1 = await scanForPointers(client, quetzal1PartyAddress, 'quetzal.ss0')
    
    console.log('\n=== ANALYZING QUETZAL2.SS0 ===')
    await loadSavestate(client, 'quetzal2.ss0')
    
    // Analyze memory structure
    await analyzeMemoryStructure(client, quetzal2PartyAddress, 'quetzal2.ss0')
    
    // Look for structural patterns
    await scanForStructuralPatterns(client, quetzal2PartyAddress, 'quetzal2.ss0')
    
    // Look for pointers
    const pointers2 = await scanForPointers(client, quetzal2PartyAddress, 'quetzal2.ss0')
    
    console.log('\n=== CROSS-ANALYSIS ===')
    
    // Find common pointer locations (addresses that appear in both)
    const commonPointerAddresses = pointers1
      .filter(p1 => pointers2.some(p2 => p1.address === p2.address))
      .map(p => p.address)
    
    if (commonPointerAddresses.length > 0) {
      console.log('🎯 FOUND CONSISTENT POINTER LOCATIONS:')
      for (const addr of commonPointerAddresses) {
        const p1 = pointers1.find(p => p.address === addr)
        const p2 = pointers2.find(p => p.address === addr)
        console.log(`   0x${addr.toString(16)}: points to 0x${p1.pointsTo.toString(16)} / 0x${p2.pointsTo.toString(16)}`)
        console.log(`      Offset difference: ${p2.pointsTo - p1.pointsTo} bytes`)
      }
    } else {
      console.log('❌ No consistent pointer locations found')
    }
    
    // Calculate the memory offset pattern
    const offsetDifference = quetzal2PartyAddress - quetzal1PartyAddress
    console.log(`\n📊 Memory offset pattern: ${offsetDifference} bytes (0x${offsetDifference.toString(16)})`)
    
    console.log('\n=== RECOMMENDATIONS ===')
    if (commonPointerAddresses.length > 0) {
      console.log('✅ Found consistent pointer addresses - these could be used for reliable party data location')
      console.log('💡 Next step: Implement dynamic reading using these pointers')
    } else {
      console.log('❌ No consistent memory pointers found')
      console.log('💡 Alternative approaches to try:')
      console.log('   1. Look for signature bytes that precede party data')
      console.log('   2. Search for known Pokemon species IDs and work backwards')
      console.log('   3. Scan for party count (1-6) followed by valid Pokemon data')
      console.log('   4. Look for memory allocation patterns or heap structures')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await client.disconnect()
  }
}

if (require.main === module) {
  main().catch(console.error)
}