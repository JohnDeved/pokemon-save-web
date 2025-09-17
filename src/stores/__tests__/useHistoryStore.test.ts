import { describe, expect, afterEach, beforeEach, it, vi } from 'vitest'
import type { PokemonSaveParser } from '@/lib/parser/core/PokemonSaveParser'
import { useHistoryStore } from '@/stores/useHistoryStore'
import { useSaveFileStore } from '@/stores/useSaveFileStore'
import { usePokemonStore } from '@/stores/usePokemonStore'

const flushTimers = () => {
  vi.runOnlyPendingTimers()
  vi.clearAllTimers()
}

describe('useHistoryStore snapshots', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useSaveFileStore.setState({
      parser: {
        reconstructSaveFile: () => new Uint8Array([42]),
      } as unknown as PokemonSaveParser,
      saveData: {
        party_pokemon: [],
      } as never,
      hasFile: true,
    })

    usePokemonStore.setState({
      partyList: [{ id: 1 } as never],
    })

    useHistoryStore.setState({
      past: [],
      future: [],
      initial: null,
      isApplying: false,
      queuedSnapshot: null,
      queueTimer: null,
    })
  })

  afterEach(() => {
    const timer = useHistoryStore.getState().queueTimer
    if (timer) clearTimeout(timer)
    useHistoryStore.setState({
      past: [],
      future: [],
      initial: null,
      isApplying: false,
      queuedSnapshot: null,
      queueTimer: null,
    })
    useSaveFileStore.setState({ parser: null, saveData: null, hasFile: false })
    usePokemonStore.setState({ partyList: [], pendingIdsBySlot: null })
    flushTimers()
    vi.useRealTimers()
  })

  it('skips pushing identical snapshots', () => {
    const history = useHistoryStore.getState()
    history.snapshot()
    history.snapshot()
    expect(useHistoryStore.getState().past).toHaveLength(1)
  })

  it('coalesces queued snapshots to the latest state before flush', () => {
    let seed = 1
    useSaveFileStore.setState({
      parser: {
        reconstructSaveFile: () => new Uint8Array([seed++]),
      } as unknown as PokemonSaveParser,
      hasFile: true,
      saveData: {
        party_pokemon: [],
      } as never,
    })

    const history = useHistoryStore.getState()
    history.queueSnapshot(200, [1])
    history.queueSnapshot(200, [2])

    expect(useHistoryStore.getState().queuedSnapshot?.idsBySlot).toEqual([2])

    vi.advanceTimersByTime(200)

    const { past } = useHistoryStore.getState()
    expect(past).toHaveLength(1)
    expect(past[0]?.idsBySlot).toEqual([2])
    expect([...(past[0]?.bytes ?? [])]).toEqual([2])
  })
})
