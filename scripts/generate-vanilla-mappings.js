#!/usr/bin/env node

/**
 * Script to generate vanilla Pokemon Emerald mapping files
 * Parses pokeemerald source files and maps to PokeAPI data
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// URLs for pokeemerald source files
const POKEEMERALD_BASE = 'https://raw.githubusercontent.com/pret/pokeemerald/6f8a1bbdb8a5ef75c4372cc625164a41e95ec2a4/include/constants'
const POKEEMERALD_URLS = {
  species: `${POKEEMERALD_BASE}/species.h`,
  moves: `${POKEEMERALD_BASE}/moves.h`,
  items: `${POKEEMERALD_BASE}/items.h`,
}

// PokeAPI URLs
const POKEAPI_URLS = {
  pokemon: 'https://pokeapi.co/api/v2/pokemon?limit=100000&offset=0',
  move: 'https://pokeapi.co/api/v2/move?limit=100000&offset=0',
  item: 'https://pokeapi.co/api/v2/item?limit=100000&offset=0',
}

// Output directory
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'lib', 'parser', 'games', 'vanilla', 'data')

/**
 * Fetch text content from URL
 */
async function fetchText(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`)
  }
  return response.text()
}

/**
 * Fetch JSON data from URL
 */
async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`)
  }
  return response.json()
}

/**
 * Parse pokeemerald species.h file to extract species constants
 */
function parseSpeciesConstants(content) {
  const species = new Map()

  // Look for #define SPECIES_NAME value patterns
  const defineRegex = /#define\s+SPECIES_(\w+)\s+(\d+)/g
  let match

  while ((match = defineRegex.exec(content)) !== null) {
    const [, name, id] = match
    const internalId = parseInt(id, 10)

    if (internalId > 0) {
      // Skip SPECIES_NONE (0)
      species.set(internalId, {
        name,
        internalId,
      })
    }
  }

  console.log(`Parsed ${species.size} species from pokeemerald`)
  return species
}

/**
 * Parse pokeemerald moves.h file to extract move constants
 */
function parseMoveConstants(content) {
  const moves = new Map()

  // Look for #define MOVE_NAME value patterns
  const defineRegex = /#define\s+MOVE_(\w+)\s+(\d+)/g
  let match

  while ((match = defineRegex.exec(content)) !== null) {
    const [, name, id] = match
    const internalId = parseInt(id, 10)

    if (internalId > 0) {
      // Skip MOVE_NONE (0)
      moves.set(internalId, {
        name,
        internalId,
      })
    }
  }

  console.log(`Parsed ${moves.size} moves from pokeemerald`)
  return moves
}

/**
 * Parse pokeemerald items.h file to extract item constants
 */
function parseItemConstants(content) {
  const items = new Map()

  // Look for #define ITEM_NAME value patterns
  const defineRegex = /#define\s+ITEM_(\w+)\s+(\d+)/g
  let match

  while ((match = defineRegex.exec(content)) !== null) {
    const [, name, id] = match
    const internalId = parseInt(id, 10)

    if (internalId > 0) {
      // Skip ITEM_NONE (0)
      items.set(internalId, {
        name,
        internalId,
      })
    }
  }

  console.log(`Parsed ${items.size} items from pokeemerald`)
  return items
}

/**
 * Normalize name for matching (remove special characters, convert to lowercase)
 */
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^(ho|oh)$/, 'ho-oh') // Special case for Ho-Oh
    .replace(/^nidoran(f|female)$/, 'nidoran-f')
    .replace(/^nidoran(m|male)$/, 'nidoran-m')
    .replace(/^mr(mime)?$/, 'mr-mime')
    .replace(/^farfetchd$/, 'farfetchd')
    .replace(/^deoxys$/, 'deoxys-normal')
}

/**
 * Create Pokemon mapping from pokeemerald to PokeAPI
 */
function createPokemonMapping(pokeemeraldSpecies, pokeapiPokemon) {
  const mapping = {}

  // Create lookup map for PokeAPI pokemon by name
  const apiLookup = new Map()
  pokeapiPokemon.results.forEach(pokemon => {
    const normalizedName = normalizeName(pokemon.name)
    apiLookup.set(normalizedName, pokemon)
  })

  // Map pokeemerald species to PokeAPI
  for (const [internalId, species] of pokeemeraldSpecies) {
    const normalizedName = normalizeName(species.name)
    const apiPokemon = apiLookup.get(normalizedName)

    if (apiPokemon) {
      // Extract ID from URL (e.g., "https://pokeapi.co/api/v2/pokemon/1/" -> 1)
      const apiId = parseInt(
        apiPokemon.url
          .split('/')
          .filter(x => x)
          .pop(),
        10
      )

      mapping[internalId] = {
        name: apiPokemon.name.charAt(0).toUpperCase() + apiPokemon.name.slice(1),
        id_name: apiPokemon.name,
        id: apiId,
      }
    } else {
      console.warn(`Could not find PokeAPI match for ${species.name} (${internalId})`)
    }
  }

  console.log(`Created ${Object.keys(mapping).length} Pokemon mappings`)
  return mapping
}

