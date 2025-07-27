import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read the emerald save file  
const emeraldSavePath = join(__dirname, 'src/lib/parser/__tests__/test_data/emerald.sav')
const emeraldGroundTruthPath = join(__dirname, 'src/lib/parser/__tests__/test_data/emerald_ground_truth.json')

try {
  const saveData = readFileSync(emeraldSavePath)
  const groundTruth = JSON.parse(readFileSync(emeraldGroundTruthPath, 'utf8'))
  
  console.log('✅ Files read successfully')
  console.log(`Save file size: ${saveData.length} bytes`)
  console.log('Ground truth data:')
  console.log(JSON.stringify(groundTruth, null, 2))
  
  // Look for specific patterns in the save file
  console.log('\n🔍 Analyzing save file patterns...')
  
  // Look for party count (should be 1)
  const partyCountOffset = 0x234
  const partyCount = saveData.readUInt32LE(partyCountOffset)
  console.log(`Party count at 0x${partyCountOffset.toString(16)}: ${partyCount}`)
  
  // Look for Pokemon data (should start at 0x238)
  const pokemonOffset = 0x238
  const personality = saveData.readUInt32LE(pokemonOffset)
  const otId = saveData.readUInt32LE(pokemonOffset + 4)
  
  console.log(`Pokemon personality at 0x${pokemonOffset.toString(16)}: 0x${personality.toString(16)}`)
  console.log(`Pokemon OT ID at 0x${(pokemonOffset + 4).toString(16)}: 0x${otId.toString(16)}`)
  
  // Look for player name
  console.log('\n🔍 Looking for player name...')
  
  // Player name is typically in SaveBlock2, which is in different sectors
  // Let's search for "EMERALD" pattern in Pokemon encoding
  const emeraldBytes = [0xBE, 0xC6, 0xBE, 0xCB, 0xBB, 0xC5, 0xBD] // E-M-E-R-A-L-D
  
  for (let i = 0; i < saveData.length - 7; i++) {
    let match = true
    for (let j = 0; j < emeraldBytes.length; j++) {
      if (saveData[i + j] !== emeraldBytes[j]) {
        match = false
        break
      }
    }
    if (match) {
      console.log(`Found "EMERALD" pattern at offset 0x${i.toString(16)}`)
      
      // Check if this looks like a player name area
      const nextByte = saveData[i + 7]
      if (nextByte === 0xFF || nextByte === 0x00) {
        console.log(`  Looks like player name! (terminated with 0x${nextByte.toString(16)})`)
      }
    }
  }
  
  // Search for party count = 1
  console.log('\n🔍 Looking for party count = 1...')
  for (let i = 0; i < saveData.length - 4; i++) {
    const count = saveData.readUInt32LE(i)
    if (count === 1) {
      console.log(`Found party count 1 at offset 0x${i.toString(16)}`)
      
      // Check if Pokemon data follows
      if (i + 8 < saveData.length) {
        const personality = saveData.readUInt32LE(i + 4)
        const otId = saveData.readUInt32LE(i + 8)
        
        if (personality !== 0 && otId !== 0) {
          console.log(`  Pokemon personality: 0x${personality.toString(16)}`)
          console.log(`  Pokemon OT ID: 0x${otId.toString(16)}`)
          
          // This might be our actual save data location
          console.log(`  🎯 Potential save data found! Offset: 0x${(i - 0x234).toString(16)}`)
        }
      }
    }
  }
  
  // Search for the specific personality value we know
  const targetPersonality = 0x6ccbfd84 // From ground truth if it exists
  console.log(`\n🔍 Looking for known personality 0x${targetPersonality.toString(16)}...`)
  
  for (let i = 0; i < saveData.length - 4; i++) {
    const personality = saveData.readUInt32LE(i)
    if (personality === targetPersonality) {
      console.log(`Found target personality at offset 0x${i.toString(16)}`)
      
      // This should be the start of a Pokemon struct
      const otId = saveData.readUInt32LE(i + 4)
      console.log(`  OT ID: 0x${otId.toString(16)}`)
      
      // Calculate where party count should be (4 bytes before Pokemon data)
      const partyCountOffset = i - 4
      if (partyCountOffset >= 0) {
        const partyCount = saveData.readUInt32LE(partyCountOffset)
        console.log(`  Party count at 0x${partyCountOffset.toString(16)}: ${partyCount}`)
        
        if (partyCount === 1) {
          console.log(`  🎯 MATCH! Save data structure found`)
          console.log(`  SaveBlock1 equivalent offset: 0x${(partyCountOffset - 0x234).toString(16)}`)
        }
      }
    }
  }
  
} catch (error) {
  console.error('❌ Error:', error)
}