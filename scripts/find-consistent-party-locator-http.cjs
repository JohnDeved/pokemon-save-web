#!/usr/bin/env node

/**
 * Script to find a consistent way to locate party data in Quetzal ROM hack using HTTP API
 * 
 * User confirmed addresses:
 * - quetzal.ss0: Party data at 0x2024a14  
 * - quetzal2.ss0: Party data at 0x2024a58 (68 bytes later)
 * 
 * Goal: Find a consistent method to locate these addresses without knowing the data beforehand
 */

const http = require('http')

async function httpRequest(path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 7102,
      path: path,
      method: data ? 'POST' : 'GET',
      headers: data ? { 'Content-Type': 'application/json' } : {}
    }

    const req = http.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try {
          const result = JSON.parse(body)
          resolve(result)
        } catch (e) {
          resolve({ result: body })
        }
      })
    })

    req.on('error', reject)
    
    if (data) {
      req.write(JSON.stringify(data))
    }
    
    req.end()
  })
}

async function readByte(address) {
  const response = await httpRequest('/eval', { lua: `return emu:read8(${address})` })
  return response.result
}

async function readBytes(address, count) {
  const bytes = []
  for (let i = 0; i < count; i++) {
    const byte = await readByte(address + i)
    bytes.push(byte)
  }
  return new Uint8Array(bytes)
}

async function loadSavestate(filename) {
  console.log(`🔄 Loading savestate: ${filename}`)
  const response = await httpRequest('/eval', { lua: `return emu:loadStateFile("/app/data/${filename}", C.SAVESTATE.SCREENSHOT)` })
  if (response.error) {
    throw new Error(`Failed to load savestate ${filename}: ${response.error}`)
  }
  // Wait for load to stabilize
  await new Promise(resolve => setTimeout(resolve, 3000))
}

