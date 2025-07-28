#!/usr/bin/env tsx
/**
 * Investigate the Rayquaza location and surrounding memory
 */

import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client.js'

class RayquazaInvestigator {
  private client: MgbaWebSocketClient

  constructor() {
    this.client = new MgbaWebSocketClient()
  }

  async connect(): Promise<void> {
    console.log('🔌 Connecting to mGBA WebSocket...')
    await this.client.connect()
    console.log('✅ Connected!')
    
    const title = await this.client.getGameTitle()
    console.log(`📜 Game: "${title}"`)
  }

  async investigateRayquaza(): Promise<void> {
    const rayquazaAddr = 0x20078ea
    console.log(`\n🐉 Investigating Rayquaza at 0x${rayquazaAddr.toString(16)}...`)
    
    // Read data around the Rayquaza location
    const startAddr = rayquazaAddr - 0x100  // Read 256 bytes before
    const totalSize = 0x300                  // Total 768 bytes
    
    try {
      const data = await this.client.readBytes(startAddr, totalSize)
      console.log(`\n📊 Memory dump around Rayquaza (0x${startAddr.toString(16)} - 0x${(startAddr + totalSize).toString(16)}):\n`)
      
      // Show hex dump
      for (let i = 0; i < data.length; i += 16) {
        const addr = startAddr + i
        const row = data.slice(i, i + 16)
        const hex = Array.from(row).map(b => b.toString(16).padStart(2, '0')).join(' ')
        const ascii = Array.from(row).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('')
        
        // Highlight the Rayquaza location
        const marker = (addr <= rayquazaAddr && rayquazaAddr < addr + 16) ? ' <-- RAYQUAZA' : ''
        console.log(`0x${addr.toString(16)}: ${hex.padEnd(47)} ${ascii}${marker}`)
      }
      
      // Check if this could be part of a Pokemon structure
      console.log('\n🔍 Analyzing potential Pokemon structures...')
      await this.analyzeStructures(rayquazaAddr)
      
    } catch (error) {
      console.error('❌ Error reading memory:', error)
    }
  }

  private async analyzeStructures(rayquazaAddr: number): Promise<void> {
    // Try different offsets - maybe Rayquaza isn't at the species offset we expect
    const possibleSpeciesOffsets = [0x00, 0x08, 0x10, 0x18, 0x20, 0x28, 0x30]
    
    console.log(`\nTesting if Rayquaza at 0x${rayquazaAddr.toString(16)} is part of a Pokemon structure...`)
    
    for (const speciesOffset of possibleSpeciesOffsets) {
      const pokemonStart = rayquazaAddr - speciesOffset
      console.log(`\n🧪 Testing Pokemon structure starting at 0x${pokemonStart.toString(16)} (species at +0x${speciesOffset.toString(16)})`)
      
      try {
        // Read potential Pokemon data
        const pokemonData = await this.client.readBytes(pokemonStart, 104)
        
        // Extract key fields
        const species = pokemonData[speciesOffset]! | (pokemonData[speciesOffset + 1]! << 8)
        
        // Try different level offsets
        const levelOffsets = [0x54, 0x58, 0x5C, 0x60, 0x04, 0x08]
        
        for (const levelOffset of levelOffsets) {
          if (levelOffset < pokemonData.length) {
            const level = pokemonData[levelOffset]!
            
            console.log(`  Species: ${species}, Level at +0x${levelOffset.toString(16)}: ${level}`)
            
            if (species === 6 && level === 41) {
              console.log(`  🎯 MATCH! This looks like Rayquaza Lv41 from our expected party!`)
              await this.analyzeFullParty(pokemonStart, speciesOffset, levelOffset)
            }
          }
        }
        
      } catch (error) {
        console.log(`  ❌ Error reading structure: ${error}`)
      }
    }
  }

