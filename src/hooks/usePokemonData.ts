import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PokeAPI } from 'pokeapi-types/dist/index'
import { useCallback, useEffect } from 'react'
import { buildPartyListFromSaveData, usePokemonStore, useSaveFileStore } from '../stores'
import { type MoveWithDetails, type PokemonType, PokemonTypeSchema, type UIPokemonData, type Ability as UiAbility } from '../types'

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
const formatName = (name: string): string =>
  name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

const parsePokemonType = (apiType: string): PokemonType => {
  const result = PokemonTypeSchema.safeParse(apiType.toUpperCase())
  return result.success ? result.data : UNKNOWN_TYPE
}

// Lightweight fetch helper: rely on PokeAPI TypeScript types + targeted guards
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch from ${url}: ${response.statusText}`)
  return (await response.json()) as T
}

// Pick best English effect text if present
function pickEnglishEffect(entries: PokeAPI.VerboseEffect[] | undefined): string | undefined {
  if (!Array.isArray(entries)) return undefined
  const e = entries.find(x => x.language?.name === 'en')
  return e?.effect
}

// Pick latest English flavor text (based on trailing numeric id in version/version_group URL)
function pickLatestEnglishFlavorText(
  entries:
    | { flavor_text: string; language: { name: string }; version_group?: { url: string }; version?: { url: string } }[]
    | undefined
): string | undefined {
  if (!Array.isArray(entries)) return undefined
  let best: { text: string; id: number } | undefined
  for (const entry of entries) {
    if (entry.language?.name !== 'en') continue
    const url = entry.version_group?.url ?? entry.version?.url ?? ''
    const id = (() => {
      const m = url.match(/\/(\d+)\/?$/)
      return m ? parseInt(m[1]!, 10) : 0
    })()
    const text = entry.flavor_text
    if (!text) continue
    if (!best || id > best.id) best = { text, id }
  }
  return best?.text?.replace(/\s+/g, ' ').trim()
}

function getAbilityDescription(ability: PokeAPI.Ability): string {
  return (
    pickEnglishEffect(ability.effect_entries) ||
    pickLatestEnglishFlavorText(ability.flavor_text_entries) ||
    'No description available.'
  )
}

function getMoveDescription(move: PokeAPI.Move): string {
  return (
    pickEnglishEffect(move.effect_entries) ||
    pickLatestEnglishFlavorText(move.flavor_text_entries) ||
    'No description available.'
  )
}

/**
 * Fetches all details for a Pokémon, including moves and abilities.
 */
async function getPokemonDetails(pokemon: UIPokemonData) {
  const { data } = pokemon
  const pokeData = await fetchJson<PokeAPI.Pokemon>(
    `https://pokeapi.co/api/v2/pokemon/${data.speciesId}`
  )
  const moveSources = [data.moves.move1, data.moves.move2, data.moves.move3, data.moves.move4]
  const moveResults = await Promise.all(
    moveSources.map(move =>
      move.id === 0
        ? null
        : fetchJson<PokeAPI.Move>(`https://pokeapi.co/api/v2/move/${move.id}`).catch(
            () => null
          )
    )
  )
  const abilityEntries = pokeData.abilities
  const abilities: UiAbility[] = await Promise.all(
    abilityEntries.map(async entry => {
      try {
        const abilityData = await fetchJson<PokeAPI.Ability>(entry.ability.url)
        return {
          slot: entry.slot,
          name: formatName(abilityData.name),
          description: getAbilityDescription(abilityData),
        }
      } catch {
        return {
          slot: entry.slot,
          name: entry.ability.name,
          description: 'Could not fetch ability data.',
        }
      }
    })
  )
  const types = pokeData.types.map(t => parsePokemonType(t.type.name))
  // Extract base stats in correct order
  const baseStats = ['hp', 'attack', 'defense', 'speed', 'special-attack', 'special-defense'].map(
    stat => pokeData.stats.find(s => s.stat?.name === stat)?.base_stat ?? 0
  )
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
          description: getMoveDescription(validMove),
          power: validMove.power ?? null,
          accuracy: validMove.accuracy ?? null,
        damageClass:
          validMove.damage_class?.name === 'physical' ||
          validMove.damage_class?.name === 'special' ||
          validMove.damage_class?.name === 'status'
            ? validMove.damage_class.name
            : undefined,
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
  // Item details are fetched separately for fine-grained loading states
  return { types, abilities, moves, baseStats }
}

