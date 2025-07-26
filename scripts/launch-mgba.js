#!/usr/bin/env node

/**
 * mGBA Launch Script
 * 
 * Launches mGBA emulator with Pokémon Emerald ROM, savestate, and optional Lua HTTP server
 * for automated testing purposes.
 */

import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Configuration
const CONFIG = {
  testDataDir: join(__dirname, '..', 'test_data'),
  romFile: 'emerald.gba',
  savestateFile: 'emerald.ss0',
  luaScript: 'mgba_http_server_enhanced.lua',
  mgbaExecutable: 'mgba-qt' // Default executable name
}

// Command line argument parsing
const args = process.argv.slice(2)
const options = {
  noLua: args.includes('--no-lua'),
  noSavestate: args.includes('--no-savestate'),
  help: args.includes('--help') || args.includes('-h'),
  executable: getArgumentValue(args, '--executable') || CONFIG.mgbaExecutable,
  port: getArgumentValue(args, '--port') || '7102'
}

function getArgumentValue(args, flag) {
  const index = args.indexOf(flag)
  if (index >= 0 && index + 1 < args.length) {
    return args[index + 1]
  }
  return null
}

function showHelp() {
  console.log(`
mGBA Launch Script for Pokemon Save Web Test Environment

Usage: node scripts/launch-mgba.js [options]

Options:
  --help, -h         Show this help message
  --no-lua          Don't load the Lua HTTP server script
  --no-savestate    Don't load the savestate file
  --executable <name> mGBA executable name (default: mgba-qt)
  --port <port>     HTTP server port (default: 7102)

Examples:
  node scripts/launch-mgba.js                    # Full test environment
  node scripts/launch-mgba.js --no-lua          # ROM + savestate only
  node scripts/launch-mgba.js --no-savestate    # ROM + HTTP server only
  node scripts/launch-mgba.js --executable mgba # Use different executable

Required files in test_data/:
  - emerald.gba      # Pokemon Emerald ROM (provide your own legal copy)
  - emerald.ss0      # Memory savestate (included)
  - mgba_http_server.lua # Lua HTTP server script (included)

Note: You must provide your own legally obtained Pokemon Emerald ROM file.
`)
}

function checkRequiredFiles() {
  const romPath = join(CONFIG.testDataDir, CONFIG.romFile)
  const savestatePath = join(CONFIG.testDataDir, CONFIG.savestateFile)
  const luaScriptPath = join(CONFIG.testDataDir, CONFIG.luaScript)

  console.log('🔍 Checking required files...')
  
  if (!existsSync(CONFIG.testDataDir)) {
    console.error(`❌ Test data directory not found: ${CONFIG.testDataDir}`)
    console.error('Run this script from the project root directory.')
    process.exit(1)
  }

  if (!existsSync(romPath)) {
    console.error(`❌ ROM file not found: ${romPath}`)
    console.error('Please place your legally obtained Pokemon Emerald ROM file as emerald.gba in test_data/')
    console.error('See test_data/README.md for legal ROM acquisition instructions.')
    process.exit(1)
  }

  if (!options.noSavestate && !existsSync(savestatePath)) {
    console.error(`❌ Savestate file not found: ${savestatePath}`)
    console.error('The emerald.ss0 savestate file is missing from test_data/')
    process.exit(1)
  }

  if (!options.noLua && !existsSync(luaScriptPath)) {
    console.error(`❌ Lua script not found: ${luaScriptPath}`)
    console.error('The mgba_http_server.lua script is missing from test_data/')
    process.exit(1)
  }

  console.log('✅ Required files found')
  return { romPath, savestatePath, luaScriptPath }
}

function buildMgbaArgs(romPath, savestatePath, luaScriptPath) {
  const mgbaArgs = [romPath]

  // Add savestate if not disabled
  if (!options.noSavestate) {
    mgbaArgs.push('-s', savestatePath)
    console.log(`📄 Loading savestate: ${CONFIG.savestateFile}`)
  }

  // Add Lua script if not disabled
  if (!options.noLua) {
    mgbaArgs.push('-l', luaScriptPath)
    console.log(`🔌 Loading Lua HTTP server: ${CONFIG.luaScript}`)
    console.log(`🌐 HTTP server will be available at: http://localhost:${options.port}`)
  }

  return mgbaArgs
}

function launchMgba(args) {
  console.log(`🚀 Launching mGBA: ${options.executable} ${args.join(' ')}`)
  console.log('')

  const mgbaProcess = spawn(options.executable, args, {
    stdio: 'inherit',
    cwd: CONFIG.testDataDir
  })

  mgbaProcess.on('error', (error) => {
    console.error(`❌ Failed to launch mGBA: ${error.message}`)
    console.error('')
    console.error('Possible solutions:')
    console.error('1. Install mGBA: https://mgba.io/downloads.html')
    console.error('2. Ensure mGBA is in your PATH')
    console.error('3. Use --executable flag to specify different executable name')
    console.error(`   Example: --executable /path/to/mgba-qt`)
    process.exit(1)
  })

  mgbaProcess.on('close', (code) => {
    if (code === 0) {
      console.log('✅ mGBA exited normally')
    } else {
      console.log(`⚠️ mGBA exited with code ${code}`)
    }
  })

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, terminating mGBA...')
    mgbaProcess.kill('SIGTERM')
  })

  return mgbaProcess
}

function main() {
  if (options.help) {
    showHelp()
    process.exit(0)
  }

  console.log('🎮 mGBA Test Environment Launcher')
  console.log('='.repeat(40))

  const { romPath, savestatePath, luaScriptPath } = checkRequiredFiles()
  const mgbaArgs = buildMgbaArgs(romPath, savestatePath, luaScriptPath)

  if (!options.noLua) {
    console.log('')
    console.log('💡 Test the HTTP interface with:')
    console.log(`   curl http://localhost:${options.port}/`)
    console.log(`   curl http://localhost:${options.port}/json`)
    console.log('   Or run: npm run mgba:test-http')
  }

  console.log('')
  launchMgba(mgbaArgs)
}

// Run the script
main()