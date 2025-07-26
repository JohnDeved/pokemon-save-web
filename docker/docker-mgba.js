#!/usr/bin/env node

/**
 * Docker mGBA Management Script
 * Simplified container management for mGBA test environment
 */

import { spawn } from 'child_process'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = resolve(__dirname, '../')
const CONTAINER_NAME = 'mgba-test-environment'
const SERVER_PORT = 7102

function showHelp() {
  console.log(`
🐳 mGBA Docker Environment

Usage: npm run mgba:start | npm run mgba:stop

Commands:
  start    Build and start the mGBA environment
  stop     Stop the mGBA environment

Environment:
  Container: ${CONTAINER_NAME}
  Port: ${SERVER_PORT} (HTTP server)
  
Features:
  - Automatic ROM download from archive.org
  - Built-from-source mGBA with Lua support
  - HTTP API endpoints for automation
  - WebSocket interface for real-time control
`)
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`)
    
    const process = spawn(command, args, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit'
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

async function handleCommand(command) {
  const composeFile = 'docker/docker-compose.yml'
  
  try {
    switch (command) {
      case 'start':
        console.log('🚀 Starting mGBA environment...')
        console.log('🔨 Building if needed...')
        await runCommand('docker', ['compose', '-f', composeFile, 'up', '-d', '--build'])
        console.log('✅ mGBA environment started successfully')
        console.log(`🌐 HTTP server available at http://localhost:${SERVER_PORT}`)
        console.log('⏳ Emulator is initializing (may take a few minutes on first run)...')
        
        // Wait a moment then show status
        setTimeout(async () => {
          try {
            console.log('\n📊 Environment status:')
            await runCommand('docker', ['compose', '-f', composeFile, 'ps'])
          } catch (e) {
            // Ignore status check errors
          }
        }, 2000)
        break

      case 'stop':
        console.log('🛑 Stopping mGBA environment...')
        await runCommand('docker', ['compose', '-f', composeFile, 'down'])
        console.log('✅ mGBA environment stopped successfully')
        break

      default:
        showHelp()
        break
    }
  } catch (error) {
    console.error(`❌ ${command} failed:`, error.message)
    process.exit(1)
  }
}

async function testEndpoints() {
  const baseUrl = `http://localhost:${SERVER_PORT}`
  const tests = [
    { name: 'GET /', path: '/' },
    { name: 'GET /json', path: '/json' },
    { name: 'POST /echo', path: '/echo', method: 'POST', body: 'Docker test' }
  ]

  for (const test of tests) {
    try {
      console.log(`  Testing ${test.name}...`)
      const options = {
        method: test.method || 'GET',
        ...(test.body && {
          headers: { 'Content-Type': 'text/plain' },
          body: test.body
        })
      }
      
      const response = await fetch(`${baseUrl}${test.path}`, options)
      console.log(`    ${response.ok ? '✅' : '❌'} ${test.name} - Status: ${response.status}`)
    } catch (error) {
      console.log(`    ❌ ${test.name} - Error: ${error.message}`)
    }
  }
}

// Main execution
const command = process.argv[2] || 'help'
handleCommand(command)