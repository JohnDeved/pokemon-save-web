import { saveAs } from 'file-saver'
import { toast } from 'sonner'
import { create } from 'zustand'
import { addRecent } from '@/lib/recentFiles'
import { PokemonSaveParser } from '../lib/parser/core/PokemonSaveParser'
import type { SaveData } from '../lib/parser/core/types'
import { usePokemonStore } from './usePokemonStore'
import { useSettingsStore } from './useSettingsStore'

export interface SaveFileState {
  saveData: SaveData | null
  isLoading: boolean
  error: string | null
  hasFile: boolean
  lastParseFailed: boolean
  parser: PokemonSaveParser | null
  // Increments each time a new save file is successfully loaded or cleared
  saveSessionId: number
  // True when last parse was a transient state update (e.g. undo/redo/reset)
  lastUpdateTransient: boolean
}

export interface SaveFileActions {
  // Accept same inputs as PokemonSaveParser.parse to preserve file handle where possible
  parse: (input: File | ArrayBuffer | FileSystemFileHandle, options?: { transient?: boolean }) => Promise<SaveData>
  clearSaveFile: () => void
  reconstructAndDownload: (method?: 'download' | 'saveAs' | 'save') => Promise<void>
}

export type SaveFileStore = SaveFileState & SaveFileActions

export const useSaveFileStore = create<SaveFileStore>((set, get) => ({
  // Initial state
  saveData: null,
  isLoading: false,
  error: null,
  hasFile: false,
  lastParseFailed: false,
  parser: null,
  saveSessionId: 0,
  lastUpdateTransient: false,

  // Actions
  parse: async (input: File | ArrayBuffer | FileSystemFileHandle, options?: { transient?: boolean }) => {
    const transient = Boolean(options?.transient)
    // For non-transient parses (i.e., loading a new file), clear details and bump session
    if (!transient) {
      try {
        usePokemonStore.getState().clearPokemonDetails()
        // Reset UI identity map when loading a brand new file
        usePokemonStore.getState().resetUiIdentities()
      } catch {}
      set(state => ({ isLoading: true, error: null, lastParseFailed: false, saveSessionId: state.saveSessionId + 1 }))
    } else {
      // Keep UI steady; do not toggle isLoading or bump session
      set({ error: null, lastParseFailed: false })
    }
    try {
      // Reuse existing parser instance to preserve fileHandle (for Save button)
      let { parser } = get()
      if (!parser) parser = new PokemonSaveParser()

      const saveData = await parser.parse(input)
      set({
        saveData,
        isLoading: false,
        error: null,
        hasFile: true,
        lastParseFailed: false,
        parser, // keep the same instance so fileHandle persists
        lastUpdateTransient: transient,
      })
      // Opening a new file re-enables auto-restore behavior
      if (!transient) {
        try {
          useSettingsStore.getState().setSuppressAutoRestore(false)
        } catch {}
      }
      if (!transient) {
        try {
          if (parser.fileHandle) {
            await addRecent(parser.fileHandle, parser.saveFileName ?? 'Save file')
          }
        } catch {}
      }
      return saveData
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse save file'
      set({
        isLoading: false,
        error: errorMessage,
        lastParseFailed: true,
      })
      throw error
    }
  },

  clearSaveFile: () => {
    try {
      usePokemonStore.getState().resetUiIdentities()
    } catch {}
    set({
      saveData: null,
      isLoading: false,
      error: null,
      hasFile: false,
      lastParseFailed: false,
      parser: null,
      // Also bump session to ensure UI clears any derived local state
      saveSessionId: get().saveSessionId + 1,
      lastUpdateTransient: false,
    })
  },

  reconstructAndDownload: async (method: 'download' | 'saveAs' | 'save' = 'download') => {
    const { saveData, parser } = get()
    if (!saveData || !parser) {
      throw new Error('No save data loaded')
    }

    // Use the same parser instance
    const newSave = parser.reconstructSaveFile(saveData.party_pokemon)
    const blob = new Blob([newSave], { type: 'application/octet-stream' })
    const defaultFileName = parser.saveFileName ?? 'pokemon_save.sav'

    if (method === 'saveAs') {
      try {
        if (typeof showSaveFilePicker !== 'function') {
          throw new Error('File System Access API not supported')
        }
        const handle = await showSaveFilePicker({
          suggestedName: defaultFileName,
          types: [
            {
              description: 'Pokémon Save File',
              accept: { 'application/octet-stream': ['.sav', '.sa2'] },
            },
          ],
        })
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
        // Persist the new handle so subsequent 'Save' is enabled
        parser.fileHandle = handle
        // Update display name if available
        if (typeof handle.name === 'string' && handle.name) {
          parser.saveFileName = handle.name
        }
        // Trigger store update with current parser reference
        set({ parser })
        return
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        toast.error(message, {
          position: 'bottom-center',
          duration: 5000,
        })
        return
      }
    }

    if (method === 'save') {
      if (!parser.fileHandle) {
        toast.error('No file handle available for saving', {
          position: 'bottom-center',
          duration: 3000,
        })
        return
      }
      const writable = await parser.fileHandle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    }

    // 'download' method always uses file-saver
    saveAs(blob, defaultFileName)
  },
}))
