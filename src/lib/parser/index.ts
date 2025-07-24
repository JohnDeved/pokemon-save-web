/**
 * Pokemon Save Parser Library
 * Clean exports for the browser-ready TypeScript parser
 */

// Core parser functionality
export { PokemonSaveParser as default, PokemonSaveParser } from './core/pokemonSaveParser.js'

// Pokemon data interfaces and base classes
export type { PokemonDataInterface, RadiantPokemonDataInterface } from './core/PokemonDataInterface.js'
export { BasePokemonData, SafeDataView } from './core/BasePokemonData.js'

export type {
  MoveData, PlayTimeData, PokemonEVs,
  PokemonIVs, PokemonMoves, PokemonStats, SaveData, ParsedSaveData, SectorInfo,
} from './core/types.js'

export {
  CONSTANTS,
  createMoveData, createPokemonEVs,
  createPokemonIVs, createPokemonMoves, createPokemonStats, getMoveIds,
  getPPValues, getTotalEVs,
  getTotalIVs, pokemonEVsToArray,
  pokemonIVsToArray,
  pokemonStatsToArray,
} from './core/types.js'

// Utility functions
export {
  bytesToGbaString, getPokemonNature, natureEffects, statStrings,
  natures, calculateTotalStats, calculateTotalStatsDirect, getItemSpriteUrl
} from './core/utils.js'

// Game configuration system
export type { GameConfig, PokemonMapping, ItemMapping, MoveMapping } from './configs/GameConfig.js'

export { QuetzalConfig } from './configs/index.js'
export { VanillaConfig } from './configs/index.js'
export { autoDetectGameConfig, getAllGameConfigs, createGameConfigByName } from './configs/autoDetect.js'

// Game-specific Pokemon data implementations
export { QuetzalPokemonData } from './games/quetzal/QuetzalPokemonData.js'
export { VanillaPokemonData } from './games/vanilla/VanillaPokemonData.js'
