/**
 * Test for IV toggle behavior in Pokemon Stat Display
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { usePokemonStore } from '@/stores/usePokemonStore'
import type { UIPokemonData } from '@/types'
import { PokemonBase } from '@/lib/parser/core/PokemonBase'

describe('IV Toggle Store Behavior', () => {
  beforeEach(() => {
    // Reset the store state before each test
    usePokemonStore.getState().resetPokemonData()
  })

  it('should set IV to max (31) when not at max', () => {
    // Create a mock Pokemon with IV of 15 for HP
    const mockPokemonData: UIPokemonData = {
      id: 1,
      spriteUrl: 'test.png',
      spriteAniUrl: 'test.gif',
      data: {
        ivs: [15, 20, 25, 10, 5, 30], // HP=15, others various
        evs: [0, 0, 0, 0, 0, 0],
        setIvByIndex: function(index: number, value: number) {
          this.ivs[index] = value
        },
        setStats: function() {},
      } as any as PokemonBase,
      details: {
        baseStats: [45, 49, 49, 65, 65, 45], // Treecko base stats
      } as any
    }

    // Set up the store with our mock Pokemon
    usePokemonStore.setState({
      partyList: [mockPokemonData],
      activePokemonId: 1
    })

    // Get the setIvIndex function
    const setIvIndex = usePokemonStore.getState().setIvIndex

    // Test: set HP IV (index 0) to 31 - should work normally
    setIvIndex(1, 0, 31)

    // Verify the IV was set to 31
    const updatedPokemon = usePokemonStore.getState().partyList[0]
    expect(updatedPokemon?.data.ivs[0]).toBe(31)
  })

  it('should set IV to 0 when at max (31)', () => {
    // Create a mock Pokemon with IV of 31 for HP
    const mockPokemonData: UIPokemonData = {
      id: 1,
      spriteUrl: 'test.png',
      spriteAniUrl: 'test.gif',
      data: {
        ivs: [31, 20, 25, 10, 5, 30], // HP=31, others various
        evs: [0, 0, 0, 0, 0, 0],
        setIvByIndex: function(index: number, value: number) {
          this.ivs[index] = value
        },
        setStats: function() {},
      } as any as PokemonBase,
      details: {
        baseStats: [45, 49, 49, 65, 65, 45], // Treecko base stats
      } as any
    }

    // Set up the store with our mock Pokemon
    usePokemonStore.setState({
      partyList: [mockPokemonData],
      activePokemonId: 1
    })

    // Get the setIvIndex function
    const setIvIndex = usePokemonStore.getState().setIvIndex

    // Test: set HP IV (index 0) to 0 - should work with new toggle behavior
    setIvIndex(1, 0, 0)

    // Verify the IV was set to 0
    const updatedPokemon = usePokemonStore.getState().partyList[0]
    expect(updatedPokemon?.data.ivs[0]).toBe(0)
  })

  it('should handle edge case IVs correctly', () => {
    // Create a mock Pokemon with edge case IVs
    const mockPokemonData: UIPokemonData = {
      id: 1,
      spriteUrl: 'test.png',
      spriteAniUrl: 'test.gif',
      data: {
        ivs: [1, 30, 0, 31, 15, 16], // Various edge cases
        evs: [0, 0, 0, 0, 0, 0],
        setIvByIndex: function(index: number, value: number) {
          this.ivs[index] = value
        },
        setStats: function() {},
      } as any as PokemonBase,
      details: {
        baseStats: [45, 49, 49, 65, 65, 45],
      } as any
    }

    usePokemonStore.setState({
      partyList: [mockPokemonData],
      activePokemonId: 1
    })

    const setIvIndex = usePokemonStore.getState().setIvIndex

    // Test setting IV=1 to 31
    setIvIndex(1, 0, 31)
    expect(usePokemonStore.getState().partyList[0]?.data.ivs[0]).toBe(31)

    // Test setting IV=30 to 31
    setIvIndex(1, 1, 31)
    expect(usePokemonStore.getState().partyList[0]?.data.ivs[1]).toBe(31)

    // Test setting IV=0 to 31
    setIvIndex(1, 2, 31)
    expect(usePokemonStore.getState().partyList[0]?.data.ivs[2]).toBe(31)

    // Test setting IV=31 to 0
    setIvIndex(1, 3, 0)
    expect(usePokemonStore.getState().partyList[0]?.data.ivs[3]).toBe(0)
  })
})