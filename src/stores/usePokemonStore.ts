import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { create } from 'zustand'
import { calculateTotalStats, natures } from '@/lib/parser/core/utils'
import type { UIPokemonData } from '../types'
import { useSaveFileStore } from './useSaveFileStore'

// Constants
const MAX_EV_PER_STAT = 252
const MAX_TOTAL_EVS = 508

export interface PokemonState {
  activePokemonId: number
  partyList: UIPokemonData[]
}

export interface PokemonActions {
  setActivePokemonId: (id: number) => void
  setPartyList: (partyList: UIPokemonData[]) => void
  setEvIndex: (pokemonId: number, statIndex: number, evValue: number) => void
  setIvIndex: (pokemonId: number, statIndex: number, ivValue: number) => void
  setNature: (pokemonId: number, nature: string) => void
  getRemainingEvs: (pokemonId: number) => number
  resetPokemonData: () => void
}

export type PokemonStore = PokemonState & PokemonActions

export const usePokemonStore = create<PokemonStore>((set, get) => ({
  // Initial state
  activePokemonId: 0,
  partyList: [],

  // Actions
  setActivePokemonId: (id: number) => {
    set({ activePokemonId: id })
  },

  setPartyList: (partyList: UIPokemonData[]) => {
    set({ partyList })
  },

  setEvIndex: (pokemonId: number, statIndex: number, evValue: number) => {
    set((state) => ({
      partyList: state.partyList.map(p => {
        if (p.id !== pokemonId || !p.details) return p

        // Validate EV constraints
        const clampedEvValue = Math.max(0, Math.min(MAX_EV_PER_STAT, evValue))

        // Calculate current total EVs excluding the stat being changed
        const currentEvs = p.data.evs
        const otherEvsTotal = currentEvs.reduce((sum, ev, index) =>
          index === statIndex ? sum : sum + ev, 0,
        )

        // Ensure total EVs don't exceed limit
        const maxAllowedForThisStat = Math.min(
          MAX_EV_PER_STAT,
          MAX_TOTAL_EVS - otherEvsTotal,
        )
        const finalEvValue = Math.min(clampedEvValue, maxAllowedForThisStat)

        // Only update if the value actually changed
        if (currentEvs[statIndex] === finalEvValue) return p

        // Directly mutate the class instance
        p.data.setEvByIndex(statIndex, finalEvValue)
        p.data.setStats(calculateTotalStats(p.data, p.details.baseStats))
        // Return a new object reference for React to detect change
        return { ...p }
      })
    }))
  },

  setIvIndex: (pokemonId: number, statIndex: number, ivValue: number) => {
    set((state) => ({
      partyList: state.partyList.map(p => {
        if (p.id !== pokemonId || !p.details) return p

        // Only update if the value actually changed
        if (p.data.ivs[statIndex] === ivValue) return p

        // Directly mutate the class instance
        p.data.setIvByIndex(statIndex, ivValue)
        p.data.setStats(calculateTotalStats(p.data, p.details.baseStats))
        // Return a new object reference for React to detect change
        return { ...p }
      })
    }))
  },

  setNature: (pokemonId: number, nature: string) => {
    set((state) => ({
      partyList: state.partyList.map(p => {
        const natureValue = natures.indexOf(nature)
        if (p.id !== pokemonId || !p.details) return p
        // Only update if the value actually changed
        if (p.data.natureRaw === natureValue) return p
        p.data.setNatureRaw(natureValue)
        // Optionally, recalculate stats if needed
        p.data.setStats(calculateTotalStats(p.data, p.details.baseStats))
        return { ...p }
      })
    }))
  },

  getRemainingEvs: (pokemonId: number) => {
    const { partyList } = get()
    const pokemon = partyList.find(p => p.id === pokemonId)
    if (!pokemon) return MAX_TOTAL_EVS
    const totalEvs = pokemon.data.evs.reduce((sum, ev) => sum + ev, 0)
    return Math.max(0, MAX_TOTAL_EVS - totalEvs)
  },

  resetPokemonData: () => {
    set({
      activePokemonId: 0,
      partyList: [],
    })
  },
}))

// Helper hook to initialize Pokemon data from save data
export const usePokemonDataSync = () => {
  const saveData = useSaveFileStore(state => state.saveData)
  const { setPartyList, resetPokemonData } = usePokemonStore()
  const queryClient = useQueryClient()

  // Build the initial party list from save data
  const initialPartyList = useMemo(() => {
    if (!saveData?.party_pokemon) return []
    return saveData.party_pokemon.map((parsedPokemon, index) => {
      // Use the isShiny property which correctly implements vanilla (shinyNumber < 8) and Quetzal logic
      const isShiny = parsedPokemon.isShiny
      const SPRITE_BASE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'
      const spriteUrl = isShiny
        ? `${SPRITE_BASE_URL}/shiny/${parsedPokemon.speciesId}.png`
        : `${SPRITE_BASE_URL}/${parsedPokemon.speciesId}.png`

      const SPRITE_ANI_BASE_URL = '/sprites'
      const spriteAniUrl = isShiny
        ? `${SPRITE_ANI_BASE_URL}/shiny/${parsedPokemon.nameId}.gif`
        : `${SPRITE_ANI_BASE_URL}/${parsedPokemon.nameId}.gif`
      return {
        id: index,
        spriteUrl,
        spriteAniUrl,
        data: parsedPokemon,
      }
    })
  }, [saveData])

  // When saveData changes, reset partyList and activePokemonId to avoid stale details
  useMemo(() => {
    if (initialPartyList.length === 0) {
      resetPokemonData()
    } else {
      setPartyList(initialPartyList)
    }
    // Clear cached pokemon details to avoid stale data after loading a new file
    queryClient.removeQueries({ queryKey: ['pokemon', 'details'] })
  }, [initialPartyList, queryClient, setPartyList, resetPokemonData])

  return initialPartyList
}