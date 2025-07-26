#!/usr/bin/env node

/**
 * Docker mGBA Management Script
 * Provides easy management of the Docker-based mGBA test environment
 */

import { spawn } from 'child_process'
import { resolve, join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = resolve(__dirname, '../')

const CONTAINER_NAME = 'mgba-test-environment'
const SERVER_PORT = 7102

function showHelp() {
  console.log(`
🐳 Docker mGBA Management Script

Usage: node docker/docker-mgba.js <command> [options]

Commands:
  build         Build the mGBA Docker image
  start         Start the mGBA container
  stop          Stop the mGBA container
  restart       Restart the mGBA container
  logs          Show container logs
  shell         Open shell in running container
  test          Run HTTP tests against container
  status        Show container status
  clean         Remove container and image
  help          Show this help message

Examples:
  node scripts/docker-mgba.js build
  node scripts/docker-mgba.js start
  node scripts/docker-mgba.js test
  node scripts/docker-mgba.js logs -f

Environment:
  Container: ${CONTAINER_NAME}
  HTTP Port: ${SERVER_PORT}
  Base URL:  http://localhost:${SERVER_PORT}
`)
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`)
    
    const process = spawn(command, args, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      ...options
    })

    process.on('exit', (code) => {
      if (code === 0) {
        resolve(code)
      } else {
        reject(new Error(`Command failed with code ${code}`))
      }
    })

    process.on('error', reject)
  })
}

async function buildImage() {
  console.log('🔨 Building mGBA Docker image...')
  try {
    await runCommand('docker', ['compose', '-f', 'docker/docker-compose.yml', 'build'])
    console.log('✅ Build completed successfully')
  } catch (error) {
    console.error('❌ Build failed:', error.message)
    process.exit(1)
  }
}

async function startContainer() {
  console.log('🚀 Starting mGBA container...')
  try {
    await runCommand('docker', ['compose', '-f', 'docker/docker-compose.yml', 'up', '-d'])
    console.log('✅ Container started successfully')
    console.log(`🌐 HTTP server will be available at http://localhost:${SERVER_PORT}`)
    console.log('⏳ Waiting for emulator to initialize...')
    
    // Wait a bit then test connectivity
    setTimeout(async () => {
      try {
        const response = await fetch(`http://localhost:${SERVER_PORT}/`)
        if (response.ok) {
          console.log('✅ HTTP server is responding')
        } else {
          console.log('⚠️ HTTP server not responding yet - check logs')
        }
      } catch (error) {
        console.log('⚠️ HTTP server not ready yet - use "logs" command to check progress')
      }
    }, 10000)
    
  } catch (error) {
    console.error('❌ Start failed:', error.message)
    process.exit(1)
  }
}

async function stopContainer() {
  console.log('🛑 Stopping mGBA container...')
  try {
    await runCommand('docker', ['compose', '-f', 'docker/docker-compose.yml', 'down'])
    console.log('✅ Container stopped successfully')
  } catch (error) {
    console.error('❌ Stop failed:', error.message)
    process.exit(1)
  }
}

async function restartContainer() {
  console.log('🔄 Restarting mGBA container...')
  try {
    await runCommand('docker', ['compose', '-f', 'docker/docker-compose.yml', 'restart'])
    console.log('✅ Container restarted successfully')
  } catch (error) {
    console.error('❌ Restart failed:', error.message)
    process.exit(1)
  }
}

async function showLogs() {
  console.log('📋 Showing container logs...')
  const extraArgs = process.argv.slice(3) // Get additional arguments like -f
  try {
    await runCommand('docker', ['compose', '-f', 'docker/docker-compose.yml', 'logs', ...extraArgs])
  } catch (error) {
    console.error('❌ Logs command failed:', error.message)
    process.exit(1)
  }
}

async function openShell() {
  console.log('🐚 Opening shell in container...')
  try {
    await runCommand('docker', ['exec', '-it', CONTAINER_NAME, '/bin/bash'])
  } catch (error) {
    console.error('❌ Shell command failed:', error.message)
    console.log('💡 Make sure the container is running first')
    process.exit(1)
  }
}

async function testHttp() {
  console.log('🧪 Testing HTTP endpoints...')
  
  const baseUrl = `http://localhost:${SERVER_PORT}`
  const tests = [
    { name: 'GET /', path: '/' },
    { name: 'GET /json', path: '/json' },
    { name: 'GET /api/emulator', path: '/api/emulator' },
    { name: 'GET /api/validate', path: '/api/validate' }
  ]

  for (const test of tests) {
    try {
      console.log(`  Testing ${test.name}...`)
      const response = await fetch(`${baseUrl}${test.path}`)
      if (response.ok) {
        console.log(`    ✅ ${test.name} - Status: ${response.status}`)
      } else {
        console.log(`    ❌ ${test.name} - Status: ${response.status}`)
      }
    } catch (error) {
      console.log(`    ❌ ${test.name} - Error: ${error.message}`)
    }
  }

  // Test POST endpoint
  try {
    console.log('  Testing POST /echo...')
    const response = await fetch(`${baseUrl}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'Docker test message'
    })
    if (response.ok) {
      const text = await response.text()
      console.log(`    ✅ POST /echo - Response: "${text}"`)
    } else {
      console.log(`    ❌ POST /echo - Status: ${response.status}`)
    }
  } catch (error) {
    console.log(`    ❌ POST /echo - Error: ${error.message}`)
  }
}

async function showStatus() {
  console.log('📊 Container status:')
  try {
    await runCommand('docker', ['compose', '-f', 'docker/docker-compose.yml', 'ps'])
    console.log('\n🔍 Container health:')
    await runCommand('docker', ['inspect', '--format', '{{.State.Health.Status}}', CONTAINER_NAME])
  } catch (error) {
    console.error('❌ Status command failed:', error.message)
  }
}

async function cleanUp() {
  console.log('🧹 Cleaning up Docker resources...')
  try {
    await runCommand('docker', ['compose', '-f', 'docker/docker-compose.yml', 'down', '--rmi', 'all', '--volumes'])
    console.log('✅ Cleanup completed successfully')
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message)
    process.exit(1)
  }
}

// Main execution
const command = process.argv[2]

switch (command) {
  case 'build':
    buildImage()
    break
  case 'start':
    startContainer()
    break
  case 'stop':
    stopContainer()
    break
  case 'restart':
    restartContainer()
    break
  case 'logs':
    showLogs()
    break
  case 'shell':
    openShell()
    break
  case 'test':
    testHttp()
    break
  case 'status':
    showStatus()
    break
  case 'clean':
    cleanUp()
    break
  case 'help':
  case '--help':
  case '-h':
  default:
    showHelp()
    break
}