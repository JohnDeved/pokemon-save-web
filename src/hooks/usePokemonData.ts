import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import type { z } from 'zod'
import { buildPartyListFromSaveData, usePokemonStore, useSaveFileStore } from '../stores'
import {
  type Ability,
  type AbilityApiResponse,
  AbilityApiResponseSchema,
  type ItemApiResponse,
  ItemApiResponseSchema,
  type MoveApiResponse,
  MoveApiResponseSchema,
  type MoveWithDetails,
  PokeApiFlavorTextEntrySchema,
  PokemonApiResponseSchema,
  type PokemonType,
  PokemonTypeSchema,
  type UIPokemonData,
} from '../types'

// --- Constants ---
const UNKNOWN_TYPE: PokemonType = 'UNKNOWN'
const NO_MOVE: MoveWithDetails = {
  pp: 0,
  id: 0,
  name: 'None',
  type: UNKNOWN_TYPE,
  description: 'No move assigned.',
  power: null,
  accuracy: null,
}

// --- Utility Functions ---
const formatName = (name: string): string => name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

const parsePokemonType = (apiType: string): PokemonType => {
  const result = PokemonTypeSchema.safeParse(apiType.toUpperCase())
  return result.success ? result.data : UNKNOWN_TYPE
}

/**
 * Fetch and validate JSON from a URL using a Zod schema.
 */
async function fetchAndValidate<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch from ${url}: ${response.statusText}`)
  const data = await response.json()
  const result = schema.safeParse(data)
  if (!result.success) throw new Error(`Invalid API response format for ${url}`)
  return result.data
}

/**
 * Helper to get the best English description from effect_entries or flavor_text_entries.
 */
function getBestEnglishDescription(apiObj: MoveApiResponse | AbilityApiResponse | ItemApiResponse): string {
  // Prefer effect_entries in English
  const effectEntry = apiObj.effect_entries?.find(e => e.language.name === 'en')
  if (effectEntry?.effect) return effectEntry.effect

  // Fallback to latest English flavor_text_entry using Zod schema, but only keep the latest
  if (!Array.isArray(apiObj.flavor_text_entries)) return 'No description available.'

  let latestText: string | undefined
  let latestId = -1
  for (const entry of apiObj.flavor_text_entries as unknown[]) {
    // Try move/ability schema first (flavor_text)
    const parsedMoveFlavor = PokeApiFlavorTextEntrySchema.safeParse(entry)
    let text: string | undefined
    let url: string | undefined
    if (parsedMoveFlavor.success) {
      if (parsedMoveFlavor.data.language.name !== 'en') continue
      text = parsedMoveFlavor.data.flavor_text
      url = parsedMoveFlavor.data.version_group.url
    } else {
      // Try item flavor schema (text)
      const maybeItem = entry as any
      if (!(maybeItem && maybeItem.language && maybeItem.language.name)) continue
      if (maybeItem.language.name !== 'en') continue
      text = typeof maybeItem.text === 'string' ? maybeItem.text : undefined
      url = maybeItem.version_group?.url
    }
    if (!text) continue
    const match = typeof url === 'string' ? url.match(/\/(\d+)\/?$/) : null
    const id = match ? parseInt(match[1]!, 10) : 0
    if (id > latestId) {
      latestText = text
      latestId = id
    }
  }
  if (latestText) return latestText.replace(/\s+/g, ' ').trim()
  return 'No description available.'
}

/**
 * Fetches all details for a Pokémon, including moves and abilities.
 */
async function getPokemonDetails(pokemon: UIPokemonData) {
  const { data } = pokemon
  const pokeData = await fetchAndValidate(`https://pokeapi.co/api/v2/pokemon/${data.speciesId}`, PokemonApiResponseSchema)
  const moveSources = [data.moves.move1, data.moves.move2, data.moves.move3, data.moves.move4]
  const moveResults = await Promise.all(moveSources.map(move => (move.id === 0 ? null : fetchAndValidate<MoveApiResponse>(`https://pokeapi.co/api/v2/move/${move.id}`, MoveApiResponseSchema).catch(() => null))))
  const abilityEntries = pokeData.abilities
  const abilities: Ability[] = await Promise.all(
    abilityEntries.map(async entry => {
      try {
        const abilityData = await fetchAndValidate<AbilityApiResponse>(entry.ability.url, AbilityApiResponseSchema)
        return {
          slot: entry.slot,
          name: formatName(abilityData.name),
          description: getBestEnglishDescription(abilityData),
        }
      } catch {
        return { slot: entry.slot, name: entry.ability.name, description: 'Could not fetch ability data.' }
      }
    })
  )
  const types = pokeData.types.map(t => parsePokemonType(t.type.name))
  // Extract base stats in correct order
  const baseStats = ['hp', 'attack', 'defense', 'speed', 'special-attack', 'special-defense'].map(stat => pokeData.stats.find(s => s.stat.name === stat)?.base_stat ?? 0)
  const moves: MoveWithDetails[] = moveSources.map((move, i) => {
    if (move.id === 0) {
      return { ...NO_MOVE }
    }
    const validMove = moveResults[i]
    if (validMove) {
      return {
        id: move.id,
        name: formatName(validMove.name),
        pp: move.pp,
        type: validMove.type?.name ? parsePokemonType(validMove.type.name) : UNKNOWN_TYPE,
        description: getBestEnglishDescription(validMove),
        power: validMove.power ?? null,
        accuracy: validMove.accuracy ?? null,
        damageClass: validMove.damage_class?.name,
        target: validMove.target?.name,
      }
    }
    return {
      id: move.id,
      name: `Move #${move.id}`,
      pp: move.pp,
      type: UNKNOWN_TYPE,
      description: 'Failed to load move details.',
      power: null,
      accuracy: null,
    }
  })
  // Fetch held item details if any (by id_name only)
  let item: { name: string; description: string } | undefined
  if (data.itemIdName) {
    try {
      const itemResp = await fetchAndValidate<ItemApiResponse>(`https://pokeapi.co/api/v2/item/${data.itemIdName}`, ItemApiResponseSchema)
      item = {
        name: formatName(itemResp.name),
        description: getBestEnglishDescription(itemResp),
      }
    } catch {
      item = {
        name: formatName(data.itemIdName),
        description: 'Could not fetch item data.',
      }
    }
  }

  return { types, abilities, moves, baseStats, item }
}

