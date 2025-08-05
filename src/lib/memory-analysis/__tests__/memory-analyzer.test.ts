/**
 * Integration tests for the memory analysis CLI tool
 * Tests the pattern detection functionality without requiring actual mGBA connection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryAnalyzer } from '../memory-analyzer'
import { BytePatternMatcher } from '../byte-pattern-matcher'
import type { MgbaWebSocketClient } from '../../mgba/websocket-client'
import { mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs'

// Mock mGBA client for testing
const createMockClient = (gameTitle: string, memoryData: Map<number, Uint8Array>): MgbaWebSocketClient => {
  const mockClient = {
    isConnected: vi.fn(() => true),
    getGameTitle: vi.fn(async () => gameTitle),
    readBytes: vi.fn(async (address: number, size: number) => {
      // Find overlapping memory regions and combine them
      const result = new Uint8Array(size)
      let filled = 0

      for (const [memAddr, data] of memoryData.entries()) {
        const overlapStart = Math.max(address, memAddr)
        const overlapEnd = Math.min(address + size, memAddr + data.length)
        
        if (overlapStart < overlapEnd) {
          const sourceOffset = overlapStart - memAddr
          const targetOffset = overlapStart - address
          const copyLength = overlapEnd - overlapStart
          
          result.set(data.subarray(sourceOffset, sourceOffset + copyLength), targetOffset)
          filled += copyLength
        }
      }

      if (filled === 0) {
        // Return zeros for unmapped memory
        return new Uint8Array(size)
      }

      return result
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as MgbaWebSocketClient

  return mockClient
}

describe('Memory Analysis Integration', () => {
  const testOutputDir = '/tmp/memory-analysis-test'

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true })
    }
    mkdirSync(testOutputDir, { recursive: true })
  })

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true })
    }
  })

  describe('Pattern Detection for Vanilla Emerald', () => {
    it('should detect partyData address patterns in vanilla emerald memory', async () => {
      const vanillaAddress = 0x20244EC
      
      // Create mock memory data with references to the party data address
      const memoryData = new Map<number, Uint8Array>()
      
      // Add some fake code that references the party data address
      const codeRegion = new Uint8Array(0x2000)
      // Direct address reference at offset 0x100
      codeRegion[0x100] = 0xEC
      codeRegion[0x101] = 0x44
      codeRegion[0x102] = 0x02
      codeRegion[0x103] = 0x02
      
      // Thumb LDR instruction that would reference this address
      codeRegion[0x200] = 0x01 // LDR r0, [PC, #4]
      codeRegion[0x201] = 0x48
      codeRegion[0x204] = 0xEC // Address reference
      codeRegion[0x205] = 0x44
      codeRegion[0x206] = 0x02
      codeRegion[0x207] = 0x02

      memoryData.set(0x2020000, codeRegion)

      const mockClient = createMockClient('POKEMON EMERALD', memoryData)
      const analyzer = new MemoryAnalyzer(mockClient)

      const result = await analyzer.analyzePartyDataPatterns(
        { vanilla: vanillaAddress, quetzal: 0x20235B8 },
        testOutputDir
      )

      expect(result.romName).toBe('Pokemon Emerald (Vanilla)')
      expect(result.detectedPartyDataAddress).toBe(vanillaAddress)
      expect(result.patterns.length).toBeGreaterThan(0)
      
      // Should find direct address references
      const addressMatches = result.patterns.filter(p => 
        p.pattern.name === 'address_reference' && 
        p.context?.referencedAddress === vanillaAddress
      )
      expect(addressMatches.length).toBeGreaterThan(0)

      // Check that analysis files were created
      expect(existsSync(`${testOutputDir}/analysis_report.json`)).toBe(true)
      expect(existsSync(`${testOutputDir}/analysis_report.txt`)).toBe(true)
    })
  })

  describe('Pattern Detection for Quetzal', () => {
    it('should detect partyData address patterns in quetzal memory', async () => {
      const quetzalAddress = 0x20235B8

      // Create mock memory data with references to the quetzal party data address
      const memoryData = new Map<number, Uint8Array>()
      
      const codeRegion = new Uint8Array(0x2000)
      // Direct address reference
      codeRegion[0x150] = 0xB8
      codeRegion[0x151] = 0x35
      codeRegion[0x152] = 0x02
      codeRegion[0x153] = 0x02

      // ARM instruction that references this address
      codeRegion[0x300] = 0xB8 // Immediate value
      codeRegion[0x301] = 0x35
      codeRegion[0x302] = 0x02
      codeRegion[0x303] = 0x02

      memoryData.set(0x2020000, codeRegion)

      const mockClient = createMockClient('Pokemon Quetzal', memoryData)
      const analyzer = new MemoryAnalyzer(mockClient)

      const result = await analyzer.analyzePartyDataPatterns(
        { vanilla: 0x20244EC, quetzal: quetzalAddress },
        testOutputDir
      )

      expect(result.romName).toBe('Pokemon Quetzal')
      expect(result.detectedPartyDataAddress).toBe(quetzalAddress)
      expect(result.patterns.length).toBeGreaterThan(0)

      // Should find direct address references
      const addressMatches = result.patterns.filter(p => 
        p.pattern.name === 'address_reference' && 
        p.context?.referencedAddress === quetzalAddress
      )
      expect(addressMatches.length).toBeGreaterThan(0)
    })
  })

  describe('Pattern Creation and Validation', () => {
    it('should create different patterns for different ROM variants', () => {
      const vanillaPatterns = BytePatternMatcher.createPartyDataPatterns(0x20244EC)
      const quetzalPatterns = BytePatternMatcher.createPartyDataPatterns(0x20235B8)

      expect(vanillaPatterns.length).toBeGreaterThan(0)
      expect(quetzalPatterns.length).toBeGreaterThan(0)

      // Direct address patterns should be different
      const vanillaDirect = vanillaPatterns.find(p => p.name === 'direct_address')
      const quetzalDirect = quetzalPatterns.find(p => p.name === 'direct_address')

      expect(vanillaDirect).toBeDefined()
      expect(quetzalDirect).toBeDefined()
      expect(vanillaDirect!.pattern).not.toEqual(quetzalDirect!.pattern)

      // Verify the actual byte patterns are correct (little-endian)
      expect(Array.from(vanillaDirect!.pattern)).toEqual([0xEC, 0x44, 0x02, 0x02])
      expect(Array.from(quetzalDirect!.pattern)).toEqual([0xB8, 0x35, 0x02, 0x02])
    })

    it('should generate suggested patterns based on analysis results', async () => {
      const targetAddress = 0x20244EC
      const memoryData = new Map<number, Uint8Array>()
      
      // Create memory with multiple high-confidence pattern matches
      const codeRegion = new Uint8Array(0x1000)
      
      // Multiple Thumb LDR instructions referencing the address
      for (let i = 0; i < 5; i++) {
        const offset = i * 0x100
        codeRegion[offset] = 0x01 + i  // Different register
        codeRegion[offset + 1] = 0x48  // LDR opcode
      }

      memoryData.set(0x2020000, codeRegion)

      const mockClient = createMockClient('POKEMON EMERALD', memoryData)
      const analyzer = new MemoryAnalyzer(mockClient)

      const result = await analyzer.analyzePartyDataPatterns(
        { vanilla: targetAddress, quetzal: 0x20235B8 },
        testOutputDir
      )

      expect(result.suggestedPatterns.length).toBeGreaterThan(0)
      
      // Each suggested pattern should have a meaningful name and description
      for (const pattern of result.suggestedPatterns) {
        expect(pattern.name).toBeTruthy()
        expect(pattern.description).toBeTruthy()
        expect(pattern.pattern.length).toBeGreaterThan(0)
        expect(pattern.expectedAddress).toBe(targetAddress)
      }
    })
  })

  describe('Quick Analysis', () => {
    it('should perform quick analysis around specific address', async () => {
      const targetAddress = 0x20244EC
      const memoryData = new Map<number, Uint8Array>()
      
      // Create memory region around the target address
      const region = new Uint8Array(0x2000)
      
      // Add direct reference
      region[0x1000] = 0xEC
      region[0x1001] = 0x44  
      region[0x1002] = 0x02
      region[0x1003] = 0x02

      // Add near reference
      region[0x1100] = 0xF0 // +4 from target
      region[0x1101] = 0x44
      region[0x1102] = 0x02
      region[0x1103] = 0x02

      memoryData.set(targetAddress - 0x1000, region)

      const mockClient = createMockClient('POKEMON EMERALD', memoryData)
      const analyzer = new MemoryAnalyzer(mockClient)

      const matches = await analyzer.quickAddressAnalysis(targetAddress, testOutputDir)

      expect(matches.length).toBeGreaterThan(0)
      
      // Should find exact match with high confidence
      const exactMatch = matches.find(m => m.context?.referencedAddress === targetAddress)
      expect(exactMatch).toBeDefined()
      expect(exactMatch!.confidence).toBeCloseTo(1.0, 1)

      // Should find near match with lower confidence  
      const nearMatch = matches.find(m => m.context?.referencedAddress === targetAddress + 4)
      expect(nearMatch).toBeDefined()
      expect(nearMatch!.confidence).toBeLessThan(1.0)

      // Check that quick analysis file was created
      expect(existsSync(`${testOutputDir}/quick_analysis_${targetAddress.toString(16)}.json`)).toBe(true)
    })
  })

  describe('Report Generation', () => {
    it('should generate comprehensive analysis reports', async () => {
      const memoryData = new Map<number, Uint8Array>()
      const codeRegion = new Uint8Array(0x1000)
      codeRegion[0x100] = 0xEC
      codeRegion[0x101] = 0x44
      codeRegion[0x102] = 0x02
      codeRegion[0x103] = 0x02
      memoryData.set(0x2020000, codeRegion)

      const mockClient = createMockClient('POKEMON EMERALD', memoryData)
      const analyzer = new MemoryAnalyzer(mockClient)

      await analyzer.analyzePartyDataPatterns(
        { vanilla: 0x20244EC, quetzal: 0x20235B8 },
        testOutputDir
      )

      // Check JSON report
      const jsonReportPath = `${testOutputDir}/analysis_report.json`
      expect(existsSync(jsonReportPath)).toBe(true)
      
      const jsonReport = JSON.parse(readFileSync(jsonReportPath, 'utf-8'))
      expect(jsonReport.romName).toBeTruthy()
      expect(jsonReport.gameTitle).toBeTruthy()
      expect(jsonReport.detectedPartyDataAddress).toBeTruthy()
      expect(jsonReport.confidence).toBeTypeOf('number')
      expect(Array.isArray(jsonReport.patterns)).toBe(true)
      expect(Array.isArray(jsonReport.suggestedPatterns)).toBe(true)

      // Check text report
      const textReportPath = `${testOutputDir}/analysis_report.txt`
      expect(existsSync(textReportPath)).toBe(true)
      
      const textReport = readFileSync(textReportPath, 'utf-8')
      expect(textReport).toContain('Memory Analysis Report')
      expect(textReport).toContain('ROM:')
      expect(textReport).toContain('Pattern Matches')
      expect(textReport).toContain('Suggested Patterns')
    })
  })
})