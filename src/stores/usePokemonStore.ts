import { create } from 'zustand'
import type { PokemonBase } from '@/lib/parser/core/PokemonBase'
import type { SaveData } from '@/lib/parser/core/types'
import { calculateTotalStats, natures } from '@/lib/parser/core/utils'
import type { UIPokemonData } from '../types'
import { useHistoryStore } from './useHistoryStore'
import { useSaveFileStore } from './useSaveFileStore'

// Constants
const MAX_EV_PER_STAT = 252
const MAX_TOTAL_EVS = 508

export interface PokemonState {
  activePokemonId: number
  partyList: UIPokemonData[]
  megaPreview: Record<number, { enabled: boolean; form?: string }>
  // UI identity management (stable across reorders/undo within a session)
  nextUiId: number
  pendingIdsBySlot: number[] | null
}

export interface PokemonActions {
  setActivePokemonId: (id: number) => void
  setPartyList: (partyList: UIPokemonData[]) => void
  setEvIndex: (pokemonId: number, statIndex: number, evValue: number) => void
  setIvIndex: (pokemonId: number, statIndex: number, ivValue: number) => void
  setNature: (pokemonId: number, nature: string) => void
  setAbilitySlot: (pokemonId: number, slot: number) => void
  setItemId: (pokemonId: number, itemId: number | null) => void
  setMegaPreviewEnabled: (pokemonId: number, enabled: boolean) => void
  setMegaPreviewForm: (pokemonId: number, form: string | undefined) => void
  getRemainingEvs: (pokemonId: number) => number
  resetPokemonData: () => void
  clearPokemonDetails: () => void
  resetUiIdentities: () => void
  setPendingIdsBySlot: (ids: number[] | null) => void
  commitPartyReorder: (newOrder: UIPokemonData[], previousIds?: number[]) => void
}

export type PokemonStore = PokemonState & PokemonActions

