#!/usr/bin/env node

/**
 * EmulatorJS mGBA Demo Script
 * 
 * Demonstrates using @emulatorjs/core-mgba as an alternative to native mGBA installation.
 * This provides a web-based emulator that can be embedded in browsers for testing.
 */

import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Configuration
const CONFIG = {
  testDataDir: join(__dirname, '..', 'test_data'),
  romFile: 'emerald.gba',
}

function showHelp() {
  console.log(`
EmulatorJS mGBA Demo Script

This script demonstrates how to use @emulatorjs/core-mgba as an alternative
to native mGBA installation for web-based emulation.

Setup:
  npm install @emulatorjs/core-mgba

Usage:
  node scripts/emulatorjs-mgba-demo.js

Features:
  - Web-based Game Boy Advance emulator
  - No native mGBA installation required
  - Runs in browser environments
  - Programmatic ROM loading
  - Save state support

Example integration:
  import EJS_mgba from '@emulatorjs/core-mgba'
  const emulator = new EJS_mgba()
  await emulator.initialize()
  await emulator.loadROM(romData)

Note: This is for demonstration purposes. The actual EmulatorJS integration
would require additional setup for canvas rendering and input handling.
`)
}

async function checkEmulatorJSAvailability() {
  try {
    console.log('🔍 Checking @emulatorjs/core-mgba availability...')
    
    // Check if package is installed
    const packagePath = join(process.cwd(), 'node_modules', '@emulatorjs', 'core-mgba', 'package.json')
    if (existsSync(packagePath)) {
      const packageInfo = JSON.parse(readFileSync(packagePath, 'utf8'))
      console.log('✅ @emulatorjs/core-mgba is available')
      console.log(`   Package version: ${packageInfo.version}`)
      console.log(`   Description: ${packageInfo.description}`)
      return true
    } else {
      throw new Error('Package not found')
    }
  } catch (error) {
    console.log('❌ @emulatorjs/core-mgba not found')
    console.log('   Install with: npm install @emulatorjs/core-mgba')
    console.log(`   Error: ${error.message}`)
    return false
  }
}

function checkROMFile() {
  const romPath = join(CONFIG.testDataDir, CONFIG.romFile)
  
  if (!existsSync(romPath)) {
    console.log(`❌ ROM file not found: ${romPath}`)
    console.log('   Place your legally obtained Pokemon Emerald ROM as emerald.gba in test_data/')
    return null
  }
  
  const stats = readFileSync(romPath)
  console.log(`✅ ROM file found: ${CONFIG.romFile} (${stats.length} bytes)`)
  return romPath
}

async function demonstrateEmulatorJSIntegration() {
  console.log('\n🎮 EmulatorJS Integration Example')
  console.log('=' .repeat(40))
  
  const romPath = checkROMFile()
  if (!romPath) {
    return
  }
  
  const hasEmulatorJS = await checkEmulatorJSAvailability()
  if (!hasEmulatorJS) {
    return
  }
  
  console.log('\n💡 Example EmulatorJS usage:')
  console.log(`
// Note: EmulatorJS requires a browser environment for proper functionality

// 1. Include EmulatorJS in your HTML
<script src="https://cdn.emulatorjs.org/latest/mgba.js"></script>

// 2. Set up the emulator container
<div id="emulator-container"></div>

// 3. Initialize EmulatorJS
const EJS = new EmulatorJS('emulator-container', {
  core: 'mgba',
  rom: '${CONFIG.romFile}',
  gameId: 'pokemon-emerald',
  biosUrl: '', // Optional BIOS file
  localizationUrl: '',
  threads: 4,
  mute: false,
  volume: 0.5,
  playerCount: 1
})

// 4. Load ROM and start
EJS.start()

// 5. Save/Load states via API
EJS.saveState(slot)
EJS.loadState(slot)
`)
  
  console.log('🌐 Web Integration Benefits:')
  console.log('   • No native emulator installation required')
  console.log('   • Runs in any modern browser')
  console.log('   • Easy integration with web applications')
  console.log('   • Programmatic control over emulation')
  console.log('   • Cross-platform compatibility')
  
  console.log('\n🔧 Implementation Notes:')
  console.log('   • Requires canvas element for rendering')
  console.log('   • Audio context needed for sound')
  console.log('   • Input handling for game controls')
  console.log('   • Memory management for save states')
  
  console.log('\n📖 For full documentation visit:')
  console.log('   https://emulatorjs.org/')
  console.log('   https://www.npmjs.com/package/@emulatorjs/core-mgba')
}

function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp()
    process.exit(0)
  }
  
  console.log('🚀 EmulatorJS mGBA Alternative Demo')
  console.log('=' .repeat(40))
  
  demonstrateEmulatorJSIntegration().catch(console.error)
}

main()