#!/usr/bin/env -S npx tsx
import fs from 'fs'
import path from 'path'
import { PokemonSaveParser } from './core/PokemonSaveParser'
import type { PokemonBase } from './core/PokemonBase'
import type { SaveData } from './core/types'
import { bytesToGbaString, gbaStringToBytes } from './core/utils'
import { MgbaWebSocketClient } from '../mgba/websocket-client'

// New: Define columns for party table in a single array for maintainability
const PARTY_COLUMNS = [
  { label: 'Slot', width: 5, value: (_p: PokemonBase, i: number) => (i + 1).toString() },
  { label: 'Dex ID', width: 8, value: (p: PokemonBase) => p.speciesId.toString() },
  { label: 'Nickname', width: 12, value: (p: PokemonBase) => p.nickname },
  { label: 'Lv', width: 4, value: (p: PokemonBase) => p.level.toString() },
  { label: 'Ability', width: 8, value: (p: PokemonBase) => p.abilityNumber.toString() },
  { label: 'Nature', width: 10, value: (p: PokemonBase) => p.nature },
  { label: 'Shiny', width: 6, value: (p: PokemonBase) => p.shinyNumber.toString() },
  {
    label: 'HP',
    width: 32,
    value: (p: PokemonBase) => {
      const hpBars = p.maxHp > 0 ? Math.round((20 * p.currentHp) / p.maxHp) : 0
      return `[${'█'.repeat(hpBars)}${'░'.repeat(20 - hpBars)}] ${p.currentHp}/${p.maxHp}`
    },
  },
  { label: 'Atk', width: 5, value: (p: PokemonBase) => p.attack.toString() },
  { label: 'Def', width: 5, value: (p: PokemonBase) => p.defense.toString() },
  { label: 'Spe', width: 5, value: (p: PokemonBase) => p.speed.toString() },
  { label: 'SpA', width: 5, value: (p: PokemonBase) => p.spAttack.toString() },
  { label: 'SpD', width: 5, value: (p: PokemonBase) => p.spDefense.toString() },
  { label: 'OT Name', width: 10, value: (p: PokemonBase) => p.otName },
  { label: 'IDNo', width: 7, value: (p: PokemonBase) => p.otId_str },
]

function pad(str: string, width: number) {
  return str.toString().padEnd(width)
}

/** Display party Pokémon in a formatted table. */
const displayPartyPokemon = (party: readonly PokemonBase[], mode = 'FILE') => {
  console.log(`\n--- Party Pokémon Summary (${mode} MODE) ---`)
  if (!party.length) return void console.log('No Pokémon found in party.')
  const header = PARTY_COLUMNS.map(col => pad(col.label, col.width)).join('')
  console.log(header, `\n${'-'.repeat(header.length)}`)
  party.forEach((p, i) => {
    const row = PARTY_COLUMNS.map(col => pad(col.value(p, i), col.width)).join('')
    console.log(row)
  })
}

/** Display player and save game info. */
const displaySaveblock2Info = ({ player_name, play_time }: SaveData, mode = 'FILE') => {
  console.log(`\n--- SaveBlock2 Data (${mode} MODE) ---`)
  console.log(`Player Name: ${player_name}`)
  console.log(`Play Time: ${play_time.hours}h ${play_time.minutes}m ${play_time.seconds}s`)
}

/** Display raw bytes for each party Pokémon. */
const displayPartyPokemonRaw = (party: readonly PokemonBase[]) => {
  console.log('\n--- Party Pokémon Raw Bytes ---')
  if (!party.length) return void console.log('No Pokémon found in party.')
  party.forEach((p, i) => {
    console.log(`\n--- Slot ${i + 1}: ${p.nickname} ---`)
    console.log([...p.rawBytes].map(b => b.toString(16).padStart(2, '0')).join(' '))
  })
}

