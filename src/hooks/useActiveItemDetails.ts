import { useQuery } from '@tanstack/react-query'
import { usePokemonStore, useSaveFileStore } from '@/stores'
import type { PokeAPI } from 'pokeapi-types/dist/index'
import type { z } from 'zod'

async function fetchAndValidate<T>(url: string, schema?: z.ZodType<T>): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch from ${url}: ${response.statusText}`)
  const data = await response.json()
  if (!schema) return data as T
  const result = schema.safeParse(data)
  if (!result.success) throw new Error(`Invalid API response format for ${url}`)
  return result.data
}

function getBestEnglishItemDescription(apiObj: PokeAPI.Item): string {
  const effectEntry = apiObj.effect_entries?.find(e => e.language.name === 'en')
  if (effectEntry?.effect) return effectEntry.effect

  if (!Array.isArray(apiObj.flavor_text_entries)) return 'No description available.'
  let latestText: string | undefined
  let latestId = -1
  for (const entry of apiObj.flavor_text_entries) {
    if (entry.language.name !== 'en') continue
    const { text, version_group } = entry
    const url = version_group?.url
    const match = typeof url === 'string' ? url.match(/\/(\d+)\/?$/) : null
    const id = match ? parseInt(match[1]!, 10) : 0
    if (id > latestId) {
      latestText = text
      latestId = id
    }
  }
  if (latestText) return latestText.replace(/\s+/g, ' ').trim()
  return 'No description available.'
}

const formatName = (name: string): string => name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

export function useActiveItemDetails() {
  const pokemon = usePokemonStore(s => s.partyList.find(p => p.id === s.activePokemonId))
  const saveSessionId = useSaveFileStore(s => s.saveSessionId)
  const itemIdName = pokemon?.data.itemIdName
  const queryKey = ['pokemon', 'item', saveSessionId, pokemon?.data.speciesId ?? 'none', String(pokemon?.id ?? -1), itemIdName ?? 'none'] as const

  const { data, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!itemIdName) return null
      try {
        const itemResp = await fetchAndValidate<PokeAPI.Item>(`https://pokeapi.co/api/v2/item/${itemIdName}`)
        return {
          name: formatName(itemResp.name),
          description: getBestEnglishItemDescription(itemResp),
        }
      } catch {
        return {
          name: formatName(itemIdName),
          description: 'Could not fetch item data.',
        }
      }
    },
    enabled: !!pokemon && !!itemIdName,
    staleTime: 1000 * 60 * 60,
  })

  return { itemDetails: data, isFetching, queryKey }
}
