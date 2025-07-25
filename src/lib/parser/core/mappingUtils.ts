/**
 * Utility functions for creating ID mappings from JSON data
 */

export interface BaseMappingItem {
  readonly id: number | null
  readonly name: string
  readonly id_name: string
}

/**
 * Creates a Map from JSON mapping data, filtering out invalid entries
 * @param mapData - Raw JSON mapping data
 * @returns Map with numeric keys and validated mapping objects
 */
export function createMapping<T extends BaseMappingItem> (
  mapData: Record<string, unknown>,
): Map<number, T> {
  return new Map<number, T>(
    Object.entries(mapData)
      .filter(([_, v]) => typeof v === 'object' && v !== null && 'id' in v && v.id !== null)
      .map(([k, v]) => [parseInt(k, 10), v as T]),
  )
}

/**
 * Creates multiple mappings from JSON data objects
 * @param mappingData - Object containing different mapping data sets
 * @returns Object with the same keys but containing Map instances
 */
export function createMappings<T extends Record<string, Record<string, unknown>>> (
  mappingData: T,
): { [K in keyof T]: Map<number, BaseMappingItem> } {
  const result: { [K in keyof T]: Map<number, BaseMappingItem> } = Object.create(null)

  for (const [key, data] of Object.entries(mappingData)) {
    result[key as keyof T] = createMapping(data)
  }

  return result
}
