#!/usr/bin/env npx tsx

/**
 * Script to find pointers to party data in Quetzal ROM hack
 * 
 * This script will:
 * 1. Connect to mgba WebSocket API
 * 2. Load both quetzal.ss0 and quetzal2.ss0 savestates
 * 3. Find the party data addresses in each savestate
 * 4. Scan memory for pointers that point to these addresses
 * 5. Check if any pointer locations are consistent between savestates
 */

import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client.js'

interface MemoryCandidate {
  address: number
  partyCount: number
  partyData: Uint8Array
  confidence: number
}

// Known Quetzal Pokemon species (from mapping data)
const KNOWN_SPECIES = [252, 258, 143, 306, 339, 484] // treecko, mudkip, snorlax, aggron, barboach, palkia

function validateQuetzalPokemon(data: Uint8Array, offset: number): boolean {
  if (offset + 104 > data.length) return false
  
  const view = new DataView(data.buffer, data.byteOffset + offset, 104)
  
  try {
    const species = view.getUint16(0x28, true)
    const level = view.getUint8(0x58)
    const currentHp = view.getUint16(0x23, true)
    const maxHp = view.getUint16(0x5A, true)
    
    // Basic validation
    if (level < 1 || level > 100) return false
    if (currentHp > maxHp || maxHp === 0) return false
    if (species === 0) return false
    
    return true
  } catch {
    return false
  }
}

async function findPartyData(client: MgbaWebSocketClient): Promise<MemoryCandidate | null> {
  console.log('🔍 Scanning for party data...')
  
  // Scan EWRAM region where party data is likely to be
  const scanRegions = [
    { start: 0x2024000, end: 0x2025000, name: 'Primary' },
    { start: 0x2025000, end: 0x2026000, name: 'Secondary' },
    { start: 0x2026000, end: 0x2027000, name: 'Tertiary' },
  ]

  for (const region of scanRegions) {
    console.log(`  Scanning ${region.name} region: 0x${region.start.toString(16)} - 0x${region.end.toString(16)}`)
    
    for (let addr = region.start; addr < region.end; addr += 4) {
      try {
        const partyCount = await client.readByte(addr)
        
        if (partyCount >= 1 && partyCount <= 6) {
          const partyDataAddr = addr + 4
          const partyData = await client.readBytes(partyDataAddr, partyCount * 104)
          
          let validCount = 0
          for (let i = 0; i < partyCount; i++) {
            if (validateQuetzalPokemon(partyData, i * 104)) {
              validCount++
            }
          }
          
          const confidence = validCount / partyCount
          if (confidence >= 0.8) {
            console.log(`✅ Found valid party data at 0x${addr.toString(16)} (count) / 0x${partyDataAddr.toString(16)} (data)`)
            console.log(`   Party count: ${partyCount}, Valid Pokemon: ${validCount}/${partyCount}, Confidence: ${(confidence * 100).toFixed(1)}%`)
            
            return {
              address: addr,
              partyCount,
              partyData,
              confidence
            }
          }
        }
      } catch (e) {
        // Skip invalid addresses
      }
    }
  }

  return null
}

async function findPointersTo(client: MgbaWebSocketClient, targetAddress: number): Promise<number[]> {
  console.log(`🔍 Scanning for pointers to 0x${targetAddress.toString(16)}...`)
  
  const pointers: number[] = []
  
  // Scan likely pointer regions in EWRAM
  const scanRegions = [
    { start: 0x2020000, end: 0x2030000, name: 'EWRAM' },
    { start: 0x3000000, end: 0x3008000, name: 'IWRAM' },
  ]

  for (const region of scanRegions) {
    console.log(`  Scanning ${region.name}: 0x${region.start.toString(16)} - 0x${region.end.toString(16)}`)
    
    for (let addr = region.start; addr < region.end; addr += 4) {
      try {
        const bytes = await client.readBytes(addr, 4)
        const view = new DataView(bytes.buffer)
        const value = view.getUint32(0, true) // little endian
        
        // Check if this value points to our target address (or close to it)
        if (Math.abs(value - targetAddress) <= 16) {
          console.log(`   Found potential pointer at 0x${addr.toString(16)} -> 0x${value.toString(16)}`)
          pointers.push(addr)
        }
      } catch (e) {
        // Skip invalid addresses
      }
    }
  }

  return pointers
}

async function loadSavestate(client: MgbaWebSocketClient, filename: string): Promise<void> {
  console.log(`🔄 Loading savestate: ${filename}`)
  const result = await client.evalLua(`emu:loadStateFile("/app/data/${filename}", C.SAVESTATE.SCREENSHOT)`)
  if (result.error) {
    throw new Error(`Failed to load savestate ${filename}: ${result.error}`)
  }
  // Wait for load to complete
  await new Promise(resolve => setTimeout(resolve, 2000))
}