// Table/graph constants
const COLORS = [31, 32, 33, 34, 35, 36, 91, 92, 93, 94, 95, 96]
const FIELDS: [number, number, string][] = [
  [0x00, 0x04, 'personality'],
  [0x04, 0x08, 'otId'],
  [0x08, 0x12, 'nickname'],
  [0x14, 0x1b, 'otName'],
  [0x23, 0x25, 'c.HP'],
  [0x25, 0x26, 'status'],
  [0x28, 0x2a, 'sp.Id'],
  [0x2a, 0x2c, 'item'],
  [0x34, 0x3f, 'moves'],
  [0x3f, 0x45, 'EVS?'],
  [0x50, 0x54, 'IV'],
  [0x57, 0x58, 'ability'],
  [0x58, 0x59, 'lv'],
  [0x5a, 0x5c, 'HP'],
  [0x5c, 0x5e, 'Atk'],
  [0x5e, 0x60, 'Def'],
  [0x60, 0x62, 'S.Def'],
  [0x62, 0x64, 'S.Atk'],
  [0x64, 0x66, 'Speed'],
]
const RESET = '\x1b[0m'
const colorFor = (i: number) => `\x1b[${COLORS[i % COLORS.length]!}m`

/** Display colored, labeled hex/ASCII visualization for Pokémon bytes. */
const displayColoredBytes = (raw: Uint8Array, fields: [number, number, string][], bytesPerLine = 32) => {
  let pos = 0
  while (pos < raw.length) {
    let lineEnd = Math.min(pos + bytesPerLine, raw.length)
    for (const [s, e] of fields)
      if (pos < s && s < lineEnd && lineEnd < e) {
        lineEnd = s
        break
      }
    if (lineEnd === pos) lineEnd = Math.min(...fields.filter(([s, e]) => s <= pos && pos < e).map(([, e]) => e), pos + 1, raw.length)
    const lineBytes = raw.slice(pos, lineEnd)
    const fieldForByte = Array.from(lineBytes, (_, j) => fields.find(([s, e]) => pos + j >= s && pos + j < e))
    // Label line
    let labelLine = ''
    for (let i = 0; i < lineBytes.length; ) {
      const field = fieldForByte[i]
      const idx = pos + i
      if (field && idx === field[0]) {
        const [s, e, n] = field
        const color = colorFor(fields.indexOf(field))
        const fieldLen = Math.min(e - s, lineBytes.length - i)
        const width = fieldLen * 3 - 1
        const shortName = n.length > width ? `${n.slice(0, Math.max(0, width - 1))}.` : n
        labelLine += `${color}${shortName.padStart(Math.floor((width + shortName.length) / 2)).padEnd(width)}${RESET}`
        i += fieldLen
        if (i < lineBytes.length) labelLine += ' '
      } else {
        labelLine += i < lineBytes.length - 1 ? '   ' : '  '
        i++
      }
    }
    let artLine = ''
    let hexLine = ''
    for (let j = 0; j < lineBytes.length; ++j) {
      const field = fieldForByte[j]
      const color = field ? colorFor(fields.indexOf(field)) : ''
      artLine += (field ? `${color}──${RESET}` : '  ') + (j < lineBytes.length - 1 ? ' ' : '')
      hexLine += (j ? ' ' : '') + (field ? `${color}${lineBytes[j]!.toString(16).padStart(2, '0')}${RESET}` : lineBytes[j]!.toString(16).padStart(2, '0'))
    }
    if (labelLine.trim()) console.log(`\n      ${labelLine}`)
    if (artLine.trim()) console.log(`      ${artLine}`)
    console.log(`${pos.toString(16).padStart(4, '0')}: ${hexLine}`)
    pos = lineEnd
  }
}

/** Display graphical hex for each party Pokémon. */
const displayPartyPokemonGraph = (party: readonly PokemonBase[]) => {
  if (!party.length) return void console.log('No Pokémon found in party.')
  party.forEach((p, i) => {
    console.log(`\nSlot ${i + 1} (${p.nickname} #${p.speciesId}):\n`)
    displayColoredBytes(p.rawBytes, FIELDS)
    console.log(`\n${'-'.repeat(80)}\n`)
  })
}

/**
 * Parse and display save data from either file or WebSocket
 */
