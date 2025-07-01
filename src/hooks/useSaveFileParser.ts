import { useState, useCallback } from 'react';
import { PokemonSaveParser } from '../lib/parser';
import type { SaveData } from '../lib/parser/types';

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

  const parseSaveFile = useCallback(async (file: File) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const parser = new PokemonSaveParser();
      const saveData = await parser.parseSaveFile(file);
      
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

  return {
    ...state,
    parseSaveFile,
    clearSaveFile,
  };
};
