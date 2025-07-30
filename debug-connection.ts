#!/usr/bin/env tsx

import { MgbaWebSocketClient } from './src/lib/mgba/websocket-client'

async function testConnection() {
  const client = new MgbaWebSocketClient('ws://localhost:7102')
  
  console.log('Before connect:')
  console.log('  isConnected():', client.isConnected())
  console.log('  isEvalConnected():', client.isEvalConnected())
  console.log('  isWatchConnected():', client.isWatchConnected())
  
  try {
    console.log('Attempting to connect...')
    await client.connect()
    console.log('Connect() resolved successfully')
    
    console.log('After connect:')
    console.log('  isConnected():', client.isConnected())
    console.log('  isEvalConnected():', client.isEvalConnected())
    console.log('  isWatchConnected():', client.isWatchConnected())
    
    console.log('Testing eval...')
    const result = await client.eval('return 42')
    console.log('Eval result:', result)
    
    client.disconnect()
    console.log('Connection test completed successfully')
  } catch (error) {
    console.log('Connection failed:', error.message)
    console.log('After failed connect:')
    console.log('  isConnected():', client.isConnected())
    console.log('  isEvalConnected():', client.isEvalConnected())
    console.log('  isWatchConnected():', client.isWatchConnected())
  }
}

testConnection().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); })