async function parseAndDisplay(input: string | MgbaWebSocketClient, options: { debug: boolean; graph: boolean; skipDisplay?: boolean }): Promise<SaveData> {
  const parser = new PokemonSaveParser()
  let result: SaveData
  let mode: string

  if (typeof input === 'string') {
    // File mode
    mode = 'FILE'
    const absPath = path.resolve(input)
    const buffer = fs.readFileSync(absPath)
    result = await parser.parse(buffer)
    if (!options.skipDisplay) {
      console.log(`📁 Detected game: ${parser.gameConfig?.name ?? 'unknown'}`)
    }
  } else {
    // WebSocket mode
    mode = 'MEMORY'
    result = await parser.parse(input)
    if (!options.skipDisplay) {
      console.log(`🎮 Connected to: ${parser.gameConfig?.name ?? 'unknown'} (via mGBA WebSocket)`)
    }
  }

  if (!options.skipDisplay) {
    console.log(`Active save slot: ${result.active_slot}`)

    // Only show sector info for file mode (memory mode doesn't have sectors)
    if (result.sector_map) {
      console.log(`Valid sectors found: ${result.sector_map.size}`)
    }

    if (options.graph) {
      displayPartyPokemonGraph(result.party_pokemon)
    } else {
      displayPartyPokemon(result.party_pokemon, mode)
      if (options.debug) displayPartyPokemonRaw(result.party_pokemon)
      displaySaveblock2Info(result, mode)
    }
  }

  return result
}

/**
 * Clear screen and move cursor to top
 */
function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H')
}

/**
 * Watch mode - continuously monitor and update display
 */
async function watchMode(input: string | MgbaWebSocketClient, options: { debug: boolean; graph: boolean; interval: number }) {
  if (typeof input === 'string') {
    // File-based watch mode - use polling since files don't support push notifications
    return watchModeFile(input, options)
  } else {
    // WebSocket-based watch mode - use event-driven updates
    return watchModeWebSocket(input, options)
  }
}

/**
 * File-based watch mode - polling approach for file changes
 */
async function watchModeFile(filePath: string, options: { debug: boolean; graph: boolean; interval: number }) {
  console.log(`🔄 Starting file watch mode (updating every ${options.interval}ms)...`)
  console.log('Press Ctrl+C to exit')

  // Create parser once and reuse it
  const parser = new PokemonSaveParser()
  let lastDataHash = ''
  let isFirstRun = true

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    try {
      // Parse save data without re-initializing parser
      const absPath = path.resolve(filePath)
      const buffer = fs.readFileSync(absPath)
      const result = await parser.parse(buffer)

      // Create a simple hash of the party data to detect changes
      const dataHash = JSON.stringify(
        result.party_pokemon.map(p => ({
          species: p.speciesId,
          level: p.level,
          hp: p.currentHp,
          nickname: p.nickname,
        }))
      )

      // Only update display if party data changed or first run
      if (dataHash !== lastDataHash || isFirstRun) {
        clearScreen()
        displayPartyPokemon(result.party_pokemon, 'FILE')

        lastDataHash = dataHash
        isFirstRun = false
      }
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error')
    }

    await new Promise(resolve => setTimeout(resolve, options.interval))
  }
}

/**
 * WebSocket-based watch mode - event-driven approach using parser watch API
 */
