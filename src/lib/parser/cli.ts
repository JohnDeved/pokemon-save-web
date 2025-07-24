#!/usr/bin/env tsx
import fs from 'fs'
import path from 'path'
import { PokemonSaveParser } from './core/pokemonSaveParser'
import type { BasePokemonData } from './core/pokemonData'
import type { SaveData } from './core/types'
import { bytesToGbaString, gbaStringToBytes } from './core/utils'

// New: Define columns for party table in a single array for maintainability
const PARTY_COLUMNS = [
  { label: 'Slot', width: 5, value: (_p: BasePokemonData, i: number) => (i + 1).toString() },
  { label: 'Dex ID', width: 8, value: (p: BasePokemonData) => p.speciesId.toString() },
  { label: 'Nickname', width: 12, value: (p: BasePokemonData) => p.nickname },
  { label: 'Lv', width: 4, value: (p: BasePokemonData) => p.level.toString() },
  { label: 'Ability', width: 8, value: (p: BasePokemonData) => p.abilityNumber.toString() },
  { label: 'Nature', width: 10, value: (p: BasePokemonData) => p.nature },
  { label: 'Shiny', width: 6, value: (p: BasePokemonData) => p.shinyNumber.toString() },
  {
    label: 'HP',
    width: 30,
    value: (p: BasePokemonData) => {
      const hpBars = p.maxHp > 0 ? Math.round(20 * p.currentHp / p.maxHp) : 0
      return `[${'█'.repeat(hpBars)}${'░'.repeat(20 - hpBars)}] ${p.currentHp}/${p.maxHp}`
    },
  },
  { label: 'Atk', width: 5, value: (p: BasePokemonData) => p.attack.toString() },
  { label: 'Def', width: 5, value: (p: BasePokemonData) => p.defense.toString() },
  { label: 'Spe', width: 5, value: (p: BasePokemonData) => p.speed.toString() },
  { label: 'SpA', width: 5, value: (p: BasePokemonData) => p.spAttack.toString() },
  { label: 'SpD', width: 5, value: (p: BasePokemonData) => p.spDefense.toString() },
  { label: 'OT Name', width: 10, value: (p: BasePokemonData) => p.otName },
  { label: 'IDNo', width: 7, value: (p: BasePokemonData) => p.otId_str },
]

function pad (str: string, width: number) {
  return str.toString().padEnd(width)
}

/** Display party Pokémon in a formatted table. */
const displayPartyPokemon = (party: readonly BasePokemonData[]) => {
  console.log('\n--- Party Pokémon Summary ---')
  if (!party.length) return void console.log('No Pokémon found in party.')
  const header = PARTY_COLUMNS.map(col => pad(col.label, col.width)).join('')
  console.log(header, `\n${'-'.repeat(header.length)}`)
  party.forEach((p, i) => {
    const row = PARTY_COLUMNS.map(col => pad(col.value(p, i), col.width)).join('')
    console.log(row)
  })
}

/** Display player and save game info. */
const displaySaveblock2Info = ({ player_name, play_time }: SaveData) => {
  console.log('\n--- SaveBlock2 Data ---')
  console.log(`Player Name: ${player_name}`)
  console.log(`Play Time: ${play_time.hours}h ${play_time.minutes}m ${play_time.seconds}s`)
}

/** Display raw bytes for each party Pokémon. */
const displayPartyPokemonRaw = (party: readonly BasePokemonData[]) => {
  console.log('\n--- Party Pokémon Raw Bytes ---')
  if (!party.length) return void console.log('No Pokémon found in party.')
  party.forEach((p, i) => {
    console.log(`\n--- Slot ${i + 1}: ${p.nickname} ---`)
    console.log([...p.rawBytes].map(b => b.toString(16).padStart(2, '0')).join(' '))
  })
}

// Table/graph constants
const COLORS = [31, 32, 33, 34, 35, 36, 91, 92, 93, 94, 95, 96]
const FIELDS: Array<[number, number, string]> = [
  [0x00, 0x04, 'personality'],
  [0x04, 0x08, 'otId'],
  [0x08, 0x12, 'nickname'],
  [0x14, 0x1b, 'otName'],
  [0x23, 0x25, 'c.HP'],
  [0x25, 0x26, 'status'],
  [0x28, 0x2A, 'sp.Id'],
  [0x2A, 0x2C, 'item'],
  [0x34, 0x3F, 'moves'],
  [0x3F, 0x45, 'EVS?'],
  [0x50, 0x54, 'IV'],
  [0x57, 0x58, 'ability'],
  [0x58, 0x59, 'lv'],
  [0x5A, 0x5C, 'HP'],
  [0x5C, 0x5E, 'Atk'],
  [0x5E, 0x60, 'Def'],
  [0x60, 0x62, 'S.Def'],
  [0x62, 0x64, 'S.Atk'],
  [0x64, 0x66, 'Speed'],
]
const RESET = '\x1b[0m'
const colorFor = (i: number) => `\x1b[${COLORS[i % COLORS.length]!}m`

