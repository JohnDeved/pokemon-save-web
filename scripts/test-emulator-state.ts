#!/usr/bin/env tsx
/**
 * Simple test to verify emulator state and basic memory reading
 */

import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client.js'

class EmulatorStateTest {
  private client: MgbaWebSocketClient

  constructor() {
    this.client = new MgbaWebSocketClient()
  }

  async connect(): Promise<void> {
    console.log('🔌 Connecting to mGBA WebSocket...')
    await this.client.connect()
    console.log('✅ Connected!')
  }

  async testBasicFunction(): Promise<void> {
    console.log('\n🧪 Testing basic WebSocket functionality...')
    
    try {
      // Test game title
      const title = await this.client.getGameTitle()
      console.log(`📜 Game title: "${title}"`)
      
      // Test simple memory reads
      console.log('\n🔍 Testing memory reads:')
      
      // Test reading from start of EWRAM  
      const addr1 = 0x02000000
      const val1 = await this.client.readByte(addr1)
      console.log(`0x${addr1.toString(16)}: 0x${val1.toString(16).padStart(2, '0')}`)
      
      // Test reading from typical save data region
      const addr2 = 0x02020000
      const val2 = await this.client.readByte(addr2)
      console.log(`0x${addr2.toString(16)}: 0x${val2.toString(16).padStart(2, '0')}`)
      
      // Test reading a few words
      console.log('\n🔢 Testing word reads:')
      const word1 = await this.client.readWord(0x02000000)
      const word2 = await this.client.readWord(0x02020000)
      console.log(`0x02000000 (word): 0x${word1.toString(16).padStart(4, '0')}`)
      console.log(`0x02020000 (word): 0x${word2.toString(16).padStart(4, '0')}`)
      
      // Test reading larger chunk
      console.log('\n📦 Testing bulk read:')
      const chunk = await this.client.readBytes(0x02000000, 16)
      console.log(`0x02000000 (16 bytes): ${Array.from(chunk).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
      
    } catch (error) {
      console.error('❌ Error in basic tests:', error)
    }
  }

  async checkSavestateLoad(): Promise<void> {
    console.log('\n💾 Checking if savestate is properly loaded...')
    
    try {
      // The savestate should have loaded our team. Let's check if we can execute Lua to verify
      const luaTest = await this.client.eval('return "Lua is working"')
      console.log(`🔧 Lua test: ${luaTest.result}`)
      
      // Check if save data looks reasonable by sampling various addresses
      console.log('\n🔍 Sampling memory for save data patterns...')
      
      const addresses = [
        0x02000000, 0x02001000, 0x02002000, 0x02003000,
        0x02020000, 0x02021000, 0x02022000, 0x02023000,
        0x02024000, 0x02025000, 0x02026000, 0x02027000,
        0x02028000, 0x02029000, 0x0202a000, 0x0202b000,
      ]
      
      for (const addr of addresses) {
        try {
          const data = await this.client.readBytes(addr, 8)
          const hex = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ')
          const nonZero = data.some(b => b !== 0)
          const indicator = nonZero ? '🟢' : '⚫'
          console.log(`${indicator} 0x${addr.toString(16)}: ${hex}`)
        } catch {
          console.log(`❌ 0x${addr.toString(16)}: unreadable`)
        }
      }
      
    } catch (error) {
      console.error('❌ Error checking savestate:', error)
    }
  }

  async manualPartySearch(): Promise<void> {
    console.log('\n🎯 Manual search for party data using known values...')
    
    // We know from ground truth the exact values to look for
    const searchTargets = [
      { name: 'Steelix species (208)', value: 208, type: 'word' },
      { name: 'Breloom species (286)', value: 286, type: 'word' },
      { name: 'Snorlax species (143)', value: 143, type: 'word' },
      { name: 'Rayquaza species (6)', value: 6, type: 'word' },
      { name: 'Sigilyph species (561)', value: 561, type: 'word' },
      { name: 'Steelix level (44)', value: 44, type: 'byte' },
      { name: 'Breloom level (45)', value: 45, type: 'byte' },
      { name: 'Snorlax level (47)', value: 47, type: 'byte' },
      { name: 'Party count (6)', value: 6, type: 'byte' },
    ]
    
    for (const target of searchTargets) {
      console.log(`\n🔍 Searching for ${target.name}...`)
      
      const found = await this.searchMemoryForValue(target.value, target.type)
      console.log(`Found ${found.length} occurrences`)
      
      // Show first 10 locations
      for (let i = 0; i < Math.min(found.length, 10); i++) {
        console.log(`  0x${found[i]!.toString(16)}`)
      }
      
      if (found.length > 10) {
        console.log(`  ... and ${found.length - 10} more`)
      }
    }
  }

  private async searchMemoryForValue(value: number, type: 'byte' | 'word'): Promise<number[]> {
    const found: number[] = []
    const EWRAM_START = 0x02000000
    const EWRAM_SIZE = 0x8000  // Search smaller region first
    const CHUNK_SIZE = 1024
    
    for (let offset = 0; offset < EWRAM_SIZE; offset += CHUNK_SIZE) {
      const addr = EWRAM_START + offset
      const chunkSize = Math.min(CHUNK_SIZE, EWRAM_SIZE - offset)
      
      try {
        const chunk = await this.client.readBytes(addr, chunkSize)
        
        if (type === 'byte') {
          for (let i = 0; i < chunk.length; i++) {
            if (chunk[i] === value) {
              found.push(addr + i)
            }
          }
        } else if (type === 'word') {
          for (let i = 0; i <= chunk.length - 2; i += 2) {
            const word = chunk[i]! | (chunk[i + 1]! << 8)
            if (word === value) {
              found.push(addr + i)
            }
          }
        }
      } catch {
        continue
      }
    }
    
    return found
  }

  disconnect(): void {
    this.client.disconnect()
  }
}

async function main(): Promise<void> {
  const tester = new EmulatorStateTest()
  
  try {
    await tester.connect()
    await tester.testBasicFunction()
    await tester.checkSavestateLoad()
    await tester.manualPartySearch()
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    tester.disconnect()
  }
}

// Run the tester
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}