async function main(): Promise<void> {
  const client = new MgbaWebSocketClient()
  
  try {
    console.log('🔌 Connecting to mGBA WebSocket...')
    await client.connect()
    console.log('✅ Connected to mGBA WebSocket')
    
    // Analysis for quetzal.ss0
    console.log('\n=== ANALYZING quetzal.ss0 ===')
    await loadSavestate(client, 'quetzal.ss0')
    
    const result1 = await findPartyData(client)
    let pointers1: number[] = []
    
    if (result1) {
      pointers1 = await findPointersTo(client, result1.address)
      console.log(`Found ${pointers1.length} potential pointers in quetzal.ss0`)
    }
    
    // Analysis for quetzal2.ss0
    console.log('\n=== ANALYZING quetzal2.ss0 ===')
    await loadSavestate(client, 'quetzal2.ss0')
    
    const result2 = await findPartyData(client)
    let pointers2: number[] = []
    
    if (result2) {
      pointers2 = await findPointersTo(client, result2.address)
      console.log(`Found ${pointers2.length} potential pointers in quetzal2.ss0`)
    }
    
    // Find common pointer locations
    console.log('\n=== ANALYSIS RESULTS ===')
    if (result1 && result2) {
      console.log(`Party data address in quetzal.ss0:  0x${result1.address.toString(16)}`)
      console.log(`Party data address in quetzal2.ss0: 0x${result2.address.toString(16)}`)
      
      // Find common pointers
      const commonPointers = pointers1.filter(p1 => {
        return pointers2.some(p2 => p1 === p2)
      })
      
      if (commonPointers.length > 0) {
        console.log('\n🎯 FOUND CONSISTENT POINTER LOCATIONS:')
        for (const pointer of commonPointers) {
          console.log(`   Pointer at 0x${pointer.toString(16)}`)
          
          // Verify the pointers
          await loadSavestate(client, 'quetzal.ss0')
          const bytes1 = await client.readBytes(pointer, 4)
          const view1 = new DataView(bytes1.buffer)
          const value1 = view1.getUint32(0, true)
          
          await loadSavestate(client, 'quetzal2.ss0')
          const bytes2 = await client.readBytes(pointer, 4)
          const view2 = new DataView(bytes2.buffer)
          const value2 = view2.getUint32(0, true)
          
          console.log(`     quetzal.ss0:  0x${pointer.toString(16)} -> 0x${value1.toString(16)}`)
          console.log(`     quetzal2.ss0: 0x${pointer.toString(16)} -> 0x${value2.toString(16)}`)
        }
      } else {
        console.log('\n❌ No consistent pointer locations found')
        console.log('   This suggests the party data uses truly dynamic allocation')
        console.log('   We may need to look for indirect pointers or data structures')
        
        // Let's look for patterns in memory
        console.log('\n🔍 Looking for memory patterns...')
        
        if (result1 && result2) {
          const offset = result2.address - result1.address
          console.log(`   Address difference: ${offset} bytes (0x${offset.toString(16)})`)
          
          // Check if there are base addresses that differ by the same amount
          console.log('   Checking for base address patterns...')
          
          await loadSavestate(client, 'quetzal.ss0')
          const regionData1 = await client.readBytes(0x2020000, 0x10000) // 64KB scan
          
          await loadSavestate(client, 'quetzal2.ss0')
          const regionData2 = await client.readBytes(0x2020000, 0x10000) // 64KB scan
          
          // Look for 4-byte values that changed by the same offset
          for (let i = 0; i < regionData1.length - 4; i += 4) {
            const view1 = new DataView(regionData1.buffer, regionData1.byteOffset + i, 4)
            const view2 = new DataView(regionData2.buffer, regionData2.byteOffset + i, 4)
            
            const value1 = view1.getUint32(0, true)
            const value2 = view2.getUint32(0, true)
            
            // Check if the values are valid EWRAM addresses and differ by our offset
            if (value1 >= 0x2020000 && value1 < 0x2040000 &&
                value2 >= 0x2020000 && value2 < 0x2040000 &&
                Math.abs((value2 - value1) - offset) <= 4) {
              const addr = 0x2020000 + i
              console.log(`   Pattern found at 0x${addr.toString(16)}: 0x${value1.toString(16)} -> 0x${value2.toString(16)} (diff: ${value2 - value1})`)
            }
          }
        }
      }
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