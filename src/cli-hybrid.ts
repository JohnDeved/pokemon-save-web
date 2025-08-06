#!/usr/bin/env -S npx tsx
/**
 * Hybrid CLI - Pokemon Save Parser
 * Can use either TypeScript or Go WASM parser
 */

import fs from 'fs'
import { createParser } from './lib/adapters/parser-factory'
import { ParserType } from './lib/unified-parser'

// Command line arguments parsing
const args = process.argv.slice(2)
if (args.length === 0) {
  console.log('Usage: tsx src/cli-hybrid.ts <save_file.sav> [--engine=typescript|go-wasm|auto] [--debug] [--toBytes=text] [--toString=hex]')
  console.log('  --engine     Parser engine to use (default: auto)')
  console.log('  --debug      Show detailed debug information')
  console.log('  --toBytes    Convert text to GBA bytes')
  console.log('  --toString   Convert hex bytes to GBA string')
  process.exit(1)
}

// Parse arguments
let filename = ''
let engine = ParserType.AUTO
let debug = false
let toBytes = ''
let toString = ''

for (const arg of args) {
  if (arg.startsWith('--engine=')) {
    const engineStr = arg.split('=')[1]
    switch (engineStr) {
      case 'typescript':
        engine = ParserType.TYPESCRIPT
        break
      case 'go-wasm':
        engine = ParserType.GO_WASM
        break
      case 'auto':
        engine = ParserType.AUTO
        break
      default:
        console.error(`Unknown engine: ${engineStr}`)
        process.exit(1)
    }
  } else if (arg === '--debug') {
    debug = true
  } else if (arg.startsWith('--toBytes=')) {
    toBytes = arg.split('=')[1]
  } else if (arg.startsWith('--toString=')) {
    toString = arg.split('=')[1]
  } else if (!arg.startsWith('--')) {
    filename = arg
  }
}

async function main() {
  try {
    // Create parser with specified engine
    console.log(`Creating parser with engine: ${engine}`)
    const parser = await createParser({
      type: engine,
      wasmPath: './public/parser.wasm',
      fallbackToTypeScript: true
    })

    // Handle string conversion utilities (if available)
    if (toBytes) {
      if ('encodeText' in parser && typeof parser.encodeText === 'function') {
        console.log(`Encoding text: "${toBytes}"`)
        const encoded = await (parser as any).encodeText(toBytes)
        console.log('Result:', Array.from(encoded).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' '))
      } else {
        console.log('Text encoding not available with this parser engine')
      }
      return
    }

    if (toString) {
      if ('decodeText' in parser && typeof parser.decodeText === 'function') {
        console.log(`Decoding hex: "${toString}"`)
        // Parse hex string to bytes
        const hexStr = toString.replace(/[,\s]/g, '')
        const bytes = new Uint8Array(hexStr.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [])
        const decoded = await (parser as any).decodeText(bytes)
        console.log('Result:', decoded)
      } else {
        console.log('Text decoding not available with this parser engine')
      }
      return
    }

    if (!filename) {
      console.error('No filename provided')
      process.exit(1)
    }

    // Load and parse save file
    console.log(`Loading save file: ${filename}`)
    const fileBuffer = fs.readFileSync(filename)
    const file = new File([fileBuffer], filename, { type: 'application/octet-stream' })

    console.log(`Parsing with ${engine} engine...`)
    const saveData = await parser.parse(file)

    // Display results
    console.log(`\nParsed save file successfully!`)
    console.log(`Player: ${saveData.player_name}`)
    console.log(`Play Time: ${String(saveData.play_time.hours).padStart(2, '0')}:${String(saveData.play_time.minutes).padStart(2, '0')}:${String(saveData.play_time.seconds).padStart(2, '0')}`)
    console.log(`Active Slot: ${saveData.active_slot}`)
    console.log(`Party Pokemon: ${saveData.party_pokemon.length}`)

    if (saveData.party_pokemon.length > 0) {
      console.log('\n--- Party Pokemon ---')
      saveData.party_pokemon.forEach((pokemon: any, i: number) => {
        console.log(`${i + 1}. ${pokemon.nickname || 'Unknown'} (Level ${pokemon.level || '?'})`)
      })
    }

    if (debug) {
      console.log('\n--- Debug Info ---')
      console.log('Parser type:', engine)
      console.log('Save data:', JSON.stringify(saveData, null, 2))
    }

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()