/** Display colored, labeled hex/ASCII visualization for Pokémon bytes. */
const displayColoredBytes = (raw: Uint8Array, fields: Array<[number, number, string]>, bytesPerLine = 32) => {
  let pos = 0
  while (pos < raw.length) {
    let lineEnd = Math.min(pos + bytesPerLine, raw.length)
    for (const [s, e] of fields) if (pos < s && s < lineEnd && lineEnd < e) { lineEnd = s; break }
    if (lineEnd === pos) lineEnd = Math.min(...fields.filter(([s, e]) => s <= pos && pos < e).map(([, e]) => e).concat([pos + 1, raw.length]))
    const lineBytes = raw.slice(pos, lineEnd)
    const fieldForByte = Array.from(lineBytes, (_, j) => fields.find(([s, e]) => pos + j >= s && pos + j < e))
    // Label line
    let labelLine = ''
    for (let i = 0; i < lineBytes.length;) {
      const field = fieldForByte[i]; const idx = pos + i
      if (field && idx === field[0]) {
        const [s, e, n] = field; const color = colorFor(fields.indexOf(field))
        const fieldLen = Math.min(e - s, lineBytes.length - i); const width = fieldLen * 3 - 1
        const shortName = n.length > width ? `${n.slice(0, Math.max(0, width - 1))}.` : n
        labelLine += `${color}${shortName.padStart(Math.floor((width + shortName.length) / 2)).padEnd(width)}${RESET}`
        i += fieldLen
        if (i < lineBytes.length) labelLine += ' '
      } else {
        labelLine += (i < lineBytes.length - 1 ? '   ' : '  ')
        i++
      }
    }
    let artLine = ''; let hexLine = ''
    for (let j = 0; j < lineBytes.length; ++j) {
      const field = fieldForByte[j]; const color = field ? colorFor(fields.indexOf(field)) : ''
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
const displayPartyPokemonGraph = (party: readonly BasePokemonData[]) => {
  if (!party.length) return void console.log('No Pokémon found in party.')
  party.forEach((p, i) => {
    console.log(`\nSlot ${i + 1} (${p.nickname} #${p.speciesId}):\n`)
    displayColoredBytes(p.rawBytes, FIELDS)
    console.log(`\n${'-'.repeat(80)}\n`)
  })
}

// CLI entry
const argv = process.argv
const debug = argv.includes('--debug')
const graph = argv.includes('--graph')
const toBytesArg = argv.find(arg => arg.startsWith('--toBytes='))
if (toBytesArg) {
  const str = toBytesArg.split('=')[1] ?? ''
  const bytes = gbaStringToBytes(str, str.length + 1) // +1 for null terminator
  console.log(`GBA bytes for "${str}":`)
  console.log(Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '))
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
      .map(b => parseInt(b, 16)),
  )
  const str = bytesToGbaString(bytes)
  console.log(`String for bytes [${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ')}]:`)
  console.log(str)
  process.exit(0)
}
const savePath = argv.find(arg => arg.match(/\.sav$/i) && fs.existsSync(path.resolve(arg)))
if (!savePath) {
  console.error(`\nUsage: tsx cli.ts <savefile.sav> [options]

Options:
  --debug           Show raw bytes for each party Pokémon after the summary table
  --graph           Show colored hex/field graph for each party Pokémon (instead of summary table)
  --toBytes=STRING  Convert a string to GBA byte encoding and print the result
  --toString=HEX    Convert a space/comma-separated hex byte string to a decoded GBA string

Examples:
  tsx cli.ts mysave.sav --debug
  tsx cli.ts mysave.sav --graph
  tsx cli.ts --toBytes=PIKACHU
  tsx cli.ts --toString="50 49 4b 41 43 48 55 00"
`)
  process.exit(1)
}
const absPath = path.resolve(savePath)
const buffer = fs.readFileSync(absPath)
const parser = new PokemonSaveParser()
try {
  const result = await parser.parseSaveFile(buffer)
  console.log(`Active save slot: ${result.active_slot}`)
  console.log(`Valid sectors found: ${result.sector_map.size}`)
  if (graph) displayPartyPokemonGraph(result.party_pokemon)
  else {
    displayPartyPokemon(result.party_pokemon)
    if (debug) displayPartyPokemonRaw(result.party_pokemon)
    displaySaveblock2Info(result)
  }
} catch (err) {
  console.error('Failed to parse save file:', err)
  process.exit(1)
}