/**
 * React hook for accessing and managing Pokémon party data and details.
 * This is a compatibility layer that uses Zustand stores but maintains the same API.
 */
export const usePokemonData = () => {
  // Get state from Zustand stores
  const { activePokemonId, partyList, setActivePokemonId, setPartyList, setEvIndex, setIvIndex, setNature, getRemainingEvs, resetPokemonData } = usePokemonStore()

  // Get save file state
  const saveData = useSaveFileStore(state => state.saveData)
  const saveFileParser = useSaveFileStore()
  const saveSessionId = useSaveFileStore(state => state.saveSessionId)

  const queryClient = useQueryClient()

  // Initialize party list when save data changes
  useEffect(() => {
    if (!saveData?.party_pokemon) {
      resetPokemonData()
      return
    }

    const initialPartyList = buildPartyListFromSaveData(saveData)
    setPartyList(initialPartyList)

    // Clear cached pokemon details to avoid stale data after loading a new file
    queryClient.removeQueries({ queryKey: ['pokemon', 'details'] })
  }, [saveData, setPartyList, resetPokemonData, queryClient])

  // Get the current active Pokémon
  const activePokemon = partyList.find((p: UIPokemonData) => p.id === activePokemonId)

  // Query for details of the active Pokémon
  const {
    data: detailedData,
    isLoading,
    isError,
    error,
  } = useQuery({
    // Include saveSessionId and speciesId to isolate per loaded save/species
    queryKey: ['pokemon', 'details', saveSessionId, activePokemon?.data?.speciesId ?? 'none', String(activePokemonId)],
    queryFn: () => (activePokemon ? getPokemonDetails(activePokemon) : Promise.reject(new Error('No active Pokémon'))),
    enabled: activePokemonId >= 0 && !!activePokemon,
    staleTime: 1000 * 60 * 60, // 1 hour
  })

  // Update partyList with detailed data
  useEffect(() => {
    if (!detailedData || activePokemonId < 0) return
    usePokemonStore.setState(prevState => ({
      partyList: prevState.partyList.map(p => (p.id === activePokemonId ? { ...p, details: detailedData } : p)),
    }))
  }, [detailedData, activePokemonId])

  // Preload details for a given party member by id
  const preloadPokemonDetails = useCallback(
    async (id: number) => {
      const pokemon = partyList.find((p: UIPokemonData) => p.id === id)
      if (!pokemon) return
      await queryClient.prefetchQuery({
        queryKey: ['pokemon', 'details', saveSessionId, pokemon.data.speciesId, String(id)],
        queryFn: () => getPokemonDetails(pokemon),
        staleTime: 1000 * 60 * 60,
      })
    },
    [partyList, queryClient, saveSessionId]
  )

  return {
    partyList,
    activePokemonId,
    setActivePokemonId,
    activePokemon: partyList.find(p => p.id === activePokemonId),
    isLoading,
    isError,
    error,
    saveFileParser,
    setEvIndex,
    setIvIndex,
    setNature,
    preloadPokemonDetails,
    getRemainingEvs,
  }
}
