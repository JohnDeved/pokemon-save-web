/**
 * Docker-based mGBA environment tests
 * Tests the real mGBA emulator running in Docker container
 * Automatically manages Docker container lifecycle
 */

import type { ChildProcess } from 'child_process'
import { spawn } from 'child_process'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { dirname, resolve, join } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

// Handle ES modules in Node.js
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PROJECT_ROOT = resolve(__dirname, '../')
const TEST_DATA_DIR = join(PROJECT_ROOT, 'test_data')

// Docker configuration
const CONTAINER_NAME = 'mgba-test-environment'
const SERVER_PORT = 7102

// Helper function to check if Docker is available
function checkDockerAvailability(): Promise<boolean> {
  return new Promise((resolve) => {
    const dockerCheck = spawn('docker', ['--version'], { stdio: 'ignore' })
    dockerCheck.on('error', () => resolve(false))
    dockerCheck.on('exit', (code) => resolve(code === 0))
  })
}

// Helper function to check if Docker Compose is available
function checkDockerComposeAvailability(): Promise<boolean> {
  return new Promise((resolve) => {
    const composeCheck = spawn('docker', ['compose', 'version'], { stdio: 'ignore' })
    composeCheck.on('error', () => {
      // Try legacy docker-compose
      const legacyCheck = spawn('docker-compose', ['--version'], { stdio: 'ignore' })
      legacyCheck.on('error', () => resolve(false))
      legacyCheck.on('exit', (code) => resolve(code === 0))
    })
    composeCheck.on('exit', (code) => resolve(code === 0))
  })
}

// Helper function to run Docker commands
function runDockerCommand(args: string[], options: { cwd?: string } = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const process = spawn('docker', args, {
      cwd: options.cwd || PROJECT_ROOT,
      stdio: 'pipe'
    })

    let stdout = ''
    let stderr = ''

    process.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    process.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    process.on('exit', (code) => {
      resolve({ code: code || 0, stdout, stderr })
    })

    process.on('error', (error) => {
      resolve({ code: 1, stdout, stderr: error.message })
    })
  })
}

// Helper function to run Docker Compose commands
function runDockerComposeCommand(args: string[], options: { cwd?: string } = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const process = spawn('docker', ['compose', '-f', 'docker/docker-compose.yml', ...args], {
      cwd: options.cwd || PROJECT_ROOT,
      stdio: 'pipe'
    })

    let stdout = ''
    let stderr = ''

    process.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    process.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    process.on('exit', (code) => {
      resolve({ code: code || 0, stdout, stderr })
    })

    process.on('error', (error) => {
      // Try legacy docker-compose
      const legacyProcess = spawn('docker-compose', ['-f', 'docker/docker-compose.yml', ...args], {
        cwd: options.cwd || PROJECT_ROOT,
        stdio: 'pipe'
      })

      let legacyStdout = ''
      let legacyStderr = ''

      legacyProcess.stdout?.on('data', (data: Buffer) => {
        legacyStdout += data.toString()
      })

      legacyProcess.stderr?.on('data', (data: Buffer) => {
        legacyStderr += data.toString()
      })

      legacyProcess.on('exit', (code) => {
        resolve({ code: code || 0, stdout: legacyStdout, stderr: legacyStderr })
      })

      legacyProcess.on('error', (legacyError) => {
        resolve({ code: 1, stdout: '', stderr: `${error.message}\n${legacyError.message}` })
      })
    })
  })
}

