/**
 * Helper functions for creating Pokemon data structures
 */

import type { MoveData, PokemonMoves } from './types'

// Helper functions for data creation
export const createMoveData = (id: number, pp: number): MoveData => ({ id, pp })

export const createPokemonMoves = (
  move1_id: number, move2_id: number, move3_id: number, move4_id: number,
  pp1: number, pp2: number, pp3: number, pp4: number,
): PokemonMoves => ({
  move1: createMoveData(move1_id, pp1),
  move2: createMoveData(move2_id, pp2),
  move3: createMoveData(move3_id, pp3),
  move4: createMoveData(move4_id, pp4),
})