/**
 * React hook for accessing and managing Pokémon party data and details.
 * This is a compatibility layer that uses Zustand stores but maintains the same API.
 */
export const usePokemonData = () => {
  // Get state from Zustand stores using selectors to avoid over-subscribing
  const activePokemonId = usePokemonStore(s => s.activePokemonId)
  const partyList = usePokemonStore(s => s.partyList)
  const setActivePokemonId = usePokemonStore(s => s.setActivePokemonId)
  const setPartyList = usePokemonStore(s => s.setPartyList)
  const setEvIndex = usePokemonStore(s => s.setEvIndex)
  const setIvIndex = usePokemonStore(s => s.setIvIndex)
  const setNature = usePokemonStore(s => s.setNature)
  const getRemainingEvs = usePokemonStore(s => s.getRemainingEvs)
  const resetPokemonData = usePokemonStore(s => s.resetPokemonData)

  // Get save file state
  const saveData = useSaveFileStore(state => state.saveData)
  const saveSessionId = useSaveFileStore(state => state.saveSessionId)
  const lastUpdateTransient = useSaveFileStore(state => state.lastUpdateTransient)

  const queryClient = useQueryClient()

  // Initialize party list when save data changes
  useEffect(() => {
    if (!saveData?.party_pokemon) {
      resetPokemonData()
      return
    }

    // Skip rebuilding party list for transient reorder updates
    if (lastUpdateTransient && saveData.__transient__) {
      return
    }

    const initialPartyList = buildPartyListFromSaveData(saveData)

    if (lastUpdateTransient) {
      // Preserve existing details to avoid flashing during undo/redo/reset
      const prev = usePokemonStore.getState().partyList
      const prevById = new Map(prev.map(p => [p.id, p]))
      const merged = initialPartyList.map(p => {
        const prevP = prevById.get(p.id)
        return prevP && prevP.details ? { ...p, details: prevP.details } : p
      })
      setPartyList(merged)
      // Ensure active selection remains valid after history navigation
      const currentActive = usePokemonStore.getState().activePokemonId
      if (!merged.some(p => p.id === currentActive)) {
        setActivePokemonId(merged[0]?.id ?? -1)
      }
      // Do not clear queries on transient updates
    } else {
      setPartyList(initialPartyList)
      // Default selection to the first Pokémon when loading a new file
      setActivePokemonId(initialPartyList[0]?.id ?? -1)
      // Clear cached pokemon details to avoid stale data after loading a new file
      queryClient.removeQueries({ queryKey: ['pokemon', 'details'] })
    }
  }, [
    saveData,
    setPartyList,
    resetPokemonData,
    queryClient,
    lastUpdateTransient,
    setActivePokemonId,
  ])

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
    queryKey: [
      'pokemon',
      'details',
      saveSessionId,
      activePokemon?.data?.speciesId ?? 'none',
      String(activePokemonId),
    ],
    queryFn: () =>
      activePokemon
        ? getPokemonDetails(activePokemon)
        : Promise.reject(new Error('No active Pokémon')),
    enabled: activePokemonId >= 0 && !!activePokemon,
    staleTime: 1000 * 60 * 60, // 1 hour
  })

  // Update partyList with detailed data — moved below after itemDetails is declared to avoid TDZ issues

  // Item details are handled in a dedicated hook (useActiveItemDetails)

  // Update partyList with detailed data
  useEffect(() => {
    if (!detailedData || activePokemonId < 0) return
    usePokemonStore.setState(prevState => ({
      partyList: prevState.partyList.map(p => {
        if (p.id !== activePokemonId) return p
        // Preserve any existing item info set by setItemId, but don't depend on item query
        const prevItem = p.details?.item
        return { ...p, details: { ...detailedData, item: prevItem } }
      }),
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
    setEvIndex,
    setIvIndex,
    setNature,
    preloadPokemonDetails,
    getRemainingEvs,
  }
}