export const usePokemonStore = create<PokemonStore>((set, get) => ({
  // Initial state
  activePokemonId: -1,
  partyList: [],
  megaPreview: {},
  nextUiId: 1,
  pendingIdsBySlot: null,

  // Actions
  setActivePokemonId: (id: number) => {
    set({ activePokemonId: id })
  },

  setPartyList: (partyList: UIPokemonData[]) => {
    set({ partyList })
  },

  setEvIndex: (pokemonId: number, statIndex: number, evValue: number) => {
    set(state => ({
      partyList: state.partyList.map(p => {
        if (p.id !== pokemonId || !p.details) return p

        // Validate EV constraints
        const clampedEvValue = Math.max(0, Math.min(MAX_EV_PER_STAT, evValue))

        // Calculate current total EVs excluding the stat being changed
        const currentEvs = p.data.evs
        const otherEvsTotal = currentEvs.reduce((sum, ev, index) => (index === statIndex ? sum : sum + ev), 0)

        // Ensure total EVs don't exceed limit
        const maxAllowedForThisStat = Math.min(MAX_EV_PER_STAT, MAX_TOTAL_EVS - otherEvsTotal)
        const finalEvValue = Math.min(clampedEvValue, maxAllowedForThisStat)

        // Only update if the value actually changed
        if (currentEvs[statIndex] === finalEvValue) return p
        useHistoryStore.getState().queueSnapshot()

        // Directly mutate the class instance
        p.data.setEvByIndex(statIndex, finalEvValue)
        p.data.setStats(calculateTotalStats(p.data, p.details.baseStats))
        // Return a new object reference for React to detect change
        return { ...p }
      }),
    }))
  },

  setIvIndex: (pokemonId: number, statIndex: number, ivValue: number) => {
    set(state => ({
      partyList: state.partyList.map(p => {
        if (p.id !== pokemonId || !p.details) return p

        // Only update if the value actually changed
        if (p.data.ivs[statIndex] === ivValue) return p
        useHistoryStore.getState().queueSnapshot()

        // Directly mutate the class instance
        p.data.setIvByIndex(statIndex, ivValue)
        p.data.setStats(calculateTotalStats(p.data, p.details.baseStats))
        // Return a new object reference for React to detect change
        return { ...p }
      }),
    }))
  },

  setNature: (pokemonId: number, nature: string) => {
    set(state => ({
      partyList: state.partyList.map(p => {
        const natureValue = natures.indexOf(nature)
        if (p.id !== pokemonId || !p.details) return p
        // Only update if the value actually changed
        if (p.data.natureRaw === natureValue) return p
        useHistoryStore.getState().queueSnapshot()
        p.data.setNatureRaw(natureValue)
        // Optionally, recalculate stats if needed
        p.data.setStats(calculateTotalStats(p.data, p.details.baseStats))
        return { ...p }
      }),
    }))
  },

  setAbilitySlot: (pokemonId: number, slot: number) => {
    set(state => ({
      partyList: state.partyList.map(p => {
        if (p.id !== pokemonId || !p.details) return p
        const desired = Math.max(0, Math.min(2, slot - 1))
        if (p.data.abilityNumber === desired) return p
        useHistoryStore.getState().queueSnapshot()
        p.data.abilityNumber = desired
        return { ...p }
      }),
    }))
  },

  setItemId: (pokemonId: number, itemId: number | null) => {
    set(state => ({
      partyList: state.partyList.map(p => {
        if (p.id !== pokemonId) return p
        // Skip if same item
        const desired = itemId ?? 0
        // PokemonBase.item is mapped external id
        // If equal, no change
        if (p.data.item === desired) return p
        useHistoryStore.getState().queueSnapshot()
        p.data.setItem(desired)
        // Update details immediately for name (description will refetch separately elsewhere)
        const idName = p.data.itemIdName
        if (p.details) {
          const prettyName = idName ? idName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'None'
          const newDetails = {
            ...p.details,
            item: idName
              ? {
                  name: prettyName,
                  description: p.details.item?.description ?? 'No description available.',
                }
              : undefined,
          }
          return { ...p, details: newDetails }
        }
        return { ...p }
      }),
    }))
  },

  setMegaPreviewEnabled: (pokemonId: number, enabled: boolean) => {
    set(state => ({
      megaPreview: {
        ...state.megaPreview,
        [pokemonId]: { ...(state.megaPreview[pokemonId] ?? { enabled: false }), enabled },
      },
    }))
  },

  setMegaPreviewForm: (pokemonId: number, form: string | undefined) => {
    set(state => ({
      megaPreview: {
        ...state.megaPreview,
        [pokemonId]: { ...(state.megaPreview[pokemonId] ?? { enabled: false }), form },
      },
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
      activePokemonId: -1,
      partyList: [],
    })
  },

  clearPokemonDetails: () => {
    set(state => ({
      partyList: state.partyList.map(p => ({ ...p, details: undefined })),
    }))
  },

  resetUiIdentities: () => {
    set({ nextUiId: 1, pendingIdsBySlot: null, megaPreview: {} })
  },

  setPendingIdsBySlot: (ids: number[] | null) => {
    set({ pendingIdsBySlot: ids })
  },

  commitPartyReorder: (newOrder: UIPokemonData[], previousIds?: number[]) => {
    set({ partyList: newOrder })
    try {
      useHistoryStore.getState().queueSnapshot(350, previousIds)
    } catch {}
    try {
      const bases = newOrder.map(p => p.data)
      useSaveFileStore.getState().updatePartyOrder(bases)
    } catch {}
  },
}))

// Helper function to build party list from save data
export const buildPartyListFromSaveData = (saveData: SaveData): UIPokemonData[] => {
  const { partyList: prevList, pendingIdsBySlot: pending, nextUiId: startingNextId } = usePokemonStore.getState()

  const usedIds = new Set<number>()
  let nextUiId = startingNextId

  const party = saveData.party_pokemon.map((parsedPokemon: PokemonBase, index: number) => {
    const { isShiny, isRadiant } = parsedPokemon
    const useAltSprite = isShiny || isRadiant
    const SPRITE_BASE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'
    const spriteUrl = useAltSprite ? `${SPRITE_BASE_URL}/shiny/${parsedPokemon.speciesId}.png` : `${SPRITE_BASE_URL}/${parsedPokemon.speciesId}.png`

    const SPRITE_ANI_BASE_URL = '/sprites'
    const spriteAniUrl = useAltSprite ? `${SPRITE_ANI_BASE_URL}/shiny/${parsedPokemon.nameId}.gif` : `${SPRITE_ANI_BASE_URL}/${parsedPokemon.nameId}.gif`

    let uiId: number | undefined = Array.isArray(pending) ? pending[index] : undefined
    if (uiId && usedIds.has(uiId)) uiId = undefined

    if (!uiId && prevList[index] && !usedIds.has(prevList[index]!.id)) {
      uiId = prevList[index]!.id
    }

    if (!uiId) {
      uiId = nextUiId
      nextUiId += 1
    }

    usedIds.add(uiId)
    return {
      id: uiId!,
      spriteUrl,
      spriteAniUrl,
      data: parsedPokemon,
    }
  })

  usePokemonStore.setState(state => ({
    pendingIdsBySlot: null,
    nextUiId: Math.max(state.nextUiId, nextUiId),
  }))

  return party
}
