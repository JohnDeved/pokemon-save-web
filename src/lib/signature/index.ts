/**
 * ASM Signature system for dynamic memory address resolution
 * Provides tools for extracting and matching byte patterns in ARM/THUMB code
 */

export * from './types'
export * from './scanner'
export * from './extractor'
export * from './resolver'
export * from './patterns'
export * from './real-patterns'
export * from './universal-patterns'
export * from './address-resolver'
export * from './memory-dumper'

// Export CLI utilities
export { testUniversalPatterns } from './universal-patterns'