import { saveAs } from 'file-saver'
import { useReducer, useRef } from 'react'
import { toast } from 'sonner'
import { PokemonSaveParser } from '../lib/parser/core/PokemonSaveParser'
import type { SaveData } from '../lib/parser/core/types'

export interface SaveFileParserState {
  saveData: SaveData | null
  isLoading: boolean
  error: string | null
  hasFile: boolean
  lastParseFailed: boolean
}

export const useSaveFileParser = () => {
  const initialState: SaveFileParserState = {
    saveData: null,
    isLoading: false,
    error: null,
    hasFile: false,
    lastParseFailed: false,
  }

  type Action =
    | { type: 'PARSE_START' }
    | { type: 'PARSE_SUCCESS', saveData: SaveData }
    | { type: 'PARSE_ERROR', error: string }
    | { type: 'CLEAR' }

  function reducer (state: SaveFileParserState, action: Action): SaveFileParserState {
    switch (action.type) {
      case 'PARSE_START':
        return { ...state, isLoading: true, error: null, lastParseFailed: false }
      case 'PARSE_SUCCESS':
        return {
          saveData: action.saveData,
          isLoading: false,
          error: null,
          hasFile: true,
          lastParseFailed: false,
        }
      case 'PARSE_ERROR':
        return {
          ...state,
          isLoading: false,
          error: action.error,
          lastParseFailed: true,
        }
      case 'CLEAR':
        return { ...initialState }
      default:
        return state
    }
  }

  const [state, dispatch] = useReducer(reducer, initialState)

  const parserRef = useRef<PokemonSaveParser | null>(null)

  async function parseSaveFile (file: File) {
    dispatch({ type: 'PARSE_START' })
    try {
      const parser = new PokemonSaveParser()
      const saveData = await parser.parseSaveFile(file)
      parserRef.current = parser
      dispatch({ type: 'PARSE_SUCCESS', saveData })
      return saveData
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse save file'
      dispatch({ type: 'PARSE_ERROR', error: errorMessage })
      throw error
    }
  }

  function clearSaveFile () {
    dispatch({ type: 'CLEAR' })
  }

  type SaveMethod = 'download' | 'saveAs' | 'save'
  async function reconstructAndDownload (method: SaveMethod = 'download') {
    if (!state.saveData || !parserRef.current) {
      throw new Error('No save data loaded')
    }
    // Use the same parser instance
    const newSave = parserRef.current.reconstructSaveFile(state.saveData.party_pokemon)
    const blob = new Blob([newSave], { type: 'application/octet-stream' })
    const defaultFileName = parserRef.current.saveFileName ?? 'pokemon_save.sav'

    if (method === 'saveAs') {
      try {
        const handle = await window.showSaveFilePicker({
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
        return toast.error(message, {
          position: 'bottom-center',
          duration: 5000,
        })
      }
    }

    if (method === 'save') {
      if (!parserRef.current.fileHandle) {
        return toast.error('No file handle available for saving', {
          position: 'bottom-center',
          duration: 3000,
        })
      }
      const writable = await parserRef.current.fileHandle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    }

    // 'download' method always uses file-saver
    saveAs(blob, defaultFileName)
  // ...existing code...
  }

  return {
    ...state,
    parseSaveFile,
    clearSaveFile,
    reconstructAndDownload,
    parser: parserRef.current,
  }
}
