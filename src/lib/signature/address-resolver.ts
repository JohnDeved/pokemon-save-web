/**
 * Signature-based memory address resolver for game configurations
 * Replace hardcoded addresses with dynamic signature-based resolution
 */

import { createPartyDataScanner } from './patterns'
import type { ScanResults } from './types'

/**
 * Cache for resolved addresses to avoid repeated scanning
 */
const addressCache = new Map<string, number>()

/**
 * Signature-based address resolver
 * Replaces hardcoded memory addresses with runtime signature scanning
 */
export class SignatureAddressResolver {
  private memoryBuffer?: Uint8Array
  private variant?: string
  private scanResults?: ScanResults

  /**
   * Set memory buffer for signature scanning
   * This should be called with RAM dump or WebSocket memory data
   */
  setMemoryBuffer(buffer: Uint8Array, variant?: string): void {
    this.memoryBuffer = buffer
    this.variant = variant
    this.scanResults = undefined // Reset cached results
  }

  /**
   * Resolve partyData address using signatures
   * Falls back to known addresses if signature resolution fails
   */
  resolvePartyDataAddress(fallbackAddress: number, variant?: string): number {
    const cacheKey = `partyData_${variant || 'unknown'}_${fallbackAddress.toString(16)}`
    
    // Return cached result if available
    if (addressCache.has(cacheKey)) {
      return addressCache.get(cacheKey)!
    }

    let resolvedAddress = fallbackAddress

    if (this.memoryBuffer) {
      try {
        resolvedAddress = this.scanForPartyDataAddress(variant || this.variant)
      } catch (error) {
        console.warn(`Signature resolution failed, using fallback: ${error}`)
      }
    }

    // Cache the result
    addressCache.set(cacheKey, resolvedAddress)
    return resolvedAddress
  }

  /**
   * Resolve party count address (typically partyData - 3)
   */
  resolvePartyCountAddress(fallbackAddress: number, variant?: string): number {
    const partyDataAddr = this.resolvePartyDataAddress(fallbackAddress + 3, variant)
    return partyDataAddr - 3
  }

  /**
   * Get all resolved addresses from last scan
   */
  getResolvedAddresses(): ReadonlyMap<string, number> {
    if (!this.scanResults) {
      return new Map()
    }
    return this.scanResults.resolvedAddresses
  }

  /**
   * Get scan errors from last resolution attempt
   */
  getScanErrors(): readonly string[] {
    return this.scanResults?.errors || []
  }

  /**
   * Clear address cache (useful for testing)
   */
  static clearCache(): void {
    addressCache.clear()
  }

  private scanForPartyDataAddress(variant?: string): number {
    if (!this.memoryBuffer) {
      throw new Error('Memory buffer not set')
    }

    // Perform signature scan
    const scanner = createPartyDataScanner()
    this.scanResults = scanner.scan(this.memoryBuffer, variant)

    if (this.scanResults.errors.length > 0) {
      console.warn('Signature scan errors:', this.scanResults.errors)
    }

    // Try to find a resolved partyData address
    const possibleAddresses = Array.from(this.scanResults.resolvedAddresses.entries())
      .filter(([name]) => name.includes('partyData') || name.includes('partyCount'))
    
    if (possibleAddresses.length === 0) {
      throw new Error('No partyData signatures matched')
    }

    // Prefer specific partyData signatures over generic ones
    const preferredSignatures = [
      'partyData_arm_ldr_literal',
      'partyData_thumb_ldr_literal',
      'partyCount_access',
    ]

    for (const preferredName of preferredSignatures) {
      const address = this.scanResults.resolvedAddresses.get(preferredName)
      if (address) {
        return address
      }
    }

    // Fall back to any found address
    return possibleAddresses[0]![1]
  }
}

/**
 * Global resolver instance
 */
export const globalAddressResolver = new SignatureAddressResolver()

/**
 * Memory address interface with signature support
 * Extends the existing memory address interface to support signature resolution
 */
export interface SignatureMemoryAddresses {
  /** Resolve partyData address dynamically */
  readonly partyData: number
  /** Resolve partyCount address dynamically */  
  readonly partyCount: number
  /** Enemy party data (computed from partyData) */
  readonly enemyParty: number
  /** Enemy party count (computed from partyCount) */
  readonly enemyPartyCount: number
  
  /** Enable signature-based resolution */
  enableSignatureResolution(memoryBuffer: Uint8Array, variant: string): void
  /** Get fallback addresses for when signatures fail */
  getFallbackAddresses(): { partyData: number, partyCount: number }
}

/**
 * Create signature-aware memory addresses for a game config
 */
export function createSignatureMemoryAddresses(
  fallbackPartyData: number,
  fallbackPartyCount: number,
  enemyPartyOffset = 0x258 // Default offset between party and enemy party
): SignatureMemoryAddresses {
  let useSignatures = false
  let variant = ''

  return {
    get partyData(): number {
      if (useSignatures) {
        return globalAddressResolver.resolvePartyDataAddress(fallbackPartyData, variant)
      }
      return fallbackPartyData
    },

    get partyCount(): number {
      if (useSignatures) {
        return globalAddressResolver.resolvePartyCountAddress(fallbackPartyCount, variant)
      }
      return fallbackPartyCount
    },

    get enemyParty(): number {
      return this.partyData + enemyPartyOffset
    },

    get enemyPartyCount(): number {
      return this.partyCount + 8 // Standard offset pattern
    },

    enableSignatureResolution(memoryBuffer: Uint8Array, gameVariant: string): void {
      globalAddressResolver.setMemoryBuffer(memoryBuffer, gameVariant)
      useSignatures = true
      variant = gameVariant
    },

    getFallbackAddresses() {
      return {
        partyData: fallbackPartyData,
        partyCount: fallbackPartyCount,
      }
    },
  }
}

/**
 * Utility function to test signature resolution against a memory buffer
 */
export async function testSignatureResolution(
  memoryBuffer: Uint8Array, 
  variant: string,
  expectedAddresses: { partyData: number, partyCount?: number }
): Promise<{
  success: boolean
  resolvedPartyData: number
  resolvedPartyCount: number
  matches: number
  errors: string[]
}> {
  const resolver = new SignatureAddressResolver()
  resolver.setMemoryBuffer(memoryBuffer, variant)

  const resolvedPartyData = resolver.resolvePartyDataAddress(expectedAddresses.partyData, variant)
  const resolvedPartyCount = resolver.resolvePartyCountAddress(expectedAddresses.partyCount || (expectedAddresses.partyData - 3), variant)

  const resolvedAddresses = resolver.getResolvedAddresses()
  const errors = resolver.getScanErrors()

  const success = resolvedPartyData === expectedAddresses.partyData

  return {
    success,
    resolvedPartyData,
    resolvedPartyCount,
    matches: resolvedAddresses.size,
    errors: [...errors],
  }
}