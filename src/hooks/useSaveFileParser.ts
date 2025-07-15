import { useState, useCallback, useRef } from 'react';
import { PokemonSaveParser } from '../lib/parser';
import type { SaveData } from '../lib/parser/types';
import { saveAs } from 'file-saver';
import type { PokemonData } from '../lib/parser/pokemonSaveParser';

export interface SaveFileParserState {
  saveData: SaveData | null;
  isLoading: boolean;
  error: string | null;
  hasFile: boolean;
}

export const useSaveFileParser = () => {
  const [state, setState] = useState<SaveFileParserState>({
    saveData: null,
    isLoading: false,
    error: null,
    hasFile: false,
  });

  const parserRef = useRef<PokemonSaveParser | null>(null);

  const parseSaveFile = useCallback(async (file: File) => {
    setState(prev => ({ ...prev, error: null }));
    try {
      const parser = new PokemonSaveParser();
      const saveData = await parser.parseSaveFile(file);
      parserRef.current = parser;
      setState({
        saveData,
        isLoading: false,
        error: null,
        hasFile: true,
      });
      
      return saveData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse save file';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        hasFile: false,
      }));
      throw error;
    }
  }, []);

  const clearSaveFile = useCallback(() => {
    setState({
      saveData: null,
      isLoading: false,
      error: null,
      hasFile: false,
    });
  }, []);

  const reconstructAndDownload = useCallback((partyPokemon: readonly PokemonData[]) => {
    if (!state.saveData || !parserRef.current) throw new Error('No save data loaded');
    // Use the same parser instance
    const newSave = parserRef.current.reconstructSaveFile(partyPokemon);
    // Download using file-saver
    const blob = new Blob([newSave], { type: 'application/octet-stream' });
    saveAs(blob, parserRef.current.saveFileName || 'pokemon_save.sav');
  }, [state.saveData]);

  return {
    ...state,
    parseSaveFile,
    clearSaveFile,
    reconstructAndDownload,
  };
};
