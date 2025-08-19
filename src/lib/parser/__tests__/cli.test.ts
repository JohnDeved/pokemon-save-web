/**
 * Tests for CLI functionality (src/lib/parser/cli.ts)
 * Tests argument parsing, outputs, error handling, and file validation
 */

import { execSync } from 'child_process'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'

// Handle ES modules in Node.js
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('Parser CLI Tests', () => {
  const cliPath = resolve(__dirname, '..', 'cli.ts')
  const testDataDir = resolve(__dirname, 'test_data')
  const testSavePath = resolve(testDataDir, 'quetzal.sav')
  const tempDir = resolve(__dirname, 'temp_cli_test')

  beforeAll(() => {
    // Create temp directory for test files
    mkdirSync(tempDir, { recursive: true })
  })

  afterAll(() => {
    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Command line argument parsing', () => {
    it('should show usage when no arguments provided', () => {
      expect(() => {
        execSync(`tsx "${cliPath}"`, { encoding: 'utf8', stdio: 'pipe' })
      }).toThrow()

      try {
        execSync(`tsx "${cliPath}"`, { encoding: 'utf8', stdio: 'pipe' })
      } catch (error: unknown) {
        const execError = error as Error & { stderr?: string, stdout?: string, status?: number }
        const output = execError.stderr ?? execError.stdout
        expect(output).toContain('Usage: tsx cli.ts [savefile.sav] [options]')
        expect(output).toContain('--debug')
        expect(output).toContain('--graph')
        expect(output).toContain('--toBytes')
        expect(output).toContain('--toString')
        expect(execError.status).toBe(1)
      }
    })

    it('should show usage when invalid file provided', () => {
      expect(() => {
        execSync(`tsx "${cliPath}" nonexistent.sav`, { encoding: 'utf8', stdio: 'pipe' })
      }).toThrow()

      try {
        execSync(`tsx "${cliPath}" nonexistent.sav`, { encoding: 'utf8', stdio: 'pipe' })
      } catch (error: unknown) {
        const execError = error as Error & { stderr?: string, stdout?: string, status?: number }
        const output = execError.stderr ?? execError.stdout
        expect(output).toContain('Usage: tsx cli.ts [savefile.sav] [options]')
        expect(execError.status).toBe(1)
      }
    })
  })

  describe('String conversion utilities', () => {
    it('should convert PIKACHU to GBA bytes with --toBytes', () => {
      const result = execSync(`tsx "${cliPath}" --toBytes=PIKACHU`, { encoding: 'utf8' })
      expect(result).toContain('GBA bytes for "PIKACHU":')
      expect(result).toContain('ca c3 c5 bb bd c2 cf')
    })

    it('should convert PIKACHU hex bytes back to string with --toString', () => {
      const result = execSync(`tsx "${cliPath}" --toString="ca c3 c5 bb bd c2 cf"`, { encoding: 'utf8' })
      expect(result).toContain('String for bytes [ca c3 c5 bb bd c2 cf]:')
      expect(result).toContain('PIKACHU')
    })
  })

  describe('Save file parsing', () => {
    it('should parse valid save file and show basic output', () => {
      const result = execSync(`tsx "${cliPath}" "${testSavePath}"`, { encoding: 'utf8' })
      expect(result).toContain('Active save slot:')
      expect(result).toContain('Valid sectors found:')
      expect(result).toContain('--- Party Pokémon Summary (FILE MODE) ---')
      expect(result).toContain('Player Name: John')
    })

    it('should show debug output with --debug flag', () => {
      const result = execSync(`tsx "${cliPath}" "${testSavePath}" --debug`, { encoding: 'utf8' })
      expect(result).toContain('--- Party Pokémon Summary (FILE MODE) ---')
      expect(result).toContain('--- Party Pokémon Raw Bytes ---')
      expect(result).toMatch(/^[0-9a-f\s]+$/m) // Should contain hex bytes
    })

    it('should show graph output with --graph flag', () => {
      const result = execSync(`tsx "${cliPath}" "${testSavePath}" --graph`, { encoding: 'utf8' })
      expect(result).toContain('Slot 1 (')
      expect(result).toContain('personality')
      // Should not contain the summary table when using --graph
      expect(result).not.toContain('--- Party Pokémon Summary ---')
    })
  })

  describe('Error handling', () => {
    it('should handle corrupted save file gracefully', () => {
      const corruptedSavePath = resolve(tempDir, 'corrupted.sav')
      writeFileSync(corruptedSavePath, Buffer.alloc(1000, 0xFF)) // 1KB of 0xFF bytes

      expect(() => {
        execSync(`tsx "${cliPath}" "${corruptedSavePath}"`, { encoding: 'utf8', stdio: 'pipe' })
      }).toThrow()

      try {
        execSync(`tsx "${cliPath}" "${corruptedSavePath}"`, { encoding: 'utf8', stdio: 'pipe' })
      } catch (error: unknown) {
        const execError = error as Error & { stderr?: string, stdout?: string, status?: number }
        expect(execError.stderr ?? execError.stdout).toContain('❌ Failed to parse save data:')
        expect(execError.status).toBe(1)
      }
    })
  })

  describe('CLI flag combinations', () => {
    it('should prioritize string conversion over file parsing', () => {
      const result = execSync(`tsx "${cliPath}" "${testSavePath}" --toBytes=PIKACHU`, { encoding: 'utf8' })
      expect(result).toContain('GBA bytes for "PIKACHU":')
      // Should not contain save file parsing output
      expect(result).not.toContain('Active save slot:')
    })
  })
})
