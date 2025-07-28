#!/usr/bin/env node

/**
 * Script to find a consistent way to locate party data in Quetzal ROM hack using WebSocket API
 * 
 * User confirmed addresses:
 * - quetzal.ss0: Party data at 0x2024a14  
 * - quetzal2.ss0: Party data at 0x2024a58 (68 bytes later)
 * 
 * Goal: Find a consistent method to locate these addresses without knowing the data beforehand
 */

const WebSocket = require('ws')

class SimpleWebSocketClient {
  constructor() {
    this.ws = null
    this.connected = false
    this.messageHandlers = new Map()
    this.nextId = 1
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('ws://localhost:7102/ws')
      
      this.ws.on('open', () => {
        this.connected = true
        console.log('✅ Connected to mGBA WebSocket')
        resolve()
      })
      
      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error)
        reject(error)
      })
      
      this.ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString())
          if (this.pendingResolver) {
            this.pendingResolver(response)
            this.pendingResolver = null
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      })
    })
  }

  async eval(code) {
    if (!this.connected) {
      throw new Error('Not connected to WebSocket')
    }
    
    return new Promise((resolve, reject) => {
      this.pendingResolver = resolve
      this.ws.send(code)
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingResolver === resolve) {
          this.pendingResolver = null
          reject(new Error('WebSocket eval timeout'))
        }
      }, 10000)
    })
  }

  async readByte(address) {
    const response = await this.eval(`emu:read8(${address})`)
    if (response.error) {
      throw new Error(response.error)
    }
    return response.result
  }

  async readBytes(address, count) {
    const bytes = []
    
    // Read in chunks to avoid overwhelming the connection
    const chunkSize = 50
    for (let offset = 0; offset < count; offset += chunkSize) {
      const currentChunk = Math.min(chunkSize, count - offset)
      const chunkPromises = []
      
      for (let i = 0; i < currentChunk; i++) {
        chunkPromises.push(this.readByte(address + offset + i))
      }
      
      const chunkBytes = await Promise.all(chunkPromises)
      bytes.push(...chunkBytes)
    }
    
    return new Uint8Array(bytes)
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.connected = false
    }
  }
}

