/**
 * Utility functions for WebSocket tests
 */

import { MgbaWebSocketClient } from '../websocket-client'

const WEBSOCKET_URL = 'ws://localhost:7102'

/**
 * Check if mGBA WebSocket server is available
 * Used to conditionally skip tests when server is not running
 */
export async function checkMgbaServerAvailable (): Promise<boolean> {
  try {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()
    client.disconnect()
    return true
  } catch {
    return false
  }
}

/**
 * Wrapper for conditional test execution based on mGBA server availability
 */
export async function conditionalTest (
  testName: string,
  testFn: () => Promise<void> | void,
  options: { timeout?: number } = {},
): Promise<void> {
  const serverAvailable = await checkMgbaServerAvailable()

  if (!serverAvailable) {
    console.log(`⏭️  Skipping "${testName}" - mGBA server not available`)
    return
  }

  if (options.timeout) {
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error(`Test timeout after ${options.timeout}ms`)), options.timeout)
    })

    await Promise.race([
      Promise.resolve(testFn()),
      timeoutPromise,
    ])
  } else {
    await Promise.resolve(testFn())
  }
}
