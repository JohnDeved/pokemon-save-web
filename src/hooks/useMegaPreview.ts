import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePokemonStore, useSaveFileStore } from '@/stores'
import type { z } from 'zod'
import type { PokeAPI } from 'pokeapi-types/dist/index'
import { PokemonTypeSchema, type PokemonType } from '@/types'

// Local helpers
const formatName = (name: string): string => name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

async function fetchAndValidate<T>(url: string, schema?: z.ZodType<T>): Promise<T> {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.statusText}`)
  const data = await resp.json()
  if (!schema) return data as T
  const result = schema.safeParse(data)
  if (!result.success) throw new Error(`Invalid API response format for ${url}`)
  return result.data
}

// Minimal PokeAPI shapes we need
// Using types from pokeapi-types (PokemonSpecies, Pokemon, Ability)

// Known Mega Stone to PokeAPI mega form slug map
// Keyed by our item id_name, value is the pokemon form slug used by PokeAPI
const STONE_TO_FORM: Record<string, string> = {
  venusaurite: 'venusaur-mega',
  'charizardite-x': 'charizard-mega-x',
  'charizardite-y': 'charizard-mega-y',
  blastoisinite: 'blastoise-mega',
  beedrillite: 'beedrill-mega',
  pidgeotite: 'pidgeot-mega',
  alakazite: 'alakazam-mega',
  slowbronite: 'slowbro-mega',
  gengarite: 'gengar-mega',
  kangaskhanite: 'kangaskhan-mega',
  pinsirite: 'pinsir-mega',
  gyaradosite: 'gyarados-mega',
  aerodactylite: 'aerodactyl-mega',
  'mewtwonite-x': 'mewtwo-mega-x',
  'mewtwonite-y': 'mewtwo-mega-y',
  ampharosite: 'ampharos-mega',
  steelixite: 'steelix-mega',
  scizorite: 'scizor-mega',
  heracronite: 'heracross-mega',
  houndoominite: 'houndoom-mega',
  tyranitarite: 'tyranitar-mega',
  sceptilite: 'sceptile-mega',
  blazikenite: 'blaziken-mega',
  swampertite: 'swampert-mega',
  gardevoirite: 'gardevoir-mega',
  sablenite: 'sableye-mega',
  mawilite: 'mawile-mega',
  aggronite: 'aggron-mega',
  medichamite: 'medicham-mega',
  manectite: 'manectric-mega',
  sharpedonite: 'sharpedo-mega',
  cameruptite: 'camerupt-mega',
  altarianite: 'altaria-mega',
  banettite: 'banette-mega',
  absolite: 'absol-mega',
  glalitite: 'glalie-mega',
  salamencite: 'salamence-mega',
  metagrossite: 'metagross-mega',
  latiasite: 'latias-mega',
  latiosite: 'latios-mega',
  lopunnite: 'lopunny-mega',
  garchompite: 'garchomp-mega',
  lucarionite: 'lucario-mega',
  abomasite: 'abomasnow-mega',
  galladite: 'gallade-mega',
  audinite: 'audino-mega',
  diancite: 'diancie-mega',
}

function slugToLocalSpriteName(slug: string): string {
  // Convert slug variants like charizard-mega-x -> charizard-megax (matches local asset names)
  return slug.replace(/-mega-(x|y)$/i, '-meg$1')
}

function slugToShowdownSpriteName(slug: string): string {
  // Pokemon Showdown uses gen5 static PNGs with naming:
  //  - 'gyarados-mega' -> 'gyarados-mega'
  //  - 'charizard-mega-x' -> 'charizard-megax'
  //  - 'mewtwo-mega-y' -> 'mewtwo-megay'
  return slug.replace(/-mega-(x|y)$/i, '-meg$1')
}

// Read ability effect text from PokeAPI.Ability (fallback)

export function useMegaPreview() {
  const pokemon = usePokemonStore(s => s.partyList.find(p => p.id === s.activePokemonId))
  const activePokemonId = usePokemonStore(s => s.activePokemonId)
  const megaState = usePokemonStore(s => s.megaPreview[activePokemonId])
  const setMegaPreviewEnabled = usePokemonStore(s => s.setMegaPreviewEnabled)
  const setMegaPreviewForm = usePokemonStore(s => s.setMegaPreviewForm)
  const saveSessionId = useSaveFileStore(s => s.saveSessionId)
  const parser = useSaveFileStore(s => s.parser)
  const supportsMega = Boolean(parser?.getConfigFlags().supportsMega)

  const speciesId = pokemon?.data.speciesId
  const heldItemIdName = pokemon?.data.itemIdName

  // Fetch mega-capable forms for this species
  const { data: megaForms, isFetching: formsLoading } = useQuery({
    queryKey: ['pokemon', 'mega', 'forms', saveSessionId, speciesId ?? 'none'],
    enabled: supportsMega && !!speciesId,
    queryFn: async () => {
      const species = await fetchAndValidate<PokeAPI.PokemonSpecies>(`https://pokeapi.co/api/v2/pokemon-species/${speciesId}`)
      const varieties = species.varieties || []
      // Filter varieties with 'mega' in the name
      const forms = varieties
        .map((v: PokeAPI.PokemonSpeciesVariety) => v.pokemon?.name)
        .filter((n: string | undefined): n is string => typeof n === 'string')
        .filter((n: string) => /mega/.test(n))
      return forms
    },
    staleTime: 1000 * 60 * 60,
  })

  // Determine default selection based on held stone or single-form list
  const defaultForm = useMemo(() => {
    if (!megaForms || megaForms.length === 0) return undefined
    if (megaForms.length === 1) return megaForms[0]
    if (heldItemIdName) {
      const mapped = STONE_TO_FORM[heldItemIdName]
      if (mapped && megaForms.includes(mapped)) return mapped
    }
    return undefined
  }, [megaForms, heldItemIdName])

  const selectedForm = megaState?.form
  const megaPreviewEnabled = Boolean(megaState?.enabled)
  const effectiveForm = selectedForm || defaultForm

  // Load base stats for the selected mega form
  const { data: megaDetails, isFetching: statsLoading } = useQuery({
    queryKey: ['pokemon', 'mega', 'stats', saveSessionId, effectiveForm ?? 'none'],
    enabled: supportsMega && !!effectiveForm,
    queryFn: async () => {
      const p = await fetchAndValidate<PokeAPI.Pokemon>(`https://pokeapi.co/api/v2/pokemon/${effectiveForm}`)
      // Extract base stats in our UI order: HP, Atk, Def, Spe, SpA, SpD
      const get = (name: string) => p.stats.find((s: PokeAPI.PokemonStat) => s.stat?.name === name)?.base_stat ?? 0
      const baseStats = [get('hp'), get('attack'), get('defense'), get('speed'), get('special-attack'), get('special-defense')]
      // Extract types and map to our enum (uppercase), fallback to UNKNOWN on mismatch
      const types: PokemonType[] = (Array.isArray(p.types) ? p.types : [])
        .map(t => (t?.type?.name ?? '').toUpperCase())
        .map(name => {
          const parsed = PokemonTypeSchema.safeParse(name)
          return parsed.success ? parsed.data : ('UNKNOWN' as PokemonType)
        })
      // Load ability descriptions (best-effort)
      const abilitiesRaw: PokeAPI.Pokemon['abilities'] = Array.isArray(p.abilities) ? p.abilities : []
      const abilityDetails = await Promise.all(
        abilitiesRaw.map(async (a: PokeAPI.PokemonAbility) => {
          try {
            const ad = await fetchAndValidate<PokeAPI.Ability>(a.ability.url)
            const entry = Array.isArray(ad.effect_entries) ? ad.effect_entries.find((e: PokeAPI.VerboseEffect) => e.language?.name === 'en') : undefined
            const desc = typeof entry?.effect === 'string' ? entry.effect : 'No description available.'
            return { slot: a.slot, name: formatName(a.ability.name), description: desc }
          } catch {
            return {
              slot: a.slot,
              name: formatName(a.ability.name),
              description: 'No description available.',
            }
          }
        })
      )
      return { baseStats, abilities: abilityDetails, types }
    },
    staleTime: 1000 * 60 * 60,
  })
  const megaBaseStats = megaDetails?.baseStats
  const megaAbilities = megaDetails?.abilities
  const megaTypes = megaDetails?.types

  return {
    supportsMega,
    formsLoading,
    statsLoading,
    hasMegaForms: Boolean(megaForms && megaForms.length > 0),
    forms: (megaForms || []).map(f => ({
      value: f,
      label: formatName(f.replace(/-mega(-x|-y)?$/, '-mega$1')),
    })),
    selectedForm: effectiveForm,
    setSelectedForm: (val: string | undefined) => setMegaPreviewForm(activePokemonId, val),
    megaPreviewEnabled,
    setMegaPreviewEnabled: (enabled: boolean) => setMegaPreviewEnabled(activePokemonId, enabled),
    megaBaseStats,
    megaAbilities,
    megaTypes,
    // Sprite URLs for UI components
    megaSpriteAniUrl: pokemon && effectiveForm ? `${pokemon.data.isShiny || pokemon.data.isRadiant ? '/sprites/shiny' : '/sprites'}/${slugToLocalSpriteName(effectiveForm)}.gif` : undefined,
    megaSpritePngUrl: effectiveForm ? `https://play.pokemonshowdown.com/sprites/${pokemon?.data.isShiny || pokemon?.data.isRadiant ? 'gen5-shiny' : 'gen5'}/${slugToShowdownSpriteName(effectiveForm)}.png` : undefined,
  }
}
