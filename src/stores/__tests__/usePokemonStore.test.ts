import { describe, expect, beforeEach, afterEach, it } from 'vitest'
import type { PokemonBase } from '@/lib/parser/core/PokemonBase'
import type { SaveData } from '@/lib/parser/core/types'
import { buildPartyListFromSaveData, usePokemonStore } from '@/stores/usePokemonStore'

const createPokemon = (overrides: Partial<PokemonBase> = {}): PokemonBase => {
  return {
    isShiny: false,
    isRadiant: false,
    speciesId: 1,
    nameId: 'bulbasaur',
    data: {
      moves: {},
    },
    ...overrides,
  } as PokemonBase
}

describe('buildPartyListFromSaveData', () => {
  beforeEach(() => {
    usePokemonStore.setState({
      activePokemonId: -1,
      partyList: [],
      megaPreview: {},
      nextUiId: 1,
      pendingIdsBySlot: null,
    })
  })

  afterEach(() => {
    usePokemonStore.setState({
      activePokemonId: -1,
      partyList: [],
      megaPreview: {},
      nextUiId: 1,
      pendingIdsBySlot: null,
    })
  })

  const baseSaveData = (party_pokemon: PokemonBase[]): SaveData =>
    ({
      party_pokemon,
      player_name: 'RED',
      play_time: { hours: 0, minutes: 0, seconds: 0 },
      active_slot: 1,
    }) as SaveData

  it('reuses pending ids and clears them via setState', () => {
    usePokemonStore.setState({
      partyList: [],
      pendingIdsBySlot: [10, 20],
      nextUiId: 5,
    })

    const party = buildPartyListFromSaveData(baseSaveData([createPokemon(), createPokemon()]))

    expect(party.map(p => p.id)).toEqual([10, 20])
    const state = usePokemonStore.getState()
    expect(state.pendingIdsBySlot).toBeNull()
    expect(state.nextUiId).toBe(5)
  })

  it('allocates new ids without mutating store snapshot', () => {
    usePokemonStore.setState({
      partyList: [],
      pendingIdsBySlot: null,
      nextUiId: 3,
    })

    const party = buildPartyListFromSaveData(baseSaveData([createPokemon({ speciesId: 2 }), createPokemon({ speciesId: 3 })]))

    expect(party.map(p => p.id)).toEqual([3, 4])
    const state = usePokemonStore.getState()
    expect(state.nextUiId).toBe(5)
  })
})