  private async analyzeFullParty(partyStart: number, speciesOffset: number, levelOffset: number): Promise<void> {
    console.log(`\n🎉 Found Rayquaza structure! Analyzing full party starting at 0x${partyStart.toString(16)}`)
    console.log(`Species offset: +0x${speciesOffset.toString(16)}, Level offset: +0x${levelOffset.toString(16)}`)
    
    const expectedParty = [
      { nickname: 'Steelix', speciesId: 208, level: 44 },
      { nickname: 'Breloom', speciesId: 286, level: 45 },
      { nickname: 'Snorlax', speciesId: 143, level: 47 },
      { nickname: 'Ludicolo', speciesId: 272, level: 45 },
      { nickname: 'Rayquaza', speciesId: 6, level: 41 },  
      { nickname: 'Sigilyph', speciesId: 561, level: 37 },
    ]
    
    // Try different Pokemon sizes
    const pokemonSizes = [104, 100, 80, 64, 48]
    
    for (const pokemonSize of pokemonSizes) {
      console.log(`\n📏 Testing with ${pokemonSize}-byte Pokemon structures:`)
      
      let matches = 0
      const foundPokemon: Array<{species: number, level: number}> = []
      
      for (let slot = 0; slot < 6; slot++) {
        const pokemonAddr = partyStart + (slot * pokemonSize)
        const expected = expectedParty[slot]!
        
        try {
          const species = await this.client.readWord(pokemonAddr + speciesOffset)
          const level = await this.client.readByte(pokemonAddr + levelOffset)
          
          foundPokemon.push({species, level})
          
          const isMatch = species === expected.speciesId && level === expected.level
          const status = isMatch ? '✅' : '❌'
          
          console.log(`  ${status} Slot ${slot}: Species ${species}, Level ${level} (Expected: ${expected.nickname} ${expected.speciesId} Lv${expected.level})`)
          
          if (isMatch) matches++
          
        } catch (error) {
          console.log(`  ❌ Slot ${slot}: Read error`)
          break
        }
      }
      
      console.log(`  Summary: ${matches}/6 perfect matches`)
      
      if (matches >= 4) {
        console.log(`\n  🏆 HIGH CONFIDENCE PARTY STRUCTURE FOUND!`)
        console.log(`  📝 Party Data Address: 0x${partyStart.toString(16)}`)
        console.log(`  📝 Pokemon Size: ${pokemonSize} bytes`)
        console.log(`  📝 Species Offset: +0x${speciesOffset.toString(16)}`)
        console.log(`  📝 Level Offset: +0x${levelOffset.toString(16)}`)
        
        // Look for party count
        await this.findPartyCount(partyStart)
        
        // Generate config
        await this.generateConfig(partyStart, pokemonSize, speciesOffset, levelOffset)
      }
    }
  }

  private async findPartyCount(partyAddr: number): Promise<void> {
    console.log(`\n🔍 Looking for party count near 0x${partyAddr.toString(16)}...`)
    
    const offsets = [-16, -12, -8, -4, -1, 0, 1, 4, 8, 12, 16]
    
    for (const offset of offsets) {
      const testAddr = partyAddr + offset
      
      try {
        const value = await this.client.readByte(testAddr)
        const status = value === 6 ? '✅' : '  '
        console.log(`${status} Offset ${offset}: 0x${testAddr.toString(16)} = ${value}`)
      } catch {
        console.log(`   Offset ${offset}: 0x${testAddr.toString(16)} = [unreadable]`)
      }
    }
  }

  private async generateConfig(partyAddr: number, pokemonSize: number, speciesOffset: number, levelOffset: number): Promise<void> {
    console.log('\n' + '='.repeat(80))
    console.log('🎯 QUETZAL MEMORY ADDRESSES DISCOVERED!')
    console.log('='.repeat(80))
    
    console.log('\nUpdate QuetzalConfig.memoryAddresses with:')
    console.log('')
    console.log('readonly memoryAddresses = {')
    console.log(`  partyData: 0x${partyAddr.toString(16).toLowerCase()},`)
    console.log(`  partyCount: 0x${(partyAddr - 4).toString(16).toLowerCase()}, // Check actual offset`)
    console.log('} as const')
    console.log('')
    console.log('And enable memory support:')
    console.log('')
    console.log('canHandleMemory(gameTitle: string): boolean {')
    console.log('  return gameTitle.toLowerCase().includes("quetzal") ||')
    console.log('         gameTitle.includes("QUETZAL")')
    console.log('}')
    console.log('')
    console.log('Structure details:')
    console.log(`- Pokemon size: ${pokemonSize} bytes`)
    console.log(`- Species offset: +0x${speciesOffset.toString(16)}`)
    console.log(`- Level offset: +0x${levelOffset.toString(16)}`)
    console.log('\n🎉 SUCCESS! Memory addresses found and validated!')
  }

  disconnect(): void {
    this.client.disconnect()
  }
}

async function main(): Promise<void> {
  const investigator = new RayquazaInvestigator()
  
  try {
    await investigator.connect()
    await investigator.investigateRayquaza()
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    investigator.disconnect()
  }
}

// Run the investigator
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}