import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import type { UIPokemonData } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatIdName = (value?: string | null) =>
  value ? value.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) : undefined

export const formatPpSuffix = (pp: number | null | undefined) =>
  typeof pp === 'number' && Number.isFinite(pp) ? ` (PP ${pp})` : ''

const buildMovesLine = (pokemon: UIPokemonData) => {
  const detailsMoves = pokemon.details?.moves ?? []
  const ids = pokemon.data.moveIds
  const pps = pokemon.data.ppValues

  const moveLabels = [0, 1, 2, 3].map(index => {
    const detailed = detailsMoves[index]
    if (detailed && detailed.id !== 0 && detailed.name !== 'None') {
      return `${detailed.name}${formatPpSuffix(detailed.pp)}`
    }

    const moveId = ids[index]
    if (!moveId) return 'None'
    return `Move ${moveId}${formatPpSuffix(pps[index])}`
  })

  const meaningfulMoves = moveLabels.filter(label => label !== 'None')
  return meaningfulMoves.length > 0 ? meaningfulMoves.join(' / ') : 'None'
}

const buildPokemonBlock = (pokemon: UIPokemonData, index: number): string => {
  const speciesName = formatIdName(pokemon.data.nameId) ?? `Species ${pokemon.data.speciesId}`
  const nickname = pokemon.data.nickname || speciesName
  const abilitySlot = pokemon.data.abilityNumber + 1
  const ability =
    pokemon.details?.abilities?.find(entry => entry.slot === abilitySlot)?.name ??
    pokemon.details?.abilities?.[0]?.name ??
    `Ability Slot ${abilitySlot}`
  const itemName = pokemon.details?.item?.name ?? formatIdName(pokemon.data.itemIdName) ?? 'None'
  const { nature } = pokemon.data
  const [hpEv = 0, atkEv = 0, defEv = 0, speEv = 0, spaEv = 0, spdEv = 0] = pokemon.data.evs
  const evLine = `HP ${hpEv} / Atk ${atkEv} / Def ${defEv} / SpA ${spaEv} / SpD ${spdEv} / Spe ${speEv}`
  const hpLine = `${pokemon.data.currentHp}/${pokemon.data.maxHp}`
  const movesLine = buildMovesLine(pokemon)

  const lines = [
    `${index + 1}. ${nickname} (${speciesName}) Lv. ${pokemon.data.level}`,
    `   Ability: ${ability}`,
    `   Nature: ${nature}`,
    `   Item: ${itemName}`,
    `   HP: ${hpLine}`,
    `   EVs: ${evLine}`,
    `   Moves: ${movesLine}`,
  ]

  return lines.join('\n')
}

export const buildTeamClipboardText = (
  party: UIPokemonData[],
  trainerName?: string | null
): string => {
  const headerTitle = `Pokemon Team${trainerName ? ` (Trainer: ${trainerName})` : ''}`
  const underline = '='.repeat(Math.max(headerTitle.length, 12))

  if (party.length === 0) {
    return `${headerTitle}\n${underline}\n\nNo Pokemon in party.`
  }

  const blocks = party.map((pokemon, index) => buildPokemonBlock(pokemon, index))
  return `${headerTitle}\n${underline}\n\n${blocks.join('\n\n')}`
}
