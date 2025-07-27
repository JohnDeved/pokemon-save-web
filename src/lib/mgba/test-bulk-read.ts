#!/usr/bin/env -S npx tsx
/**
 * Test simple bulk reading approaches to find what works
 */

import { MgbaWebSocketClient } from './websocket-client'

async function main() {
  console.log('🧪 Testing various bulk read approaches...\n')
  
  const client = new MgbaWebSocketClient()
  await client.connect()
  
  console.log('✅ Connected to mGBA')
  
  // Test 1: Simple array construction without local
  console.log('\n🧪 Test 1: Simple array construction')
  try {
    const result = await client.eval('{emu:read8(0x20244e9), emu:read8(0x20244ea)}')
    console.log('✅ Success:', result.result)
  } catch (error) {
    console.log('❌ Failed:', error)
  }
  
  // Test 2: Loop with return statement
  console.log('\n🧪 Test 2: Simple loop')
  try {
    const result = await client.eval('(function() local r = {} for i = 0, 4 do r[i+1] = emu:read8(0x20244e9 + i) end return r end)()')
    console.log('✅ Success:', result.result)
  } catch (error) {
    console.log('❌ Failed:', error)
  }
  
  // Test 3: Do block
  console.log('\n🧪 Test 3: Do block')
  try {
    const result = await client.eval('do local r = {} for i = 0, 4 do r[i+1] = emu:read8(0x20244e9 + i) end return r end')
    console.log('✅ Success:', result.result)
  } catch (error) {
    console.log('❌ Failed:', error)
  }
  
  // Test 4: Global variable approach
  console.log('\n🧪 Test 4: Global variable')
  try {
    await client.eval('r = {}')
    await client.eval('for i = 0, 4 do r[i+1] = emu:read8(0x20244e9 + i) end')
    const result = await client.eval('return r')
    console.log('✅ Success:', result.result)
  } catch (error) {
    console.log('❌ Failed:', error)
  }
  
  client.disconnect()
  console.log('\n✅ Bulk read tests completed!')
}

main().catch(console.error)