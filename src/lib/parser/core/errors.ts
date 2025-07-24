/**
 * Modern error handling utilities for Pokemon Save Parser
 * Provides better error messages and type-safe error handling
 */

/**
 * Custom error classes for better error handling
 */
export class SaveFileError extends Error {
  constructor (message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'SaveFileError'
  }
}

export class GameConfigError extends Error {
  constructor (message: string, public readonly gameType?: string) {
    super(message)
    this.name = 'GameConfigError'
  }
}

export class PokemonDataError extends Error {
  constructor (message: string, public readonly slot?: number) {
    super(message)
    this.name = 'PokemonDataError'
  }
}

/**
 * Type-safe result pattern for operations that might fail
 */
export type Result<T, E = Error> =
  | { success: true, data: T }
  | { success: false, error: E }

/**
 * Create a successful result
 */
export function ok<T> (data: T): Result<T, never> {
  return { success: true, data }
}

/**
 * Create an error result
 */
export function err<E extends Error> (error: E): Result<never, E> {
  return { success: false, error }
}

/**
 * Safely execute a function and return a Result
 */
export function tryCatch<T> (fn: () => T): Result<T> {
  try {
    return ok(fn())
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)))
  }
}

/**
 * Safely execute an async function and return a Result
 */
export async function tryAsync<T> (fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await fn())
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)))
  }
}
