#!/usr/bin/env npx tsx
/**
 * Tool to use mGBA Lua API to load save file and create savestate
 */

import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client'

async function main() {
  const client = new MgbaWebSocketClient('ws://localhost:7102/ws')
  
  console.log('🔌 Connecting to mGBA WebSocket...')
  await client.connect()
  
  const gameTitle = await client.getGameTitle()
  console.log(`🎮 Connected to: "${gameTitle}"`)
  
  console.log('\n💾 Attempting to create savestate with Quetzal team...')
  
  try {
    // Try to save current state to create a savestate
    const saveStateResult = await client.eval('emu:saveStateFile("/app/roms/quetzal.ss0", C.SAVESTATE.SCREENSHOT)')
    console.log('Savestate creation result:', saveStateResult)
    
    // Try to check if we can access save data
    const saveDataCheck = await client.eval(`
      -- Try to read from SRAM or check save data
      local sramBase = 0x0E000000
      local result = {}
      for i = 0, 10 do
        result[i+1] = emu:read8(sramBase + i)
      end
      return result
    `)
    
    console.log('SRAM data (first 11 bytes):', saveDataCheck)
    
  } catch (error) {
    console.log('Error working with save data:', error)
  }
  
  client.disconnect()
  console.log('\n✅ Done')
}

main().catch(console.error)