async function loadSavestate(client, filename) {
  console.log(`🔄 Loading savestate: ${filename}`)
  const response = await client.eval(`emu:loadStateFile("/app/data/${filename}", 0)`)
  if (response.error) {
    throw new Error(`Failed to load savestate ${filename}: ${response.error}`)
  }
  // Wait for load to stabilize
  await new Promise(resolve => setTimeout(resolve, 3000))
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

async function scanMemoryForPartySignatures(client, targetAddress, scanName) {
  console.log(`🔍 Scanning memory for party signatures (${scanName})...`)
  
  const signatures = []
  
  try {
    // Get the target party count for reference
    const targetPartyCount = await client.readByte(targetAddress - 4)
    console.log(`   Target party count: ${targetPartyCount}`)
    
    // Scan EWRAM region for party count + valid Pokemon data patterns
    const scanStart = 0x2020000
    const scanEnd = 0x2030000
    const scanStep = 4
    
    console.log(`   Scanning 0x${scanStart.toString(16)} - 0x${scanEnd.toString(16)} (step: ${scanStep})`)
    
    let foundCount = 0
    const maxCandidates = 10
    
    for (let addr = scanStart; addr < scanEnd; addr += scanStep) {
      try {
        const partyCount = await client.readByte(addr)
        
        if (partyCount >= 1 && partyCount <= 6) {
          const partyDataAddr = addr + 4
          
          // Quick validation: check first Pokemon
          const firstPokemonData = await client.readBytes(partyDataAddr, 104)
          const view = new DataView(firstPokemonData.buffer)
          
          const species = view.getUint16(0x28, true)
          const level = view.getUint8(0x58)
          const currentHp = view.getUint16(0x23, true)
          const maxHp = view.getUint16(0x5A, true)
          
          // Basic Pokemon validation
          if (level >= 1 && level <= 100 && species > 0 && currentHp <= maxHp && maxHp > 0) {
            foundCount++
            const isTarget = (partyDataAddr === targetAddress)
            
            signatures.push({
              countAddr: addr,
              dataAddr: partyDataAddr,
              partyCount,
              isTarget,
              species,
              level,
              hp: `${currentHp}/${maxHp}`
            })
            
            console.log(`     ${isTarget ? '🎯' : '📍'} Found at 0x${addr.toString(16)} -> 0x${partyDataAddr.toString(16)} (Count: ${partyCount}, Lv${level} #${species}, HP: ${currentHp}/${maxHp})`)
            
            if (foundCount >= maxCandidates) {
              console.log(`   ... (stopping at ${maxCandidates} candidates to avoid timeout)`)
              break
            }
          }
        }
      } catch (e) {
        // Skip invalid addresses
      }
    }
    
    console.log(`   Total signatures found: ${foundCount}`)
    return signatures
    
  } catch (error) {
    console.log(`   ❌ Error scanning signatures: ${error}`)
    return []
  }
}

async function analyzeMemoryStructure(client, address, name) {
  console.log(`🔍 Analyzing memory structure at 0x${address.toString(16)} (${name})...`)
  
  try {
    // Read context around the address
    const contextSize = 64
    const startAddr = address - contextSize
    const data = await client.readBytes(startAddr, contextSize * 2)
    
    console.log(`   Memory dump around party data:`)
    
    // Print hex dump in 16-byte lines
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

async function main() {
  const client = new SimpleWebSocketClient()
  
  try {
    console.log('🔌 Connecting to mGBA WebSocket...')
    await client.connect()
    
    // Test connection
    const testResponse = await client.eval('"Hello from mGBA"')
    if (testResponse.result !== "Hello from mGBA") {
      throw new Error('WebSocket test failed')
    }
    
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
    
    // Look for all party signatures in memory
    const signatures1 = await scanMemoryForPartySignatures(client, quetzal1PartyAddress, 'quetzal.ss0')
    
    console.log('\n=== ANALYZING QUETZAL2.SS0 ===')
    await loadSavestate(client, 'quetzal2.ss0')
    
    // Analyze memory structure
    await analyzeMemoryStructure(client, quetzal2PartyAddress, 'quetzal2.ss0')
    
    // Look for all party signatures in memory
    const signatures2 = await scanMemoryForPartySignatures(client, quetzal2PartyAddress, 'quetzal2.ss0')
    
    console.log('\n=== CROSS-ANALYSIS ===')
    
    // Find the target signatures
    const targetSig1 = signatures1.find(s => s.isTarget)
    const targetSig2 = signatures2.find(s => s.isTarget)
    
    console.log('🎯 TARGET SIGNATURES:')
    if (targetSig1) {
      console.log(`   quetzal.ss0:  Count at 0x${targetSig1.countAddr.toString(16)}, Data at 0x${targetSig1.dataAddr.toString(16)} (${targetSig1.partyCount} Pokemon)`)
    }
    if (targetSig2) {
      console.log(`   quetzal2.ss0: Count at 0x${targetSig2.countAddr.toString(16)}, Data at 0x${targetSig2.dataAddr.toString(16)} (${targetSig2.partyCount} Pokemon)`)
    }
    
    // Count non-target signatures
    const otherSig1 = signatures1.filter(s => !s.isTarget)
    const otherSig2 = signatures2.filter(s => !s.isTarget)
    
    console.log('\n📊 SIGNATURE ANALYSIS:')
    console.log(`   quetzal.ss0:  ${signatures1.length} total signatures (${otherSig1.length} false positives)`)
    console.log(`   quetzal2.ss0: ${signatures2.length} total signatures (${otherSig2.length} false positives)`)
    
    if (otherSig1.length === 0 && otherSig2.length === 0) {
      console.log('   ✅ UNIQUE SIGNATURES: No false positives found!')
    } else {
      console.log('   ⚠️  FALSE POSITIVES DETECTED - additional validation needed')
      
      if (otherSig1.length > 0) {
        console.log('   Other signatures in quetzal.ss0:')
        for (const sig of otherSig1) {
          console.log(`     - 0x${sig.dataAddr.toString(16)} (Count: ${sig.partyCount}, Lv${sig.level} #${sig.species})`)
        }
      }
      
      if (otherSig2.length > 0) {
        console.log('   Other signatures in quetzal2.ss0:')
        for (const sig of otherSig2) {
          console.log(`     - 0x${sig.dataAddr.toString(16)} (Count: ${sig.partyCount}, Lv${sig.level} #${sig.species})`)
        }
      }
    }
    
    console.log('\n=== RECOMMENDATIONS ===')
    
    if (signatures1.length === 1 && signatures2.length === 1) {
      console.log('✅ OPTIMAL SOLUTION FOUND!')
      console.log('💡 Implementation: Scan EWRAM for party count (1-6) + validate Pokemon structure')
      console.log('   - This method produces unique results with no false positives')
      console.log('   - Can reliably locate party data without knowing the contents')
    } else if (signatures1.length > 1 || signatures2.length > 1) {
      console.log('⚠️  PARTIAL SOLUTION - ADDITIONAL VALIDATION NEEDED')
      console.log('💡 Recommended enhancements:')
      console.log('   1. Validate multiple Pokemon in the party, not just the first')
      console.log('   2. Check for specific Pokemon-related memory patterns')
      console.log('   3. Cross-reference with save file data for confirmation')
      console.log('   4. Use heuristic scoring to rank candidates')
    } else {
      console.log('❌ NO RELIABLE PATTERN FOUND')
      console.log('💡 Alternative approaches needed')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    client.disconnect()
  }
}

if (require.main === module) {
  main().catch(console.error)
}