async function watchModeWebSocket(client: MgbaWebSocketClient, options: { debug: boolean; graph: boolean; interval: number }) {
  console.log('🔄 Starting event-driven watch mode...')
  console.log('Press Ctrl+C to exit')

  // Create parser once and reuse it
  const parser = new PokemonSaveParser()

  // Load the WebSocket client into memory mode
  await parser.loadInputData(client)

  // Get and display initial data
  const initialData = await parser.getCurrentSaveData()
  displayPartyPokemon(initialData.party_pokemon, 'MEMORY')
  if (options.debug) displayPartyPokemonRaw(initialData.party_pokemon)

  // Set up watching with the new parser API
  await parser.watch({
    onPartyChange: partyPokemon => {
      clearScreen()
      displayPartyPokemon(partyPokemon, 'MEMORY')
      if (options.debug) displayPartyPokemonRaw(partyPokemon)
    },
    onError: error => {
      console.error('❌ Error processing memory change:', error.message)
    },
  })
  console.log('✅ Memory watching started')

  // Keep the process alive and handle cleanup
  return new Promise<void>(resolve => {
    const cleanup = async () => {
      await parser.stopWatching()
      resolve()
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
  })
}

// CLI entry point
async function main() {
  const { argv } = process

  // Parse command line options
  const debug = argv.includes('--debug')
  const graph = argv.includes('--graph')
  const watch = argv.includes('--watch')
  const websocket = argv.includes('--websocket')

  // Watch interval option
  const intervalArg = argv.find(arg => arg.startsWith('--interval='))
  const interval = intervalArg ? parseInt(intervalArg.split('=')[1] ?? '1000') : 1000

  // WebSocket URL option
  const wsUrlArg = argv.find(arg => arg.startsWith('--ws-url='))
  const wsUrl = wsUrlArg ? wsUrlArg.split('=')[1] : 'ws://localhost:7102/ws'

  // Utility string conversion functions
  const toBytesArg = argv.find(arg => arg.startsWith('--toBytes='))
  if (toBytesArg) {
    const str = toBytesArg.split('=')[1] ?? ''
    const bytes = gbaStringToBytes(str, str.length + 1) // +1 for null terminator
    console.log(`GBA bytes for "${str}":`)
    console.log([...bytes].map(b => b.toString(16).padStart(2, '0')).join(' '))
    process.exit(0)
  }

  const toStringArg = argv.find(arg => arg.startsWith('--toString='))
  if (toStringArg) {
    const hexStr = toStringArg.split('=')[1] ?? ''
    // Accepts space or comma separated hex bytes
    const bytes = new Uint8Array(
      hexStr
        .trim()
        .split(/\s+|,/)
        .filter(Boolean)
        .map(b => parseInt(b, 16))
    )
    const str = bytesToGbaString(bytes)
    console.log(`String for bytes [${[...bytes].map(b => b.toString(16).padStart(2, '0')).join(' ')}]:`)
    console.log(str)
    process.exit(0)
  }

  // Determine input source
  let input: string | MgbaWebSocketClient

  if (websocket) {
    // WebSocket mode
    console.log(`🔌 Connecting to mGBA WebSocket at ${wsUrl}...`)
    const client = new MgbaWebSocketClient(wsUrl)

    try {
      await client.connect()
      console.log('✅ Connected successfully!')
      input = client

      // Setup cleanup on exit
      process.on('SIGINT', () => {
        client.disconnect()
        process.exit(0)
      })
    } catch (error) {
      console.error('❌ Failed to connect to mGBA WebSocket:', error instanceof Error ? error.message : 'Unknown error')
      process.exit(1)
    }
  } else {
    // File mode
    const savePath = argv.find(arg => arg.match(/\.sav$/i) && fs.existsSync(path.resolve(arg)))
    if (!savePath) {
      console.error(`\nUsage: tsx cli.ts [savefile.sav] [options]

Options:
  --websocket           Connect to mGBA via WebSocket instead of reading a file
  --ws-url=URL          WebSocket URL (default: ws://localhost:7102/ws)
  --watch               Continuously monitor for changes and update display
  --interval=MS         Update interval in milliseconds for watch mode (default: 1000)
  --debug               Show raw bytes for each party Pokémon after the summary table
  --graph               Show colored hex/field graph for each party Pokémon (instead of summary table)
  --toBytes=STRING      Convert a string to GBA byte encoding and print the result
  --toString=HEX        Convert a space/comma-separated hex byte string to a decoded GBA string

Examples:
  tsx cli.ts mysave.sav --debug
  tsx cli.ts mysave.sav --graph --watch
  tsx cli.ts --websocket --watch --interval=2000
  tsx cli.ts --websocket --debug
  tsx cli.ts --toBytes=PIKACHU
  tsx cli.ts --toString="50 49 4b 41 43 48 55 00"

WebSocket Mode:
  Requires mGBA Docker container to be running with WebSocket API enabled.
`)
      process.exit(1)
    }
    input = savePath
  }

  // Parse options
  const options = { debug, graph, interval }

  try {
    if (watch) {
      // Watch mode - continuous monitoring
      await watchMode(input, options)
    } else {
      // Single run mode
      await parseAndDisplay(input, options)

      // Cleanup WebSocket if used
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (input instanceof MgbaWebSocketClient) {
        input.disconnect()
      }
    }
  } catch (err) {
    console.error('❌ Failed to parse save data:', err instanceof Error ? err.message : 'Unknown error')

    // Cleanup WebSocket if used
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (input instanceof MgbaWebSocketClient) {
      input.disconnect()
    }

    process.exit(1)
  }
}

// Run the CLI
main().catch(error => {
  console.error('❌ Unexpected error:', error)
  process.exit(1)
})
