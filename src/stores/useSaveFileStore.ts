import { saveAs } from 'file-saver'
import { toast } from 'sonner'
import { create } from 'zustand'
import { PokemonSaveParser } from '../lib/parser/core/PokemonSaveParser'
import type { SaveData } from '../lib/parser/core/types'
import type { GlobalThisWithFileSystemAPI } from '../types/global'

export interface SaveFileState {
  saveData: SaveData | null
  isLoading: boolean
  error: string | null
  hasFile: boolean
  lastParseFailed: boolean
  parser: PokemonSaveParser | null
}

export interface SaveFileActions {
  parse: (file: File) => Promise<SaveData>
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

  // Actions
  parse: async (file: File) => {
    set({ isLoading: true, error: null, lastParseFailed: false })
    try {
      const parser = new PokemonSaveParser()
      const saveData = await parser.parse(file)
      set({
        saveData,
        isLoading: false,
        error: null,
        hasFile: true,
        lastParseFailed: false,
        parser,
      })
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
    set({
      saveData: null,
      isLoading: false,
      error: null,
      hasFile: false,
      lastParseFailed: false,
      parser: null,
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
        const globalAPI = globalThis as unknown as GlobalThisWithFileSystemAPI
        if (!globalAPI.showSaveFilePicker) {
          throw new Error('File System Access API not supported')
        }
        const handle = await globalAPI.showSaveFilePicker({
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
