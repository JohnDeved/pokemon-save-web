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
  const testSavePath = resolve(testDataDir, 'player1.sav')
  const tempDir = resolve(__dirname, 'temp_cli_test')

  beforeAll(() => {
    // Create temp directory for test files
    mkdirSync(tempDir, { recursive: true })
  })

  afterAll(() => {
    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch (e) {
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
      } catch (error: any) {
        const output = error.stderr || error.stdout
        expect(output).toContain('Usage: tsx cli.ts <savefile.sav> [options]')
        expect(output).toContain('--debug')
        expect(output).toContain('--graph')
        expect(output).toContain('--toBytes')
        expect(output).toContain('--toString')
        expect(error.status).toBe(1)
      }
    })

    it('should show usage when invalid file provided', () => {
      expect(() => {
        execSync(`tsx "${cliPath}" nonexistent.sav`, { encoding: 'utf8', stdio: 'pipe' })
      }).toThrow()

      try {
        execSync(`tsx "${cliPath}" nonexistent.sav`, { encoding: 'utf8', stdio: 'pipe' })
      } catch (error: any) {
        const output = error.stderr || error.stdout
        expect(output).toContain('Usage: tsx cli.ts <savefile.sav> [options]')
        expect(error.status).toBe(1)
      }
    })

    it('should show usage when file without .sav extension provided', () => {
      const tempFile = resolve(tempDir, 'test.txt')
      writeFileSync(tempFile, 'test content')

      expect(() => {
        execSync(`tsx "${cliPath}" "${tempFile}"`, { encoding: 'utf8', stdio: 'pipe' })
      }).toThrow()

      try {
        execSync(`tsx "${cliPath}" "${tempFile}"`, { encoding: 'utf8', stdio: 'pipe' })
      } catch (error: any) {
        const output = error.stderr || error.stdout
        expect(output).toContain('Usage: tsx cli.ts <savefile.sav> [options]')
        expect(error.status).toBe(1)
      }
    })
  })

  describe('String conversion utilities', () => {
    it('should convert string to GBA bytes with --toBytes', () => {
      const result = execSync(`tsx "${cliPath}" --toBytes=PIKACHU`, { encoding: 'utf8' })
      expect(result).toContain('GBA bytes for "PIKACHU":')
      expect(result).toMatch(/^[0-9a-f\s]+$/m) // Should contain hex bytes
    })

    it('should convert hex bytes to string with --toString', () => {
      const result = execSync(`tsx "${cliPath}" --toString="50 49 4b 41 43 48 55 00"`, { encoding: 'utf8' })
      expect(result).toContain('String for bytes [50 49 4b 41 43 48 55 00]:')
      // GBA encoding converts to Japanese characters, not ASCII
      expect(result).toMatch(/っ.*/)
    })

    it('should handle comma-separated hex bytes in --toString', () => {
      const result = execSync(`tsx "${cliPath}" --toString="50,49,4b,41,43,48,55,00"`, { encoding: 'utf8' })
      expect(result).toContain('String for bytes [50 49 4b 41 43 48 55 00]:')
      // GBA encoding converts to Japanese characters, not ASCII
      expect(result).toMatch(/っ.*/)
    })

    it('should handle empty string in --toBytes', () => {
      const result = execSync(`tsx "${cliPath}" --toBytes=`, { encoding: 'utf8' })
      expect(result).toContain('GBA bytes for "":')
    })
  })

  describe('Save file parsing', () => {
    it('should parse valid save file and show basic output', () => {
      const result = execSync(`tsx "${cliPath}" "${testSavePath}"`, { encoding: 'utf8' })
      expect(result).toContain('Active save slot:')
      expect(result).toContain('Valid sectors found:')
      expect(result).toContain('--- Party Pokémon Summary ---')
      expect(result).toContain('--- SaveBlock2 Data ---')
      expect(result).toContain('Player Name:')
      expect(result).toContain('Play Time:')
    })

    it('should show debug output with --debug flag', () => {
      const result = execSync(`tsx "${cliPath}" "${testSavePath}" --debug`, { encoding: 'utf8' })
      expect(result).toContain('--- Party Pokémon Summary ---')
      expect(result).toContain('--- Party Pokémon Raw Bytes ---')
      expect(result).toMatch(/Slot \d+:.*---/s) // Should show slot details
      expect(result).toMatch(/^[0-9a-f\s]+$/m) // Should contain hex bytes
    })

    it('should show graph output with --graph flag', () => {
      const result = execSync(`tsx "${cliPath}" "${testSavePath}" --graph`, { encoding: 'utf8' })
      expect(result).toContain('Slot 1 (')
      expect(result).toContain('personality') // Should contain hex dump
      expect(result).toContain('──') // Should contain separators
      // Should not contain the summary table when using --graph
      expect(result).not.toContain('--- Party Pokémon Summary ---')
    })

    it('should contain expected Pokemon data in output', () => {
      const result = execSync(`tsx "${cliPath}" "${testSavePath}"`, { encoding: 'utf8' })

      // Should contain party Pokemon info
      expect(result).toContain('Slot')
      expect(result).toContain('Dex ID')
      expect(result).toContain('Nickname')
      expect(result).toContain('Lv')
      expect(result).toContain('HP')

      // Should contain player info
      expect(result).toContain('Player Name: John')
      expect(result).toMatch(/Play Time: \d+h \d+m \d+s/)
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
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain('Failed to parse save file:')
        expect(error.status).toBe(1)
      }
    })

    it('should handle empty save file', () => {
      const emptySavePath = resolve(tempDir, 'empty.sav')
      writeFileSync(emptySavePath, Buffer.alloc(0))

      expect(() => {
        execSync(`tsx "${cliPath}" "${emptySavePath}"`, { encoding: 'utf8', stdio: 'pipe' })
      }).toThrow()

      try {
        execSync(`tsx "${cliPath}" "${emptySavePath}"`, { encoding: 'utf8', stdio: 'pipe' })
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain('Failed to parse save file:')
        expect(error.status).toBe(1)
      }
    })

    it('should handle too small save file', () => {
      const smallSavePath = resolve(tempDir, 'small.sav')
      writeFileSync(smallSavePath, Buffer.alloc(100, 0x00)) // 100 bytes

      expect(() => {
        execSync(`tsx "${cliPath}" "${smallSavePath}"`, { encoding: 'utf8', stdio: 'pipe' })
      }).toThrow()

      try {
        execSync(`tsx "${cliPath}" "${smallSavePath}"`, { encoding: 'utf8', stdio: 'pipe' })
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain('Failed to parse save file:')
        expect(error.status).toBe(1)
      }
    })
  })

  describe('Output format validation', () => {
    it('should produce valid table format in summary mode', () => {
      const result = execSync(`tsx "${cliPath}" "${testSavePath}"`, { encoding: 'utf8' })

      // Check table structure
      const lines = result.split('\n')
      const summaryStart = lines.findIndex(line => line.includes('--- Party Pokémon Summary ---'))
      expect(summaryStart).toBeGreaterThan(-1)

      // Should have header and separator lines - line numbers are 0-indexed
      const headerLine = lines[summaryStart + 1] // Header is right after summary title
      const separatorLine = lines[summaryStart + 2] // Separator is after header

      expect(headerLine).toContain('Slot')
      expect(headerLine).toContain('Dex ID')
      expect(headerLine).toContain('Nickname')
      expect(separatorLine).toMatch(/^-+$/) // Should be all dashes
    })

    it('should produce valid hex dump format in graph mode', () => {
      const result = execSync(`tsx "${cliPath}" "${testSavePath}" --graph`, { encoding: 'utf8' })

      // Should contain hex addresses and bytes - test individual parts
      expect(result).toContain('0000:')
      expect(result).toContain('e4')
      expect(result).toContain('00')
      expect(result).toMatch(/Slot \d+ \([^)]+\):/)
    })

    it('should show HP bars correctly in summary', () => {
      const result = execSync(`tsx "${cliPath}" "${testSavePath}"`, { encoding: 'utf8' })

      // Should contain HP bars with filled and empty segments
      expect(result).toMatch(/\[█+░*\]/) // HP bar pattern
      expect(result).toMatch(/\d+\/\d+/) // Current/Max HP pattern
    })
  })

  describe('CLI flag combinations', () => {
    it('should handle multiple flags gracefully', () => {
      // --debug and --graph together (--graph should take precedence)
      const result = execSync(`tsx "${cliPath}" "${testSavePath}" --debug --graph`, { encoding: 'utf8' })
      expect(result).toContain('Active save slot:')
      expect(result).toContain('Slot 1 (')
      expect(result).toContain('personality')
      // Should not show summary table when --graph is used
      expect(result).not.toContain('--- Party Pokémon Summary ---')
    })

    it('should prioritize string conversion over file parsing', () => {
      const result = execSync(`tsx "${cliPath}" "${testSavePath}" --toBytes=TEST`, { encoding: 'utf8' })
      expect(result).toContain('GBA bytes for "TEST":')
      // Should not contain save file parsing output
      expect(result).not.toContain('Active save slot:')
    })
  })
})
