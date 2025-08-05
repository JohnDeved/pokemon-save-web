/**
 * Types for memory analysis and byte pattern matching
 */

export interface MemoryRegion {
  address: number
  size: number
  data: Uint8Array
}

export interface BytePattern {
  name: string
  description: string
  pattern: Uint8Array
  mask?: Uint8Array // Optional mask for wildcard bytes (0 = ignore, 1 = match)
  expectedAddress?: number // Expected address this pattern should point to
}

export interface PatternMatch {
  pattern: BytePattern
  address: number
  matchedBytes: Uint8Array
  confidence: number // 0.0 to 1.0
  context?: {
    instructionType?: string
    operands?: number[]
    referencedAddress?: number
  }
}

export interface AnalysisResult {
  romName: string
  gameTitle: string
  detectedPartyDataAddress?: number
  confidence: number
  patterns: PatternMatch[]
  suggestedPatterns: BytePattern[]
}

export interface ArmInstruction {
  opcode: number
  type: 'arm' | 'thumb'
  instruction: string
  operands: number[]
  address: number
  referencedAddresses: number[]
}

export interface MemoryDumpOptions {
  startAddress: number
  endAddress: number
  outputPath: string
  chunkSize?: number
}