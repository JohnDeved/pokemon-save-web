import type { PokemonType } from '@/types'
import { getTypeBoostMultiplier } from './items'

export interface PowerCalcInput {
  basePower: number | null
  moveType: PokemonType
  userTypes: PokemonType[]
  abilityName?: string
  itemIdName?: string | null
  currentHp?: number
  maxHp?: number
}

export interface PowerCalcResult {
  finalPower: number | null
  boosted: boolean
  multipliers: { stab: number; item: number; ability: number }
}

function getStabMultiplier(hasStab: boolean, abilityName?: string): number {
  if (!hasStab) return 1
  const name = (abilityName ?? '').toLowerCase()
  return name === 'adaptability' ? 2 : 1.5
}

function getAbilityMultiplier(moveType: PokemonType, abilityName: string | undefined, currentHp?: number, maxHp?: number): number {
  const name = (abilityName ?? '').toLowerCase()
  if (!name) return 1

  // Low-HP elemental boosts (≤ 1/3 HP)
  const lowHpBoosts: Record<string, PokemonType> = {
    blaze: 'FIRE',
    overgrow: 'GRASS',
    torrent: 'WATER',
    swarm: 'BUG',
  }
  if (name in lowHpBoosts) {
    const mx = maxHp ?? 0
    const cur = currentHp ?? mx
    const isLow = mx > 0 ? cur / mx <= 1 / 3 : false
    if (isLow && moveType === lowHpBoosts[name]!) return 1.5
  }

  // Always-on type boosts
  const typeBoosts: Record<string, { type: PokemonType; mult: number }> = {
    steelworker: { type: 'STEEL', mult: 1.5 },
    'water bubble': { type: 'WATER', mult: 2 },
  }
  if (name in typeBoosts) {
    const info = typeBoosts[name]!
    if (moveType === info.type) return info.mult
  }

  return 1
}

export function computeMovePowerPreview(input: PowerCalcInput): PowerCalcResult {
  const { basePower, moveType, userTypes, abilityName, itemIdName, currentHp, maxHp } = input
  if (typeof basePower !== 'number') {
    return { finalPower: null, boosted: false, multipliers: { stab: 1, item: 1, ability: 1 } }
  }
  const hasStab = userTypes.includes(moveType)
  const stab = getStabMultiplier(hasStab, abilityName)
  const item = getTypeBoostMultiplier(itemIdName ?? undefined, moveType)
  const ability = getAbilityMultiplier(moveType, abilityName, currentHp, maxHp)
  const final = Math.floor(basePower * stab * item * ability)
  return { finalPower: final, boosted: final !== basePower, multipliers: { stab, item, ability } }
}
