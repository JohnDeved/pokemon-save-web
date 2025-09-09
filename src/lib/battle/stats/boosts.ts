import { calculateTotalStatsDirect } from '@/lib/parser/core/utils'

// Totals order: [HP, Atk, Def, Spe, SpA, SpD]
export function applyHeldItemStatBoosts(totals: readonly number[], itemIdName?: string | null, speciesIdName?: string | null): number[] {
  const item = (itemIdName ?? '').toLowerCase()
  const species = (speciesIdName ?? '').toLowerCase()
  if (!item) return [...totals]
  const boosted = [...totals]

  switch (item) {
    case 'light-ball':
      // Doubles Pikachu's initial Attack and Special Attack
      if (species === 'pikachu') {
        boosted[1] = Math.floor(boosted[1]! * 2)
        boosted[4] = Math.floor(boosted[4]! * 2)
      }
      break
    case 'thick-club':
      // Doubles Atk for Cubone/Marowak
      if (species === 'cubone' || species === 'marowak') boosted[1] = Math.floor(boosted[1]! * 2)
      break
    case 'deep-sea-tooth':
    case 'deepseatooth':
      // Doubles Sp. Atk for Clamperl
      if (species === 'clamperl') boosted[4] = Math.floor(boosted[4]! * 2)
      break
    case 'deep-sea-scale':
    case 'deepseascale':
      // Doubles Sp. Def for Clamperl
      if (species === 'clamperl') boosted[5] = Math.floor(boosted[5]! * 2)
      break
    case 'soul-dew':
      // +50% SpA & SpD for Latias/Latios (Gen 3 behavior)
      if (species === 'latias' || species === 'latios') {
        boosted[4] = Math.floor(boosted[4]! * 1.5)
        boosted[5] = Math.floor(boosted[5]! * 1.5)
      }
      break
    case 'metal-powder':
      // +50% Def for Ditto
      if (species === 'ditto') boosted[2] = Math.floor(boosted[2]! * 1.5)
      break
    case 'choice-band':
      boosted[1] = Math.floor(boosted[1]! * 1.5)
      break
    case 'choice-specs':
      boosted[4] = Math.floor(boosted[4]! * 1.5)
      break
    case 'choice-scarf':
      boosted[3] = Math.floor(boosted[3]! * 1.5)
      break
    default:
      break
  }

  return boosted
}

export function computeTotalsWithHeldItem(baseStats: readonly number[] | undefined, ivs: readonly number[] | undefined, evs: readonly number[] | undefined, level: number, nature: string, itemIdName?: string | null, speciesIdName?: string | null): number[] | null {
  if (!baseStats || !ivs || !evs) return null
  const totals = calculateTotalStatsDirect(baseStats, ivs, evs, level, nature)
  return applyHeldItemStatBoosts(totals, itemIdName, speciesIdName)
}
