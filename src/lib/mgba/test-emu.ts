#!/usr/bin/env node

/**
 * Test direct emu access and find the right approach
 */

import { MgbaWebSocketClient } from './websocket-client'

async function testEmuAccess() {
  console.log('🧪 Testing mGBA emu object access')
  console.log('===================================\n')

  try {
    const client = new MgbaWebSocketClient()
    await client.connect()
    console.log('✅ Connected to mGBA\n')

    await new Promise(resolve => setTimeout(resolve, 3000))

    // Test various ways to access the emu object
    console.log('🔍 Testing emu object access...')
    
    const tests = [
      'emu',
      'type(emu)',
      'emu and "exists" or "nil"',
      '_G.emu',
      'type(_G.emu)',
      'mgba',
      'type(mgba)',
      'core',
      'type(core)',
      'rawget(_G, "emu")',
      'debug.getregistry()',
      'for k,v in pairs(_G) do if k:match("emu") or k:match("mgba") or k:match("core") then return k.."="..type(v) end end'
    ]

    for (const test of tests) {
      try {
        const response = await client.eval(test)
        console.log(`${test}: ${JSON.stringify(response.result)}`)
      } catch (error) {
        console.log(`${test}: ERROR - ${error}`)
      }
    }

    // Try to find what global variables are available
    console.log('\n🔍 Listing all global variables...')
    try {
      const response = await client.eval(`
        local globals = {}
        for k, v in pairs(_G) do
          table.insert(globals, k .. "=" .. type(v))
        end
        table.sort(globals)
        return table.concat(globals, ", ")
      `)
      console.log(`Globals: ${response.result}`)
    } catch (error) {
      console.log(`Error listing globals: ${error}`)
    }

    // If we can't find emu, maybe we need to check what functions are available for memory access
    console.log('\n🔍 Testing basic Lua capabilities...')
    try {
      const response = await client.eval('return "Lua is working"')
      console.log(`Basic Lua: ${response.result}`)
    } catch (error) {
      console.log(`Basic Lua error: ${error}`)
    }

    client.disconnect()

  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testEmuAccess().catch(console.error)
}

export { testEmuAccess }