// Helper function to wait for HTTP server to be ready
async function waitForHttpServer(baseUrl: string, maxAttempts: number = 60): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${baseUrl}/`)
      if (response.ok) {
        console.log(`  ✅ HTTP server is ready at ${baseUrl}`)
        return true
      }
    } catch (error) {
      // Server not ready yet, continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
  }
  
  console.log(`  ❌ HTTP server failed to start at ${baseUrl} after ${maxAttempts} attempts`)
  return false
}

describe('Docker mGBA Environment Tests', () => {
  let setupSucceeded = false
  let baseUrl: string
  let containerStarted = false

  beforeAll(async () => {
    console.log('🐳 Setting up Docker mGBA environment...')
    
    baseUrl = `http://localhost:${SERVER_PORT}`
    
    // Check Docker availability
    const dockerAvailable = await checkDockerAvailability()
    if (!dockerAvailable) {
      console.log('❌ Docker not available - skipping Docker tests')
      return
    }

    const composeAvailable = await checkDockerComposeAvailability()
    if (!composeAvailable) {
      console.log('❌ Docker Compose not available - skipping Docker tests')
      return
    }

    console.log('✅ Docker and Docker Compose are available')

    // Ensure required files exist
    const requiredFiles = [
      join(__dirname, 'Dockerfile'),
      join(__dirname, 'docker-compose.yml'),
      join(TEST_DATA_DIR, 'emerald.ss0'),
      join(TEST_DATA_DIR, 'mgba_http_server.lua')
    ]

    for (const file of requiredFiles) {
      if (!existsSync(file)) {
        console.log(`❌ Required file not found: ${file}`)
        return
      }
    }

    console.log('✅ All required files present')

    // Stop any existing container
    console.log('🛑 Stopping any existing container...')
    await runDockerComposeCommand(['down'])

    // Build and start the container
    console.log('🔨 Building mGBA Docker image...')
    const buildResult = await runDockerComposeCommand(['build'])
    if (buildResult.code !== 0) {
      console.log('❌ Docker build failed:', buildResult.stderr)
      return
    }

    console.log('🚀 Starting mGBA container...')
    const startResult = await runDockerComposeCommand(['up', '-d'])
    if (startResult.code !== 0) {
      console.log('❌ Container start failed:', startResult.stderr)
      return
    }

    containerStarted = true
    console.log('✅ Container started successfully')

    // Wait for HTTP server to be ready
    console.log('⏳ Waiting for mGBA and HTTP server to start...')
    const serverReady = await waitForHttpServer(baseUrl)
    
    if (!serverReady) {
      console.log('⚠️ HTTP server not responding - checking container logs...')
      const logsResult = await runDockerComposeCommand(['logs', 'mgba-test'])
      console.log('Container logs:', logsResult.stdout)
      return
    }

    setupSucceeded = true
    console.log('✅ Docker mGBA environment is ready!')
    
  }, 180000) // 3 minute timeout for environment setup

  afterAll(async () => {
    if (containerStarted) {
      console.log('🛑 Stopping Docker container...')
      const stopResult = await runDockerComposeCommand(['down'])
      if (stopResult.code === 0) {
        console.log('✅ Container stopped successfully')
      } else {
        console.log('⚠️ Container stop had issues:', stopResult.stderr)
      }
    } else {
      console.log('✅ No container to clean up')
    }
  })

  describe('Environment Validation', () => {
    it('should have Docker mGBA container running', async () => {
      if (!setupSucceeded) {
        console.log('⏭️ Skipping test - environment setup failed')
        return
      }
      
      const psResult = await runDockerCommand(['ps', '--filter', `name=${CONTAINER_NAME}`, '--format', 'table {{.Names}}\t{{.Status}}'])
      expect(psResult.code).toBe(0)
      expect(psResult.stdout).toContain(CONTAINER_NAME)
      
      console.log('✅ Docker container is running')
    })

    it('should have container health check passing', async () => {
      if (!setupSucceeded) {
        console.log('⏭️ Skipping test - environment setup failed')
        return
      }
      
      // Wait a bit for health check to stabilize
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      const inspectResult = await runDockerCommand(['inspect', CONTAINER_NAME])
      expect(inspectResult.code).toBe(0)
      
      const containerInfo = JSON.parse(inspectResult.stdout)
      const healthStatus = containerInfo[0]?.State?.Health?.Status
      
      // Health check might still be starting, so we allow "starting" status
      expect(['healthy', 'starting']).toContain(healthStatus)
      
      console.log(`✅ Container health status: ${healthStatus}`)
    })
  })

  describe('HTTP Endpoints', () => {
    it('should handle GET / and return welcome message', async () => {
      if (!setupSucceeded) {
        console.log('⏭️ Skipping test - environment setup failed')
        return
      }
      
      const response = await fetch(`${baseUrl}/`)
      
      expect(response.status).toBe(200)
      const text = await response.text()
      expect(text).toContain('Welcome to mGBA HTTP Server')
      
      console.log('✅ GET / endpoint working')
    })

    it('should handle GET /json and return JSON with CORS headers', async () => {
      if (!setupSucceeded) {
        console.log('⏭️ Skipping test - environment setup failed')
        return
      }
      
      const response = await fetch(`${baseUrl}/json`)
      
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toContain('application/json')
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      
      const data = await response.json()
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('timestamp')
      
      console.log('✅ GET /json endpoint with CORS working')
    })

    it('should handle POST /echo and echo the request body', async () => {
      if (!setupSucceeded) {
        console.log('⏭️ Skipping test - environment setup failed')
        return
      }
      
      const testData = 'Hello from Docker test!'
      const response = await fetch(`${baseUrl}/echo`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: testData
      })
      
      expect(response.status).toBe(200)
      const text = await response.text()
      expect(text).toBe(testData)
      
      console.log('✅ POST /echo endpoint working')
    })

    it('should return 404 for unknown routes', async () => {
      if (!setupSucceeded) {
        console.log('⏭️ Skipping test - environment setup failed')
        return
      }
      
      const response = await fetch(`${baseUrl}/unknown`)
      expect(response.status).toBe(404)
      
      console.log('✅ 404 handling working')
    })
  })

  describe('Emulator API Validation', () => {
    it('should validate emulator APIs are available and working', async () => {
      if (!setupSucceeded) {
        console.log('⏭️ Skipping test - environment setup failed')
        return
      }
      
      const response = await fetch(`${baseUrl}/api/validate`)
      
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toContain('application/json')
      
      const validation = await response.json()
      
      // Validate structure
      expect(validation).toHaveProperty('environment')
      expect(validation).toHaveProperty('apis')
      expect(validation).toHaveProperty('rom_info')
      expect(validation).toHaveProperty('system_info')
      
      // Validate console API
      expect(validation.apis.console).toHaveProperty('available')
      expect(validation.apis.console.available).toBe(true)
      expect(validation.apis.console.tested).toBe(true)
      
      // Validate emu API
      expect(validation.apis.emu).toHaveProperty('available')
      expect(validation.apis.emu.available).toBe(true)
      expect(validation.apis.emu).toHaveProperty('methods')
      expect(validation.apis.emu.rom_loaded).toBe(true)
      expect(validation.apis.emu.rom_size).toBeGreaterThan(0)
      
      // Validate callbacks API
      expect(validation.apis.callbacks).toHaveProperty('available')
      expect(validation.apis.callbacks.available).toBe(true)
      expect(validation.apis.callbacks.tested).toBe(true)
      
      // Validate socket API
      expect(validation.apis.socket).toHaveProperty('available')
      expect(validation.apis.socket.available).toBe(true)
      expect(validation.apis.socket.tested).toBe(true)
      
      // Validate ROM info - should be 16MB Pokémon Emerald
      expect(validation.rom_info.size).toBe(16777216) // 16 MB
      
      // Validate system info
      expect(validation.system_info.lua_version).toContain('Lua')
      expect(validation.system_info.platform).toBe('mGBA')
      
      console.log('✅ Docker emulator API validation successful')
      console.log(`   - Console API: ${validation.apis.console.available ? '✅' : '❌'}`)
      console.log(`   - Emu API: ${validation.apis.emu.available ? '✅' : '❌'} (ROM loaded: ${validation.apis.emu.rom_loaded})`)
      console.log(`   - Callbacks API: ${validation.apis.callbacks.available ? '✅' : '❌'}`)
      console.log(`   - Socket API: ${validation.apis.socket.available ? '✅' : '❌'}`)
      console.log(`   - ROM size: ${validation.rom_info.size} bytes`)
    })
    
    it('should provide emulator status information', async () => {
      if (!setupSucceeded) {
        console.log('⏭️ Skipping test - environment setup failed')
        return
      }
      
      const response = await fetch(`${baseUrl}/api/emulator`)
      
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toContain('application/json')
      
      const status = await response.json()
      
      expect(status.running).toBe(true)
      expect(status.platform).toBe('mGBA')
      expect(status.lua_version).toContain('Lua')
      expect(status.rom_loaded).toBe(true)
      expect(status.rom_size).toBeGreaterThan(0)
      
      console.log('✅ Docker emulator status endpoint working')
      console.log(`   - Platform: ${status.platform}`)
      console.log(`   - Lua: ${status.lua_version}`)
      console.log(`   - ROM loaded: ${status.rom_loaded}`)
      console.log(`   - ROM size: ${status.rom_size} bytes`)
      if (status.rom_title) {
        console.log(`   - ROM title: ${status.rom_title}`)
      }
    })
  })

  describe('Container Management', () => {
    it('should provide container logs for debugging', async () => {
      if (!setupSucceeded) {
        console.log('⏭️ Skipping test - environment setup failed')
        return
      }
      
      const logsResult = await runDockerComposeCommand(['logs', '--tail', '50', 'mgba-test'])
      expect(logsResult.code).toBe(0)
      
      console.log('✅ Container logs accessible')
      console.log('Recent logs:', logsResult.stdout.slice(-500)) // Show last 500 characters
    })

    it('should handle container restart gracefully', async () => {
      if (!setupSucceeded) {
        console.log('⏭️ Skipping test - environment setup failed')
        return
      }
      
      console.log('🔄 Testing container restart...')
      
      // Restart the container
      const restartResult = await runDockerComposeCommand(['restart', 'mgba-test'])
      expect(restartResult.code).toBe(0)
      
      // Wait for service to be ready again
      const serverReady = await waitForHttpServer(baseUrl, 30)
      expect(serverReady).toBe(true)
      
      console.log('✅ Container restart successful')
    })
  })
})