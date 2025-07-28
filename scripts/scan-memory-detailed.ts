#!/usr/bin/env npx tsx
/**
 * Simple memory dumper to find party data in small chunks
 */

import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client'

async function main() {
  const client = new MgbaWebSocketClient('ws://localhost:7102/ws')
  
  console.log('🔌 Connecting to mGBA WebSocket...')
  await client.connect()
  
  const gameTitle = await client.getGameTitle()
  console.log(`🎮 Connected to: "${gameTitle}"`)
  
  // Check vanilla Emerald party addresses
  const vanillaPartyCountAddr = 0x20244e9
  const vanillaPartyDataAddr = 0x20244ec
  
  try {
    console.log('\n🔍 Checking vanilla Emerald addresses...')
    const partyCount = await client.readByte(vanillaPartyCountAddr)
    console.log(`Party count at 0x${vanillaPartyCountAddr.toString(16)}: ${partyCount}`)
    
    if (partyCount > 0) {
      const firstPokemon = await client.readBytes(vanillaPartyDataAddr, 80)
      console.log(`First Pokemon data (80 bytes): ${Array.from(firstPokemon).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
    }
  } catch (error) {
    console.log(`Error reading vanilla addresses: ${error}`)
  }
  
  // Try to find specific level patterns
  console.log('\n🔍 Scanning for level patterns...')
  const targetLevels = [44, 45, 47, 45, 41, 37]
  
  // Scan in smaller chunks to avoid timeouts
  const scanRegions = [
    { start: 0x02020000, size: 0x10000, name: 'EWRAM high' },
    { start: 0x02030000, size: 0x10000, name: 'EWRAM higher' },
    { start: 0x02010000, size: 0x10000, name: 'EWRAM mid' },
    { start: 0x02000000, size: 0x10000, name: 'EWRAM low' },
  ]
  
  for (const region of scanRegions) {
    console.log(`\nScanning ${region.name} (0x${region.start.toString(16)} - 0x${(region.start + region.size).toString(16)})...`)
    
    try {
      // Scan in small 1KB chunks
      for (let addr = region.start; addr < region.start + region.size; addr += 1024) {
        const chunkSize = Math.min(1024, region.start + region.size - addr)
        const data = await client.readBytes(addr, chunkSize)
        
        // Look for our target level sequence
        for (let i = 0; i < data.length - 600; i++) {
          if (data[i] === 44) { // First level
            // Check if we can find the sequence at 104-byte intervals
            let matches = 1
            const positions = [i]
            
            for (let j = 1; j < targetLevels.length; j++) {
              const nextPos = i + (j * 104) + 88 - 88; // Level offset correction
              if (nextPos < data.length && data[nextPos] === targetLevels[j]) {
                matches++
                positions.push(nextPos)
              } else {
                break
              }
            }
            
            if (matches >= 3) {
              console.log(`  🎯 Found ${matches} level matches at 0x${(addr + i).toString(16)}`)
              console.log(`  Levels found: ${positions.map(pos => data[pos]).join(', ')}`)
            }
          }
        }
      }
    } catch (error) {
      console.log(`  Error scanning ${region.name}: ${error}`)
    }
  }
  
  // Try direct species search
  console.log('\n🔍 Searching for specific species IDs...')
  const targetSpecies = [208, 286, 143, 272, 6, 561] // Steelix, Breloom, Snorlax, Ludicolo, Rayquaza, Sigilyph
  
  for (const region of scanRegions) {
    try {
      for (let addr = region.start; addr < region.start + region.size; addr += 1024) {
        const chunkSize = Math.min(1024, region.start + region.size - addr)
        const data = await client.readBytes(addr, chunkSize)
        
        // Look for species patterns (16-bit little endian)
        for (let i = 0; i < data.length - 2; i++) {
          const species = data[i] | (data[i + 1] << 8)
          
          if (targetSpecies.includes(species)) {
            console.log(`  Found species ${species} at 0x${(addr + i).toString(16)}`)
            
            // Check if this could be Pokemon data by looking at nearby structure
            if (i >= 40 && i + 48 < data.length) { // Enough room for level check
              const levelPos = i + 48 // 88 - 40 = 48 bytes from species to level in Quetzal
              const level = data[levelPos]
              if (level > 0 && level <= 100) {
                console.log(`    Level at +48: ${level}`)
                
                // Check if this matches our expected team
                const speciesIndex = targetSpecies.indexOf(species)
                if (speciesIndex >= 0 && level === targetLevels[speciesIndex]) {
                  console.log(`    🎯 PERFECT MATCH! ${species} Lv.${level} at 0x${(addr + i - 40).toString(16)} (Pokemon start)`)
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.log(`  Error searching species in ${region.name}: ${error}`)
    }
  }
  
  client.disconnect()
  console.log('\n✅ Done')
}

main().catch(console.error)