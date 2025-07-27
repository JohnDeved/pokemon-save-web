#!/usr/bin/env node

/**
 * Simple connection test to troubleshoot WebSocket issues
 */

import { MgbaWebSocketClient } from './websocket-client'

async function simpleTest() {
  console.log('🔌 Simple WebSocket Connection Test')
  console.log('==================================\n')

  const client = new MgbaWebSocketClient()

  try {
    console.log('Connecting to mGBA WebSocket...')
    await client.connect()
    console.log('✅ Connected successfully!')

    console.log('\nTesting basic memory read...')
    const value = await client.readByte(0x02000000)
    console.log(`✅ Read byte: 0x${value.toString(16)}`)

    console.log('\nTesting dword read...')
    const dword = await client.readDWord(0x02000000)
    console.log(`✅ Read dword: 0x${dword.toString(16)}`)

    console.log('\n✅ All basic tests passed!')

  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    client.disconnect()
  }
}

simpleTest().catch(console.error)