#!/usr/bin/env tsx

/**
 * Comprehensive script to find a consistent way to locate party data in Quetzal ROM hack
 * 
 * User confirmed addresses:
 * - quetzal.ss0: Party data at 0x2024a14
 * - quetzal2.ss0: Party data at 0x2024a58 (68 bytes later)
 * 
 * Goal: Find a consistent method to locate these addresses without knowing the data beforehand
 */

import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client'

interface MemoryPattern {
  address: number
  pattern: string
  description: string
}

interface PointerCandidate {
  address: number
  pointsTo: number
  confidence: number
  description: string
}

async function loadSavestate(client: MgbaWebSocketClient, filename: string): Promise<void> {
  console.log(`🔄 Loading savestate: ${filename}`)
  const result = await client.evalLua(`emu:loadStateFile("/app/data/${filename}", C.SAVESTATE.SCREENSHOT)`)
  if (result.error) {
    throw new Error(`Failed to load savestate ${filename}: ${result.error}`)
  }
  // Wait for load to stabilize
  await new Promise(resolve => setTimeout(resolve, 2000))
}

async function verifyUserClaimedAddress(client: MgbaWebSocketClient, address: number, description: string): Promise<boolean> {
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

async function scanForPointers(client: MgbaWebSocketClient, targetAddress: number, scanName: string): Promise<PointerCandidate[]> {
  console.log(`🔍 Scanning for pointers to 0x${targetAddress.toString(16)} (${scanName})...`)
  
  const candidates: PointerCandidate[] = []
  
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

async function scanForMemoryPatterns(client: MgbaWebSocketClient, targetAddress: number, scanName: string): Promise<MemoryPattern[]> {
  console.log(`🔍 Scanning for memory patterns around 0x${targetAddress.toString(16)} (${scanName})...`)
  
  const patterns: MemoryPattern[] = []
  
  try {
    // Read data around the target address to find patterns
    const contextSize = 256
    const contextData = await client.readBytes(targetAddress - contextSize, contextSize * 2)
    const view = new DataView(contextData.buffer)
    
    // Look for interesting patterns
    for (let offset = 0; offset < contextData.length - 8; offset += 4) {
      const addr = targetAddress - contextSize + offset
      const value = view.getUint32(offset, true)
      
      // Check for signature patterns
      if (value === 0xDEADBEEF || value === 0xCAFEBABE) {
        patterns.push({
          address: addr,
          pattern: `0x${value.toString(16)}`,
          description: 'Debug signature'
        })
      }
      
      // Check for size indicators (common in allocation headers)
      if (value === 624 || value === 104 || value === 6) { // Party size, Pokemon size, party count
        patterns.push({
          address: addr,
          pattern: `${value}`,
          description: `Potential size indicator (${value})`
        })
      }
      
      // Check for addresses that look like they point to memory regions
      if (value >= 0x2020000 && value < 0x2040000) {
        patterns.push({
          address: addr,
          pattern: `0x${value.toString(16)}`,
          description: 'EWRAM pointer candidate'
        })
      }
    }
    
  } catch (error) {
    console.log(`   ❌ Error scanning patterns: ${error}`)
  }
  
  return patterns
}

async function scanForAllocationHeaders(client: MgbaWebSocketClient, targetAddress: number): Promise<MemoryPattern[]> {
  console.log(`🔍 Scanning for allocation headers near 0x${targetAddress.toString(16)}...`)
  
  const patterns: MemoryPattern[] = []
  
  try {
    // Check common allocation header locations (before the data)
    const headerOffsets = [-32, -28, -24, -20, -16, -12, -8, -4]
    
    for (const offset of headerOffsets) {
      const headerAddr = targetAddress + offset
      const headerData = await client.readBytes(headerAddr, 8)
      const view = new DataView(headerData.buffer)
      
      const word1 = view.getUint32(0, true)
      const word2 = view.getUint32(4, true)
      
      // Look for allocation signatures
      if (word1 === 624 || word1 === 104 || word1 === 6) {
        patterns.push({
          address: headerAddr,
          pattern: `${word1}`,
          description: `Allocation size at offset ${offset}`
        })
      }
      
      // Look for magic numbers or type indicators
      if ((word1 & 0xFF000000) === 0x50000000) { // 'P' prefix for Pokemon?
        patterns.push({
          address: headerAddr,
          pattern: `0x${word1.toString(16)}`,
          description: `Type signature at offset ${offset}`
        })
      }
    }
    
  } catch (error) {
    console.log(`   ❌ Error scanning allocation headers: ${error}`)
  }
  
  return patterns
}

async function findBaseAddressPatterns(client: MgbaWebSocketClient, addr1: number, addr2: number): Promise<PointerCandidate[]> {
  console.log(`🔍 Looking for base address patterns (offset: ${addr2 - addr1} bytes)...`)
  
  const offset = addr2 - addr1
  const candidates: PointerCandidate[] = []
  
  // Scan for values that change by the same offset between savestates
  const regions = [
    { start: 0x2020000, end: 0x2025000, name: 'EWRAM Low' },
    { start: 0x3000000, end: 0x3004000, name: 'IWRAM' },
  ]
  
  for (const region of regions) {
    console.log(`   Scanning ${region.name} for base patterns...`)
    
    // We'll need to save current state, load both savestates, and compare
    // For now, let's look for potential base addresses in current state
    for (let addr = region.start; addr < region.end; addr += 4) {
      try {
        const bytes = await client.readBytes(addr, 4)
        const view = new DataView(bytes.buffer)
        const value = view.getUint32(0, true)
        
        // Check if this could be a base address
        if (value >= 0x2020000 && value < 0x2040000) {
          // Calculate what the offset would be if this is a base pointer
          const calculatedParty1 = value + (addr1 - 0x2020000) // Assume base at 0x2020000
          const calculatedParty2 = value + (addr2 - 0x2020000)
          
          if (Math.abs(calculatedParty1 - addr1) <= 256 || Math.abs(calculatedParty2 - addr2) <= 256) {
            candidates.push({
              address: addr,
              pointsTo: value,
              confidence: 60,
              description: `Potential base address pattern`
            })
          }
        }
      } catch (e) {
        // Skip invalid addresses  
      }
    }
  }
  
  return candidates
}

async function analyzeMemoryStructure(client: MgbaWebSocketClient, address: number, name: string): Promise<void> {
  console.log(`🔍 Analyzing memory structure at 0x${address.toString(16)} (${name})...`)
  
  try {
    // Read larger context around the address
    const contextSize = 1024
    const startAddr = address - contextSize
    const data = await client.readBytes(startAddr, contextSize * 2)
    
    console.log(`   Memory dump around party data:`)
    
    // Print hex dump around the target address
    for (let i = 0; i < 32; i++) {
      const offset = contextSize - 16 + i
      const addr = startAddr + offset
      const byte = data[offset]
      
      if (addr === address) {
        console.log(`   -> 0x${addr.toString(16)}: 0x${byte.toString(16).padStart(2, '0')} <-- PARTY DATA START`)
      } else if (addr === address - 4) {
        console.log(`   -> 0x${addr.toString(16)}: 0x${byte.toString(16).padStart(2, '0')} <-- LIKELY PARTY COUNT`)
      } else {
        console.log(`      0x${addr.toString(16)}: 0x${byte.toString(16).padStart(2, '0')}`)
      }
    }
    
  } catch (error) {
    console.log(`   ❌ Error analyzing structure: ${error}`)
  }
}

async function main(): Promise<void> {
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
    
    // Look for pointers
    const pointers1 = await scanForPointers(client, quetzal1PartyAddress, 'quetzal.ss0')
    
    // Look for patterns  
    const patterns1 = await scanForMemoryPatterns(client, quetzal1PartyAddress, 'quetzal.ss0')
    
    // Look for allocation headers
    const headers1 = await scanForAllocationHeaders(client, quetzal1PartyAddress)
    
    console.log('\n=== ANALYZING QUETZAL2.SS0 ===')
    await loadSavestate(client, 'quetzal2.ss0')
    
    // Analyze memory structure
    await analyzeMemoryStructure(client, quetzal2PartyAddress, 'quetzal2.ss0')
    
    // Look for pointers
    const pointers2 = await scanForPointers(client, quetzal2PartyAddress, 'quetzal2.ss0')
    
    // Look for patterns
    const patterns2 = await scanForMemoryPatterns(client, quetzal2PartyAddress, 'quetzal2.ss0')
    
    // Look for allocation headers
    const headers2 = await scanForAllocationHeaders(client, quetzal2PartyAddress)
    
    console.log('\n=== CROSS-ANALYSIS ===')
    
    // Find common pointer locations (addresses that appear in both)
    const commonPointerAddresses = pointers1
      .filter(p1 => pointers2.some(p2 => p1.address === p2.address))
      .map(p => p.address)
    
    if (commonPointerAddresses.length > 0) {
      console.log('🎯 FOUND CONSISTENT POINTER LOCATIONS:')
      for (const addr of commonPointerAddresses) {
        const p1 = pointers1.find(p => p.address === addr)!
        const p2 = pointers2.find(p => p.address === addr)!
        console.log(`   0x${addr.toString(16)}: points to 0x${p1.pointsTo.toString(16)} / 0x${p2.pointsTo.toString(16)}`)
        console.log(`      Offset difference: ${p2.pointsTo - p1.pointsTo} bytes`)
      }
    } else {
      console.log('❌ No consistent pointer locations found')
    }
    
    // Look for base address patterns
    await loadSavestate(client, 'quetzal.ss0')
    const basePatterns = await findBaseAddressPatterns(client, quetzal1PartyAddress, quetzal2PartyAddress)
    
    if (basePatterns.length > 0) {
      console.log('\n🎯 POTENTIAL BASE ADDRESS PATTERNS:')
      for (const pattern of basePatterns) {
        console.log(`   0x${pattern.address.toString(16)}: ${pattern.description} -> 0x${pattern.pointsTo.toString(16)}`)
      }
    }
    
    // Suggest next steps
    console.log('\n=== RECOMMENDATIONS ===')
    if (commonPointerAddresses.length > 0) {
      console.log('✅ Found consistent pointer addresses - these could be used for reliable party data location')
    } else if (basePatterns.length > 0) {
      console.log('⚠️  Found potential base patterns - need further validation')
    } else {
      console.log('❌ No consistent memory patterns found')
      console.log('💡 Suggestions:')
      console.log('   1. Look for indirect pointers (pointers to pointers)')
      console.log('   2. Analyze save data structures for hints')
      console.log('   3. Look for function call patterns that access party data')
      console.log('   4. Check for global state structures that track allocations')
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