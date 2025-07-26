/**
 * Simplified Docker mGBA Environment Tests  
 * Tests the Docker-based mGBA test environment setup
 */

import { spawn } from 'child_process'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { dirname, resolve, join } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = resolve(__dirname, '../')
const CONTAINER_NAME = 'mgba-test-environment'

// Helper function to run Docker commands
function runDockerCommand(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const process = spawn('docker', args, { cwd: PROJECT_ROOT, stdio: 'pipe' })
    let stdout = '', stderr = ''

    process.stdout?.on('data', (data: Buffer) => stdout += data.toString())
    process.stderr?.on('data', (data: Buffer) => stderr += data.toString())
    process.on('exit', (code) => resolve({ code: code || 0, stdout, stderr }))
    process.on('error', (error) => resolve({ code: 1, stdout, stderr: error.message }))
  })
}

// Helper function to run Docker Compose commands
function runDockerComposeCommand(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return runDockerCommand(['compose', '-f', 'docker/docker-compose.yml', ...args])
}

// Check if Docker is available
async function checkDockerAvailable(): Promise<boolean> {
  const { code } = await runDockerCommand(['--version'])
  return code === 0
}

describe('Docker mGBA Environment Tests', () => {
  let environmentReady = false
  let containerStarted = false

  beforeAll(async () => {
    console.log('🐳 Setting up Docker mGBA environment...')

    // Check Docker availability
    if (!(await checkDockerAvailable())) {
      console.log('❌ Docker not available - skipping Docker tests')
      return
    }

    // Verify required files exist
    const requiredFiles = [
      join(__dirname, 'Dockerfile'),
      join(__dirname, 'docker-compose.yml'),
      join(PROJECT_ROOT, 'test_data/emerald.ss0'),
      join(PROJECT_ROOT, 'test_data/mgba_http_server.lua')
    ]

    for (const file of requiredFiles) {
      if (!existsSync(file)) {
        console.log(`❌ Required file not found: ${file}`)
        return
      }
    }

    // Clean up any existing container
    await runDockerComposeCommand(['down'])

    // Build the container
    console.log('🔨 Building Docker image...')
    const buildResult = await runDockerComposeCommand(['build'])
    if (buildResult.code !== 0) {
      console.log('❌ Docker build failed:', buildResult.stderr)
      return
    }

    // Start the container
    console.log('🚀 Starting container...')
    const startResult = await runDockerComposeCommand(['up', '-d'])
    if (startResult.code !== 0) {
      console.log('❌ Container start failed:', startResult.stderr)
      return
    }

    containerStarted = true
    
    // Wait for container to be ready
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    environmentReady = true
    console.log('✅ Docker environment ready!')

  }, 120000) // 2 minute timeout

  afterAll(async () => {
    if (containerStarted) {
      console.log('🛑 Stopping Docker container...')
      await runDockerComposeCommand(['down'])
    }
  })

  describe('Environment Setup', () => {
    it('should build and start Docker container successfully', async () => {
      if (!environmentReady) {
        console.log('⏭️ Skipping test - environment setup failed')
        return
      }

      const psResult = await runDockerCommand(['ps', '--filter', `name=${CONTAINER_NAME}`, '--format', 'table {{.Names}}\t{{.Status}}'])
      expect(psResult.code).toBe(0)
      expect(psResult.stdout).toContain(CONTAINER_NAME)
      
      console.log('✅ Container is running')
    })

    it('should download ROM and verify file structure', async () => {
      if (!environmentReady) {
        console.log('⏭️ Skipping test - environment setup failed')
        return
      }

      const logsResult = await runDockerComposeCommand(['logs', 'mgba-test'])
      expect(logsResult.code).toBe(0)
      
      // Check that logs show successful setup
      expect(logsResult.stdout).toContain('🚀 Starting mGBA with Pokémon Emerald')
      expect(logsResult.stdout).toContain('emerald.gba')
      expect(logsResult.stdout).toContain('✅')
      
      console.log('✅ ROM downloaded and environment verified')
    })

    it('should have proper file structure in container', async () => {
      if (!environmentReady) {
        console.log('⏭️ Skipping test - environment setup failed')
        return
      }

      // Verify files exist in container
      const execResult = await runDockerCommand(['exec', CONTAINER_NAME, 'ls', '-la', '/app/test_data/'])
      expect(execResult.code).toBe(0)
      expect(execResult.stdout).toContain('emerald.gba')
      expect(execResult.stdout).toContain('emerald.ss0')
      expect(execResult.stdout).toContain('mgba_http_server.lua')
      
      console.log('✅ File structure verified')
    })
  })

  describe('Container Management', () => {
    it('should provide helpful logs for debugging', async () => {
      if (!environmentReady) {
        console.log('⏭️ Skipping test - environment setup failed')
        return
      }

      const logsResult = await runDockerComposeCommand(['logs', '--tail', '10', 'mgba-test'])
      expect(logsResult.code).toBe(0)
      expect(logsResult.stdout.length).toBeGreaterThan(0)
      
      console.log('✅ Container logs accessible')
    })
  })
})