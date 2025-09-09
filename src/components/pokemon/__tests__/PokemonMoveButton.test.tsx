import { describe, expect, test } from 'vitest'
import type { PokemonType } from '@/types'

// Extract STAB calculation logic for testing
function calculateStab(moveType: PokemonType, pokemonTypes: PokemonType[], basePower: number | null): {
  hasStab: boolean
  adjustedPower: number | null
} {
  if (basePower === null) return { hasStab: false, adjustedPower: null }
  
  const hasStab = pokemonTypes.some(pokemonType => pokemonType === moveType)
  const adjustedPower = hasStab ? Math.floor(basePower * 1.5) : basePower
  
  return { hasStab, adjustedPower }
}

describe('STAB (Same Type Attack Bonus) Calculation', () => {
  test('should not apply STAB when move type does not match Pokemon types', () => {
    const result = calculateStab('GRASS', ['FIRE', 'WATER'], 45)
    
    expect(result.hasStab).toBe(false)
    expect(result.adjustedPower).toBe(45)
  })

  test('should apply STAB when move type matches Pokemon type', () => {
    const result = calculateStab('GRASS', ['GRASS', 'POISON'], 45)
    
    expect(result.hasStab).toBe(true)
    expect(result.adjustedPower).toBe(67) // 45 * 1.5 = 67.5, floored to 67
  })

  test('should handle null power values correctly', () => {
    const result = calculateStab('NORMAL', ['NORMAL'], null)
    
    expect(result.hasStab).toBe(false)
    expect(result.adjustedPower).toBe(null)
  })

  test('should calculate STAB correctly for various power values', () => {
    const testCases = [
      { basePower: 60, expectedStab: 90 }, // 60 * 1.5 = 90
      { basePower: 80, expectedStab: 120 }, // 80 * 1.5 = 120
      { basePower: 55, expectedStab: 82 }, // 55 * 1.5 = 82.5, floored to 82
      { basePower: 90, expectedStab: 135 }, // 90 * 1.5 = 135
    ]

    testCases.forEach(({ basePower, expectedStab }) => {
      const result = calculateStab('FIRE', ['FIRE'], basePower)
      
      expect(result.hasStab).toBe(true)
      expect(result.adjustedPower).toBe(expectedStab)
    })
  })

  test('should work with dual-type Pokemon when either type matches', () => {
    // Test first type matches
    const result1 = calculateStab('WATER', ['WATER', 'GRASS'], 50)
    expect(result1.hasStab).toBe(true)
    expect(result1.adjustedPower).toBe(75) // 50 * 1.5 = 75

    // Test second type matches
    const result2 = calculateStab('GRASS', ['WATER', 'GRASS'], 50)
    expect(result2.hasStab).toBe(true)
    expect(result2.adjustedPower).toBe(75) // 50 * 1.5 = 75
  })

  test('should handle edge cases with single-type Pokemon', () => {
    const result = calculateStab('ELECTRIC', ['ELECTRIC'], 100)
    
    expect(result.hasStab).toBe(true)
    expect(result.adjustedPower).toBe(150) // 100 * 1.5 = 150
  })

  test('should return base power when no STAB applies', () => {
    const testCases = [
      { moveType: 'FIRE', pokemonTypes: ['WATER', 'GRASS'], basePower: 70 },
      { moveType: 'ELECTRIC', pokemonTypes: ['GROUND', 'ROCK'], basePower: 95 },
      { moveType: 'PSYCHIC', pokemonTypes: ['DARK', 'GHOST'], basePower: 80 },
    ]

    testCases.forEach(({ moveType, pokemonTypes, basePower }) => {
      const result = calculateStab(moveType as PokemonType, pokemonTypes as PokemonType[], basePower)
      
      expect(result.hasStab).toBe(false)
      expect(result.adjustedPower).toBe(basePower)
    })
  })
})