async function verifyUserClaimedAddress(address, description) {
  console.log(`🔍 Verifying ${description} at 0x${address.toString(16)}...`)
  
  try {
    // Read party count (should be 1-6)
    const partyCount = await readByte(address - 4) // Party count typically 4 bytes before party data
    console.log(`   Party count: ${partyCount}`)
    
    if (partyCount < 1 || partyCount > 6) {
      console.log(`   ❌ Invalid party count: ${partyCount}`)
      return false
    }
    
    // Read first Pokemon data (104 bytes)
    const pokemonData = await readBytes(address, 104)
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

async function scanForPointers(targetAddress, scanName) {
  console.log(`🔍 Scanning for pointers to 0x${targetAddress.toString(16)} (${scanName})...`)
  
  const candidates = []
  
  // Define scan regions
  const regions = [
    { start: 0x2020000, end: 0x2024000, name: 'EWRAM Low' },
    { start: 0x2024000, end: 0x2028000, name: 'EWRAM Mid' },
    { start: 0x2028000, end: 0x202C000, name: 'EWRAM High' },
    { start: 0x3000000, end: 0x3004000, name: 'IWRAM' },
  ]
  
  for (const region of regions) {
    console.log(`   Scanning ${region.name}: 0x${region.start.toString(16)} - 0x${region.end.toString(16)}`)
    
    for (let addr = region.start; addr < region.end; addr += 4) {
      try {
        const bytes = await readBytes(addr, 4)
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
        // Skip invalid addresses, but don't spam errors
      }
    }
  }
  
  return candidates
}

async function analyzeMemoryStructure(address, name) {
  console.log(`🔍 Analyzing memory structure at 0x${address.toString(16)} (${name})...`)
  
  try {
    // Read larger context around the address
    const contextSize = 64
    const startAddr = address - contextSize
    const data = await readBytes(startAddr, contextSize * 2)
    
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

async function scanForSignatureBytes(targetAddress, scanName) {
  console.log(`🔍 Scanning for signature bytes that could lead to ${scanName}...`)
  
  const signatures = []
  
  try {
    // Read the party count at this address (should be reliable)
    const partyCount = await readByte(targetAddress - 4)
    console.log(`   Party count at this address: ${partyCount}`)
    
    // Now scan memory for locations that have this party count followed by valid Pokemon data
    const searchRegions = [
      { start: 0x2020000, end: 0x2030000, name: 'EWRAM' },
    ]
    
    let foundCount = 0
    
    for (const region of searchRegions) {
      console.log(`   Scanning ${region.name} for party count ${partyCount} + Pokemon data...`)
      
      for (let addr = region.start; addr < region.end; addr += 4) {
        try {
          const countByte = await readByte(addr)
          
          if (countByte === partyCount) {
            // Found a matching party count, check if valid Pokemon data follows
            const pokemonAddr = addr + 4
            const firstPokemon = await readBytes(pokemonAddr, 104)
            const view = new DataView(firstPokemon.buffer)
            
            const species = view.getUint16(0x28, true)
            const level = view.getUint8(0x58)
            
            if (level >= 1 && level <= 100 && species > 0) {
              foundCount++
              const isTarget = (pokemonAddr === targetAddress)
              
              signatures.push({
                countAddr: addr,
                dataAddr: pokemonAddr,
                isTarget,
                species,
                level
              })
              
              console.log(`     ${isTarget ? '🎯' : '📍'} Found count ${partyCount} at 0x${addr.toString(16)} -> data at 0x${pokemonAddr.toString(16)} (Species: ${species}, Level: ${level})`)
              
              if (foundCount >= 10) break // Limit results
            }
          }
        } catch (e) {
          // Skip invalid addresses
        }
      }
    }
    
    console.log(`   Total candidates found: ${foundCount}`)
    return signatures
    
  } catch (error) {
    console.log(`   ❌ Error scanning signatures: ${error}`)
    return []
  }
}

async function main() {
  try {
    console.log('🔌 Connecting to mGBA HTTP API...')
    
    // Test connection
    const testResponse = await httpRequest('/eval', { lua: 'return "Hello from mGBA"' })
    if (testResponse.result !== "Hello from mGBA") {
      throw new Error('Failed to connect to mGBA HTTP API')
    }
    console.log('✅ Connected to mGBA HTTP API')
    
    // User confirmed addresses
    const quetzal1PartyAddress = 0x2024a14
    const quetzal2PartyAddress = 0x2024a58
    
    console.log('\n=== VERIFYING USER CONFIRMED ADDRESSES ===')
    
    // Verify quetzal.ss0 address
    await loadSavestate('quetzal.ss0')
    const valid1 = await verifyUserClaimedAddress(quetzal1PartyAddress, 'quetzal.ss0 party data')
    
    // Verify quetzal2.ss0 address
    await loadSavestate('quetzal2.ss0')
    const valid2 = await verifyUserClaimedAddress(quetzal2PartyAddress, 'quetzal2.ss0 party data')
    
    if (!valid1 || !valid2) {
      console.log('❌ Could not verify user claimed addresses - stopping analysis')
      return
    }
    
    console.log('\n✅ User claimed addresses verified successfully!')
    console.log(`Address difference: ${quetzal2PartyAddress - quetzal1PartyAddress} bytes (0x${(quetzal2PartyAddress - quetzal1PartyAddress).toString(16)})`)
    
    console.log('\n=== ANALYZING QUETZAL.SS0 ===')
    await loadSavestate('quetzal.ss0')
    
    // Analyze memory structure
    await analyzeMemoryStructure(quetzal1PartyAddress, 'quetzal.ss0')
    
    // Look for signature bytes
    const signatures1 = await scanForSignatureBytes(quetzal1PartyAddress, 'quetzal.ss0')
    
    // Look for pointers (limited scan to avoid timeout)
    const pointers1 = await scanForPointers(quetzal1PartyAddress, 'quetzal.ss0')
    
    console.log('\n=== ANALYZING QUETZAL2.SS0 ===')
    await loadSavestate('quetzal2.ss0')
    
    // Analyze memory structure
    await analyzeMemoryStructure(quetzal2PartyAddress, 'quetzal2.ss0')
    
    // Look for signature bytes
    const signatures2 = await scanForSignatureBytes(quetzal2PartyAddress, 'quetzal2.ss0')
    
    // Look for pointers (limited scan to avoid timeout)
    const pointers2 = await scanForPointers(quetzal2PartyAddress, 'quetzal2.ss0')
    
    console.log('\n=== CROSS-ANALYSIS ===')
    
    // Find common pointer locations
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
    
    // Analyze signature patterns
    const targetSig1 = signatures1.find(s => s.isTarget)
    const targetSig2 = signatures2.find(s => s.isTarget)
    
    if (targetSig1 && targetSig2) {
      console.log('\n🔍 SIGNATURE ANALYSIS:')
      console.log(`quetzal.ss0:  party count at 0x${targetSig1.countAddr.toString(16)}, data at 0x${targetSig1.dataAddr.toString(16)}`)
      console.log(`quetzal2.ss0: party count at 0x${targetSig2.countAddr.toString(16)}, data at 0x${targetSig2.dataAddr.toString(16)}`)
      
      // Check if there are any other candidates with the same party count
      const otherCandidates1 = signatures1.filter(s => !s.isTarget)
      const otherCandidates2 = signatures2.filter(s => !s.isTarget)
      
      console.log(`Other candidates in quetzal.ss0: ${otherCandidates1.length}`)
      console.log(`Other candidates in quetzal2.ss0: ${otherCandidates2.length}`)
      
      if (otherCandidates1.length === 0 && otherCandidates2.length === 0) {
        console.log('✅ Unique signature found: Party count + Pokemon validation is sufficient')
      } else {
        console.log('⚠️  Multiple candidates found - need additional validation')
      }
    }
    
    console.log('\n=== RECOMMENDATIONS ===')
    if (commonPointerAddresses.length > 0) {
      console.log('✅ Found consistent pointer addresses - these could be used for reliable party data location')
    } else if (signatures1.length === 1 && signatures2.length === 1) {
      console.log('✅ Found unique signature pattern - scanning for party count + Pokemon validation should work')
      console.log('💡 Implementation: Scan EWRAM for party count (1-6), then validate Pokemon structure at +4 offset')
    } else {
      console.log('❌ No reliable consistent patterns found')
      console.log('💡 Alternative approaches:')
      console.log('   1. Implement heuristic-based scanning with multiple validation checks')
      console.log('   2. Use save file analysis to provide hints to memory scanning')
      console.log('   3. Look for game-specific memory allocation patterns')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

if (require.main === module) {
  main().catch(console.error)
}