/**
 * Types for ASM signature system
 */

/**
 * Architecture modes for ARM7TDMI (GBA processor)
 */
export type ArchMode = 'ARM' | 'THUMB'

/**
 * A byte pattern with wildcards for signature matching
 */
export interface BytePattern {
  /** Pattern bytes (0x00-0xFF for exact match, -1 for wildcard) */
  readonly pattern: readonly number[]
  /** Human-readable mask string ('x' = match, '?' = wildcard) */
  readonly mask: string
  /** IDA-style signature string (e.g., "E5 9F ? ? 01 C0") */
  readonly idaSignature: string
}

/**
 * Information about where a signature was found and how to resolve the target address
 */
export interface SignatureMatch {
  /** Offset in buffer where pattern was found */
  readonly offset: number
  /** The signature that matched */
  readonly signature: AsmSignature
  /** Raw bytes that matched the pattern */
  readonly matchedBytes: Uint8Array
}

/**
 * Configuration for resolving a memory address from a signature match
 */
export interface AddressResolver {
  /** Description of resolution steps */
  readonly description: string
  /** Function to compute final address from match context */
  readonly resolve: (match: SignatureMatch, buffer: Uint8Array) => number
}

/**
 * A complete ASM signature for finding and resolving memory addresses
 */
export interface AsmSignature {
  /** Human-readable name/description */
  readonly name: string
  /** Expected processor mode at match location */
  readonly mode: ArchMode
  /** Byte pattern to search for */
  readonly pattern: BytePattern
  /** How to resolve target address from match */
  readonly resolver: AddressResolver
  /** Game/ROM variants this signature applies to */
  readonly supportedVariants: readonly string[]
}

/**
 * Memory region for analysis and dumping
 */
export interface MemoryRegion {
  /** Start address */
  readonly address: number
  /** Size in bytes */
  readonly size: number
  /** Human-readable description */
  readonly description: string
}

/**
 * Context information captured when memory is accessed
 */
export interface MemoryAccessContext {
  /** Program counter where access occurred */
  readonly pc: number
  /** Processor mode at time of access */
  readonly mode: ArchMode
  /** Type of memory access */
  readonly accessType: 'read' | 'write'
  /** Memory address that was accessed */
  readonly targetAddress: number
  /** Instruction bytes around the access point */
  readonly instructionContext: Uint8Array
  /** Call stack if available */
  readonly callStack?: readonly number[]
}

/**
 * Configuration for memory dump acquisition
 */
export interface MemoryDumpConfig {
  /** Memory regions to dump */
  readonly regions: readonly MemoryRegion[]
  /** Game state to reach before dumping */
  readonly gameState?: string
  /** Output format for dumps */
  readonly format: 'raw' | 'hex' | 'annotated'
}

/**
 * Results from signature scanning operation
 */
export interface ScanResults {
  /** All signatures that were found */
  readonly matches: readonly SignatureMatch[]
  /** Resolved addresses by signature name */
  readonly resolvedAddresses: ReadonlyMap<string, number>
  /** Any errors encountered during scanning */
  readonly errors: readonly string[]
}