/**
 * Create Move mapping from pokeemerald to PokeAPI
 */
function createMoveMapping(pokeemeraldMoves, pokeapiMoves) {
  const mapping = {}

  // Create lookup map for PokeAPI moves by name
  const apiLookup = new Map()
  pokeapiMoves.results.forEach(move => {
    const normalizedName = normalizeName(move.name)
    apiLookup.set(normalizedName, move)
  })

  // Map pokeemerald moves to PokeAPI
  for (const [internalId, move] of pokeemeraldMoves) {
    const normalizedName = normalizeName(move.name)
    const apiMove = apiLookup.get(normalizedName)

    if (apiMove) {
      // Extract ID from URL
      const apiId = parseInt(
        apiMove.url
          .split('/')
          .filter(x => x)
          .pop(),
        10
      )

      mapping[internalId] = {
        name: apiMove.name
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        id_name: apiMove.name,
        id: apiId,
      }
    } else {
      console.warn(`Could not find PokeAPI match for ${move.name} (${internalId})`)
    }
  }

  console.log(`Created ${Object.keys(mapping).length} Move mappings`)
  return mapping
}

/**
 * Create Item mapping from pokeemerald to PokeAPI
 */
function createItemMapping(pokeemeraldItems, pokeapiItems) {
  const mapping = {}

  // Create lookup map for PokeAPI items by name
  const apiLookup = new Map()
  pokeapiItems.results.forEach(item => {
    const normalizedName = normalizeName(item.name)
    apiLookup.set(normalizedName, item)
  })

  // Map pokeemerald items to PokeAPI
  for (const [internalId, item] of pokeemeraldItems) {
    const normalizedName = normalizeName(item.name)
    const apiItem = apiLookup.get(normalizedName)

    if (apiItem) {
      // Extract ID from URL
      const apiId = parseInt(
        apiItem.url
          .split('/')
          .filter(x => x)
          .pop(),
        10
      )

      mapping[internalId] = {
        name: apiItem.name
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        id_name: apiItem.name,
        id: apiId,
      }
    } else {
      console.warn(`Could not find PokeAPI match for ${item.name} (${internalId})`)
    }
  }

  console.log(`Created ${Object.keys(mapping).length} Item mappings`)
  return mapping
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Generating vanilla Pokemon Emerald mappings...')

    // Fetch pokeemerald source files
    console.log('Fetching pokeemerald source files...')
    const [speciesContent, movesContent, itemsContent] = await Promise.all([fetchText(POKEEMERALD_URLS.species), fetchText(POKEEMERALD_URLS.moves), fetchText(POKEEMERALD_URLS.items)])

    // Parse pokeemerald constants
    console.log('Parsing pokeemerald constants...')
    const pokeemeraldSpecies = parseSpeciesConstants(speciesContent)
    const pokeemeraldMoves = parseMoveConstants(movesContent)
    const pokeemeraldItems = parseItemConstants(itemsContent)

    // Fetch PokeAPI data
    console.log('Fetching PokeAPI data...')
    const [pokeapiPokemon, pokeapiMoves, pokeapiItems] = await Promise.all([fetchJson(POKEAPI_URLS.pokemon), fetchJson(POKEAPI_URLS.move), fetchJson(POKEAPI_URLS.item)])

    console.log(`PokeAPI: ${pokeapiPokemon.results.length} pokemon, ${pokeapiMoves.results.length} moves, ${pokeapiItems.results.length} items`)

    // Create mappings
    console.log('Creating mappings...')
    const pokemonMapping = createPokemonMapping(pokeemeraldSpecies, pokeapiPokemon)
    const moveMapping = createMoveMapping(pokeemeraldMoves, pokeapiMoves)
    const itemMapping = createItemMapping(pokeemeraldItems, pokeapiItems)

    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true })

    // Write mapping files
    console.log('Writing mapping files...')
    await Promise.all([
      fs.writeFile(path.join(OUTPUT_DIR, 'pokemon_map.json'), JSON.stringify(pokemonMapping, null, 2)),
      fs.writeFile(path.join(OUTPUT_DIR, 'move_map.json'), JSON.stringify(moveMapping, null, 2)),
      fs.writeFile(path.join(OUTPUT_DIR, 'item_map.json'), JSON.stringify(itemMapping, null, 2)),
    ])

    console.log('✅ Mapping files generated successfully!')
    console.log(`Pokemon: ${Object.keys(pokemonMapping).length} mappings`)
    console.log(`Moves: ${Object.keys(moveMapping).length} mappings`)
    console.log(`Items: ${Object.keys(itemMapping).length} mappings`)
  } catch (error) {
    console.error('❌ Error generating mappings:', error)
    process.exit(1)
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { main }
