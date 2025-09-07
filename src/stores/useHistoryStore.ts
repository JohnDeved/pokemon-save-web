import { create } from 'zustand'
import { useSaveFileStore } from './useSaveFileStore'

interface HistoryState {
  // Snapshots of full save bytes
  past: Uint8Array[]
  future: Uint8Array[]
  initial: Uint8Array | null
  isApplying: boolean
  queuedSnapshot: Uint8Array | null
  queueTimer: ReturnType<typeof setTimeout> | null
}

interface HistoryActions {
  // Capture current state into past and clear future
  snapshot: () => void
  // Debounced leading-edge snapshot (coalesces rapid changes)
  queueSnapshot: (delayMs?: number) => void
  // Reset stacks and set initial from current state
  initFromCurrent: () => void
  // Clear all history (used when clearing file)
  clear: () => void
  // Navigate history
  undo: () => Promise<void>
  redo: () => Promise<void>
  reset: () => Promise<void>
}

export type HistoryStore = HistoryState & HistoryActions

// Helper to get current save bytes via parser
function getCurrentSaveBytes(): Uint8Array | null {
  const { saveData, parser } = useSaveFileStore.getState()
  if (!saveData || !parser) return null
  try {
    return parser.reconstructSaveFile(saveData.party_pokemon)
  } catch {
    return null
  }
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  past: [],
  future: [],
  initial: null,
  isApplying: false,
  queuedSnapshot: null,
  queueTimer: null,

  snapshot: () => {
    const bytes = getCurrentSaveBytes()
    if (!bytes) return
    // Avoid duplicate snapshots if the latest past equals current
    const { past } = get()
    const last = past[past.length - 1]
    if (last && last.length === bytes.length) {
      // Quick byte-by-byte equality check on first and last few bytes to avoid heavy comparisons
      let same = true
      if (bytes[0] !== last[0] || bytes[bytes.length - 1] !== last[last.length - 1]) same = false
      if (same) {
        // fall back to shallow compare of small prefix
        for (let i = 0; i < 16 && i < bytes.length; i++) {
          if (bytes[i] !== last[i]) {
            same = false
            break
          }
        }
      }
      if (same) {
        // still push to keep behavior predictable — but optionally skip
      }
    }
    set({ past: [...past, bytes], future: [] })
  },

  queueSnapshot: (delayMs = 350) => {
    const state = get()
    if (state.isApplying) return
    if (state.queuedSnapshot) return
    const bytes = getCurrentSaveBytes()
    if (!bytes) return
    const timer = setTimeout(() => {
      const { queuedSnapshot, past } = get()
      if (queuedSnapshot) {
        set({ past: [...past, queuedSnapshot], queuedSnapshot: null, queueTimer: null, future: [] })
      } else {
        set({ queueTimer: null })
      }
    }, delayMs)
    set({ queuedSnapshot: bytes, queueTimer: timer })
  },

  initFromCurrent: () => {
    const bytes = getCurrentSaveBytes()
    // Clear any queued snapshot timer
    const { queueTimer } = get()
    if (queueTimer) clearTimeout(queueTimer)
    set({ initial: bytes, past: [], future: [], queuedSnapshot: null, queueTimer: null })
  },

  clear: () => {
    const { queueTimer } = get()
    if (queueTimer) clearTimeout(queueTimer)
    set({ past: [], future: [], initial: null, queuedSnapshot: null, queueTimer: null })
  },

  undo: async () => {
    if (get().isApplying) return
    // Flush any queued snapshot so it's available as undo target
    const stateBefore = get()
    if (stateBefore.queuedSnapshot) {
      if (stateBefore.queueTimer) clearTimeout(stateBefore.queueTimer)
      set({ past: [...stateBefore.past, stateBefore.queuedSnapshot], queuedSnapshot: null, queueTimer: null })
    }
    const currentPast = get().past
    if (currentPast.length === 0) return
    const current = getCurrentSaveBytes()
    if (!current) return
    const previous = currentPast[currentPast.length - 1]!
    set({ isApplying: true })
    try {
      // Move current to future, pop previous from past, then parse previous
      set(state => ({ future: [...state.future, current], past: state.past.slice(0, -1) }))
      const { parse } = useSaveFileStore.getState()
      await parse(previous.buffer.slice(previous.byteOffset, previous.byteOffset + previous.byteLength), { transient: true })
    } finally {
      set({ isApplying: false })
    }
  },

  redo: async () => {
    if (get().isApplying) return
    // Flush queued snapshot if present
    const stateBefore = get()
    if (stateBefore.queuedSnapshot) {
      if (stateBefore.queueTimer) clearTimeout(stateBefore.queueTimer)
      set({ past: [...stateBefore.past, stateBefore.queuedSnapshot], queuedSnapshot: null, queueTimer: null })
    }
    const { future } = get()
    if (future.length === 0) return
    const current = getCurrentSaveBytes()
    if (!current) return
    const next = future[future.length - 1]!
    set({ isApplying: true })
    try {
      // Move current to past, pop next from future, then parse next
      set(state => ({ past: [...state.past, current], future: state.future.slice(0, -1) }))
      const { parse } = useSaveFileStore.getState()
      await parse(next.buffer.slice(next.byteOffset, next.byteOffset + next.byteLength), { transient: true })
    } finally {
      set({ isApplying: false })
    }
  },

  reset: async () => {
    if (get().isApplying) return
    // Flush queued snapshot (though reset uses initial)
    const stateBefore = get()
    if (stateBefore.queuedSnapshot) {
      if (stateBefore.queueTimer) clearTimeout(stateBefore.queueTimer)
      set({ past: [...stateBefore.past, stateBefore.queuedSnapshot], queuedSnapshot: null, queueTimer: null })
    }
    const { initial } = get()
    if (!initial) return
    set({ isApplying: true })
    try {
      const { parse } = useSaveFileStore.getState()
      await parse(initial.buffer.slice(initial.byteOffset, initial.byteOffset + initial.byteLength), { transient: true })
      // After reset, clear history to reflect fresh baseline
      set(() => ({ past: [], future: [] }))
    } finally {
      set({ isApplying: false })
    }
  },
}))

export function canUndoSelector(s: HistoryStore): boolean {
  return s.past.length > 0 && !s.isApplying
}

export function canRedoSelector(s: HistoryStore): boolean {
  return s.future.length > 0 && !s.isApplying
}

export function hasEditsSelector(s: HistoryStore): boolean {
  return s.past.length > 0 && !s.isApplying
}
