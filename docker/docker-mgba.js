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
🐳 Docker mGBA Management

Usage: node docker/docker-mgba.js <command>

Commands:
  build    Build the Docker image
  start    Start the container
  stop     Stop the container  
  restart  Restart the container
  logs     Show container logs
  status   Show container status
  clean    Remove container and image
  help     Show this help

Examples:
  npm run mgba:docker:build
  npm run mgba:docker:start
  npm run mgba:docker:logs

Environment:
  Container: ${CONTAINER_NAME}
  Port: ${SERVER_PORT}
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
      case 'build':
        console.log('🔨 Building mGBA Docker image...')
        await runCommand('docker', ['compose', '-f', composeFile, 'build'])
        console.log('✅ Build completed successfully')
        break

      case 'start':
        console.log('🚀 Starting mGBA container...')
        await runCommand('docker', ['compose', '-f', composeFile, 'up', '-d'])
        console.log('✅ Container started successfully')
        console.log(`🌐 HTTP server will be available at http://localhost:${SERVER_PORT}`)
        console.log('⏳ Waiting for emulator to initialize...')
        break

      case 'stop':
        console.log('🛑 Stopping mGBA container...')
        await runCommand('docker', ['compose', '-f', composeFile, 'down'])
        console.log('✅ Container stopped successfully')
        break

      case 'restart':
        console.log('🔄 Restarting mGBA container...')
        await runCommand('docker', ['compose', '-f', composeFile, 'restart'])
        console.log('✅ Container restarted successfully')
        break

      case 'logs':
        console.log('📋 Showing container logs...')
        const extraArgs = process.argv.slice(3)
        await runCommand('docker', ['compose', '-f', composeFile, 'logs', ...extraArgs])
        break

      case 'status':
        console.log('📊 Container status:')
        await runCommand('docker', ['compose', '-f', composeFile, 'ps'])
        break

      case 'clean':
        console.log('🧹 Cleaning up Docker resources...')
        await runCommand('docker', ['compose', '-f', composeFile, 'down', '--rmi', 'all'])
        console.log('✅ Cleanup completed successfully')
        break

      case 'test':
        console.log('🧪 Testing HTTP endpoints...')
        await testEndpoints()
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