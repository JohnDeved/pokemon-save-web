#!/usr/bin/env node

/**
 * Script to find pointers to party data in Quetzal ROM hack using HTTP API
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
      res.on('data', (chunk) => body += chunk)
      res.on('end', () => {
        try {
          const result = JSON.parse(body)
          resolve(result)
        } catch (e) {
          resolve(body)
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
  const result = await httpRequest('/eval', {
    lua: `return emu:read8(${address})`
  })
  return result.result
}

async function readBytes(address, length) {
  const result = await httpRequest('/eval', {
    lua: `
      local data = {}
      for i = 0, ${length - 1} do
        data[i + 1] = emu:read8(${address} + i)
      end
      return data
    `
  })
  return new Uint8Array(result.result)
}

async function readU32(address) {
  const result = await httpRequest('/eval', {
    lua: `return emu:read32(${address})`
  })
  return result.result
}

async function loadSavestate(filename) {
  console.log(`🔄 Loading savestate: ${filename}`)
  const result = await httpRequest('/eval', {
    lua: `return emu:loadStateFile("/app/data/${filename}", C.SAVESTATE.SCREENSHOT)`
  })
  if (!result.result) {
    throw new Error(`Failed to load savestate ${filename}`)
  }
  // Wait for load to complete
  await new Promise(resolve => setTimeout(resolve, 3000))
}

function validateQuetzalPokemon(data, offset) {
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

async function findPartyData() {
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
        const partyCount = await readByte(addr)
        
        if (partyCount >= 1 && partyCount <= 6) {
          const partyDataAddr = addr + 4
          const partyData = await readBytes(partyDataAddr, partyCount * 104)
          
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
              partyCount
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

async function findPointersTo(targetAddress) {
  console.log(`🔍 Scanning for pointers to 0x${targetAddress.toString(16)}...`)
  
  const pointers = []
  
  // Scan likely pointer regions 
  const scanRegions = [
    { start: 0x2020000, end: 0x2030000, name: 'EWRAM' },
    { start: 0x3000000, end: 0x3008000, name: 'IWRAM' },
  ]

  for (const region of scanRegions) {
    console.log(`  Scanning ${region.name}: 0x${region.start.toString(16)} - 0x${region.end.toString(16)}`)
    
    for (let addr = region.start; addr < region.end; addr += 4) {
      try {
        const value = await readU32(addr)
        
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

async function main() {
  try {
    console.log('🔌 Connecting to mGBA HTTP API...')
    
    // Test connection
    const status = await httpRequest('/')
    console.log('✅ Connected:', status)
    
    // Analysis for quetzal.ss0
    console.log('\n=== ANALYZING quetzal.ss0 ===')
    await loadSavestate('quetzal.ss0')
    
    const result1 = await findPartyData()
    let pointers1 = []
    
    if (result1) {
      pointers1 = await findPointersTo(result1.address)
      console.log(`Found ${pointers1.length} potential pointers in quetzal.ss0`)
    }
    
    // Analysis for quetzal2.ss0
    console.log('\n=== ANALYZING quetzal2.ss0 ===')
    await loadSavestate('quetzal2.ss0')
    
    const result2 = await findPartyData()
    let pointers2 = []
    
    if (result2) {
      pointers2 = await findPointersTo(result2.address)
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
          await loadSavestate('quetzal.ss0')
          const value1 = await readU32(pointer)
          
          await loadSavestate('quetzal2.ss0') 
          const value2 = await readU32(pointer)
          
          console.log(`     quetzal.ss0:  0x${pointer.toString(16)} -> 0x${value1.toString(16)}`)
          console.log(`     quetzal2.ss0: 0x${pointer.toString(16)} -> 0x${value2.toString(16)}`)
          
          // This would be our solution!
          console.log(`\n🎉 SOLUTION FOUND!`)
          console.log(`   Use pointer at 0x${pointer.toString(16)} to get dynamic party address`)
          console.log(`   PartyCount = [pointer] - 4`)
          console.log(`   PartyData = [pointer]`)
        }
      } else {
        console.log('\n❌ No consistent pointer locations found')
        console.log('   Looking for address patterns instead...')
        
        // Look for base address patterns
        const offset = result2.address - result1.address
        console.log(`   Address offset between savestates: ${offset} bytes (0x${offset.toString(16)})`)
        
        // Check if this offset appears elsewhere in memory
        console.log('   Checking for consistent base addresses...')
        
        // Look at some key areas that might contain base pointers
        const candidateAddresses = [
          0x3000000, 0x3000004, 0x3000008, 0x300000c, // IWRAM start
          0x2020000, 0x2020004, 0x2020008, 0x202000c, // EWRAM start
        ]
        
        for (const addr of candidateAddresses) {
          try {
            await loadSavestate('quetzal.ss0')
            const value1 = await readU32(addr)
            
            await loadSavestate('quetzal2.ss0')
            const value2 = await readU32(addr)
            
            if (value1 !== value2 && (value2 - value1) === offset) {
              console.log(`   🎯 Found base address pattern at 0x${addr.toString(16)}:`)
              console.log(`     quetzal.ss0:  0x${value1.toString(16)}`)
              console.log(`     quetzal2.ss0: 0x${value2.toString(16)}`)
              console.log(`     Offset: ${value2 - value1} (matches party offset!)`)
            }
          } catch (e) {
            // Skip invalid addresses
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

main().catch(console.error);