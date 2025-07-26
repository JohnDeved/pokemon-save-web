#!/usr/bin/env node

/**
 * mGBA HTTP Interface Test Script
 * 
 * Tests the HTTP interface of the mGBA Lua server to verify automation capabilities.
 */

import { setTimeout } from 'timers/promises'

const SERVER_URL = 'http://localhost:7102'
const WS_URL = 'ws://localhost:7102/ws'

async function testHttpEndpoint(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    }
    
    if (body) {
      options.body = typeof body === 'string' ? body : JSON.stringify(body)
    }

    const response = await fetch(`${SERVER_URL}${endpoint}`, options)
    const responseText = await response.text()
    
    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = responseText
    }

    return {
      success: true,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

async function testWebSocket() {
  return new Promise((resolve) => {
    try {
      // Use dynamic import to avoid issues if ws is not available
      import('ws').then(({ WebSocket }) => {
        const ws = new WebSocket(WS_URL)
        const result = { success: false, messages: [] }

        const timeout = setTimeout(() => {
          ws.close()
          result.error = 'WebSocket connection timeout'
          resolve(result)
        }, 5000)

        ws.on('open', () => {
          console.log('  📡 WebSocket connected')
          // Send a simple Lua expression
          ws.send('2 + 2')
        })

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString())
            result.messages.push(message)
            console.log('  📨 Received:', message)
            
            // If we got a result for our test, we're done
            if (message.result === 4) {
              result.success = true
            }
          } catch (e) {
            result.messages.push({ raw: data.toString() })
          }
        })

        ws.on('error', (error) => {
          clearTimeout(timeout)
          result.error = error.message
          resolve(result)
        })

        ws.on('close', () => {
          clearTimeout(timeout)
          console.log('  📡 WebSocket disconnected')
          resolve(result)
        })

        // Send another test after a delay
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('tostring(emu and "Emulator connected" or "No emulator")')
            setTimeout(() => ws.close(), 1000)
          }
        }, 1000)
      }).catch((error) => {
        resolve({
          success: false,
          error: `WebSocket module not available: ${error.message}`,
          note: 'Install ws package: npm install ws'
        })
      })
    } catch (error) {
      resolve({
        success: false,
        error: error.message
      })
    }
  })
}

async function runTests() {
  console.log('🧪 mGBA HTTP Interface Test Suite')
  console.log('=' .repeat(40))
  console.log(`Testing server at: ${SERVER_URL}`)
  console.log('')

  // Test 1: Basic connectivity
  console.log('🔍 Test 1: Basic connectivity (GET /)')
  const basicTest = await testHttpEndpoint('/')
  if (basicTest.success) {
    console.log(`  ✅ Status: ${basicTest.status} ${basicTest.statusText}`)
    console.log(`  📄 Response: ${basicTest.data}`)
  } else {
    console.log(`  ❌ Failed: ${basicTest.error}`)
    console.log('  💡 Make sure mGBA is running with the HTTP server script')
    console.log('  💡 Run: npm run mgba:test')
    return
  }
  
  console.log('')

  // Test 2: JSON API
  console.log('🔍 Test 2: JSON API (GET /json)')
  const jsonTest = await testHttpEndpoint('/json')
  if (jsonTest.success) {
    console.log(`  ✅ Status: ${jsonTest.status} ${jsonTest.statusText}`)
    console.log(`  📄 Response:`, jsonTest.data)
    console.log(`  🌐 CORS headers:`, {
      'Access-Control-Allow-Origin': jsonTest.headers['access-control-allow-origin'],
      'Content-Type': jsonTest.headers['content-type']
    })
  } else {
    console.log(`  ❌ Failed: ${jsonTest.error}`)
  }
  
  console.log('')

  // Test 3: POST echo
  console.log('🔍 Test 3: POST echo (/echo)')
  const echoData = { message: 'Hello from test script!', timestamp: Date.now() }
  const echoTest = await testHttpEndpoint('/echo', 'POST', echoData)
  if (echoTest.success) {
    console.log(`  ✅ Status: ${echoTest.status} ${echoTest.statusText}`)
    console.log(`  📄 Echo response: ${echoTest.data}`)
  } else {
    console.log(`  ❌ Failed: ${echoTest.error}`)
  }
  
  console.log('')

  // Test 4: WebSocket eval
  console.log('🔍 Test 4: WebSocket Lua eval (/ws)')
  const wsTest = await testWebSocket()
  if (wsTest.success) {
    console.log(`  ✅ WebSocket eval working`)
    console.log(`  📨 Messages received: ${wsTest.messages.length}`)
  } else {
    console.log(`  ❌ Failed: ${wsTest.error || 'Unknown error'}`)
    if (wsTest.note) {
      console.log(`  💡 Note: ${wsTest.note}`)
    }
  }
  
  console.log('')

  // Test 5: 404 handling
  console.log('🔍 Test 5: 404 handling (GET /nonexistent)')
  const notFoundTest = await testHttpEndpoint('/nonexistent')
  if (notFoundTest.success) {
    console.log(`  ✅ Status: ${notFoundTest.status} ${notFoundTest.statusText}`)
    if (notFoundTest.status === 404) {
      console.log(`  ✅ Correctly returns 404 for unknown routes`)
    }
  } else {
    console.log(`  ❌ Failed: ${notFoundTest.error}`)
  }

  console.log('')
  console.log('🎯 Test Summary')
  console.log('-'.repeat(20))
  
  const tests = [
    { name: 'Basic connectivity', result: basicTest },
    { name: 'JSON API', result: jsonTest },
    { name: 'POST echo', result: echoTest },
    { name: 'WebSocket eval', result: wsTest },
    { name: '404 handling', result: notFoundTest }
  ]
  
  const passed = tests.filter(t => t.result.success).length
  const total = tests.length
  
  tests.forEach(test => {
    const status = test.result.success ? '✅' : '❌'
    console.log(`  ${status} ${test.name}`)
  })
  
  console.log('')
  console.log(`📊 Results: ${passed}/${total} tests passed`)
  
  if (passed === total) {
    console.log('🎉 All tests passed! The mGBA HTTP interface is working correctly.')
  } else {
    console.log('⚠️  Some tests failed. Check mGBA is running with the HTTP server.')
  }
}

// Add a small delay to ensure server is ready if just launched
if (process.argv.includes('--wait')) {
  console.log('⏳ Waiting 3 seconds for server to start...')
  await setTimeout(3000)
}

runTests().catch(console.error)