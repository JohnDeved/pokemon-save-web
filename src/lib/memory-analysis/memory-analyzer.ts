/**
 * Main memory analyzer that coordinates dumping, pattern matching, and analysis
 */

import { MgbaWebSocketClient } from '../mgba/websocket-client'
import { MemoryDumper } from './memory-dumper'
import { BytePatternMatcher } from './byte-pattern-matcher'
import type { AnalysisResult, BytePattern, PatternMatch, MemoryRegion } from './types'
import { writeFileSync } from 'node:fs'

export class MemoryAnalyzer {
  private dumper: MemoryDumper
  private matcher: BytePatternMatcher

  constructor(private client: MgbaWebSocketClient) {
    this.dumper = new MemoryDumper(client)
    this.matcher = new BytePatternMatcher()
  }

  /**
   * Get the memory dumper instance for direct access
   */
  getMemoryDumper(): MemoryDumper {
    return this.dumper
  }

  /**
   * Perform comprehensive analysis to find partyData address patterns
   */
  async analyzePartyDataPatterns(
    knownAddresses: { vanilla: number, quetzal: number },
    outputDir = '/tmp/memory-analysis'
  ): Promise<AnalysisResult> {
    if (!this.client.isConnected()) {
      throw new Error('mGBA client must be connected before analysis')
    }

    const gameTitle = await this.client.getGameTitle()
    console.log(`Analyzing patterns for game: ${gameTitle}`)

    // Determine which address to expect based on game title
    const expectedAddress = gameTitle.toLowerCase().includes('quetzal') 
      ? knownAddresses.quetzal 
      : knownAddresses.vanilla

    console.log(`Expected partyData address: 0x${expectedAddress.toString(16)}`)

    // Step 1: Dump memory regions for analysis
    console.log('Dumping EWRAM for analysis...')
    await this.dumper.dumpEWRAM(`${outputDir}/ewram_dump.bin`)
    
    console.log('Dumping IWRAM for analysis...')
    await this.dumper.dumpIWRAM(`${outputDir}/iwram_dump.bin`)

    // Step 2: Read specific regions around known addresses
    const contextRegions = await this.dumper.readRegionsAroundAddresses([
      knownAddresses.vanilla,
      knownAddresses.quetzal
    ], 0x2000) // 8KB context around each address

    // Step 3: Create patterns to search for
    const patterns = BytePatternMatcher.createPartyDataPatterns(expectedAddress)
    
    // Also create patterns for the other known address to see if we find cross-references
    const alternateAddress = expectedAddress === knownAddresses.vanilla 
      ? knownAddresses.quetzal 
      : knownAddresses.vanilla
    const alternatePatterns = BytePatternMatcher.createPartyDataPatterns(alternateAddress)
    
    const allPatterns = [...patterns, ...alternatePatterns]

    // Step 4: Search for patterns
    console.log(`Searching for ${allPatterns.length} patterns in memory regions...`)
    const patternMatches = this.matcher.findPatterns(contextRegions, allPatterns)

    // Step 5: Search for direct address references
    console.log('Searching for direct address references...')
    const addressMatches = this.matcher.findAddressReferences(contextRegions, expectedAddress, 0x10)
    
    // Step 6: Combine and analyze results
    const allMatches = [...patternMatches, ...addressMatches]
    const bestMatches = allMatches
      .filter(match => match.confidence > 0.6)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20) // Top 20 matches

    // Step 7: Try to detect the actual partyData address
    const detectedAddress = this.detectPartyDataAddress(bestMatches, expectedAddress)
    const confidence = detectedAddress === expectedAddress ? 0.9 : 0.3

    // Step 8: Generate suggested patterns for future detection
    const suggestedPatterns = this.generateSuggestedPatterns(bestMatches, detectedAddress)

    // Step 9: Save detailed analysis results
    const result: AnalysisResult = {
      romName: this.extractRomName(gameTitle),
      gameTitle,
      detectedPartyDataAddress: detectedAddress,
      confidence,
      patterns: bestMatches,
      suggestedPatterns
    }

    // Write analysis report
    this.writeAnalysisReport(result, `${outputDir}/analysis_report.json`)
    this.writeHumanReadableReport(result, `${outputDir}/analysis_report.txt`)

    return result
  }

  /**
   * Try to detect the actual partyData address from pattern matches
   */
  private detectPartyDataAddress(matches: PatternMatch[], expectedAddress: number): number {
    // Look for high-confidence matches that reference an address
    const addressReferences = matches
      .filter(match => match.context?.referencedAddress)
      .map(match => match.context!.referencedAddress!)

    if (addressReferences.length === 0) {
      return expectedAddress // Fallback to expected
    }

    // Find the most common referenced address
    const addressCounts = new Map<number, number>()
    for (const addr of addressReferences) {
      addressCounts.set(addr, (addressCounts.get(addr) ?? 0) + 1)
    }

    const mostCommon = [...addressCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      [0]

    return mostCommon ? mostCommon[0] : expectedAddress
  }

  /**
   * Generate suggested byte patterns based on analysis results
   */
  private generateSuggestedPatterns(matches: PatternMatch[], detectedAddress: number): BytePattern[] {
    const suggested: BytePattern[] = []

    // Extract high-confidence instruction patterns
    const instructionMatches = matches.filter(match => 
      match.confidence > 0.8 && match.context?.instructionType
    )

    for (const match of instructionMatches.slice(0, 5)) { // Top 5
      suggested.push({
        name: `suggested_${match.context!.instructionType}`,
        description: `High-confidence ${match.context!.instructionType} pattern found at 0x${match.address.toString(16)}`,
        pattern: match.matchedBytes,
        expectedAddress: detectedAddress
      })
    }

    return suggested
  }

  /**
   * Extract ROM name from game title
   */
  private extractRomName(gameTitle: string): string {
    if (gameTitle.toLowerCase().includes('quetzal')) {
      return 'Pokemon Quetzal'
    }
    if (gameTitle.toLowerCase().includes('emerald')) {
      return 'Pokemon Emerald (Vanilla)'
    }
    return gameTitle
  }

  /**
   * Write detailed JSON analysis report
   */
  private writeAnalysisReport(result: AnalysisResult, outputPath: string): void {
    const reportData = {
      ...result,
      patterns: result.patterns.map(match => ({
        pattern: {
          name: match.pattern.name,
          description: match.pattern.description,
          patternBytes: Array.from(match.pattern.pattern),
          expectedAddress: match.pattern.expectedAddress
        },
        address: `0x${match.address.toString(16)}`,
        matchedBytes: Array.from(match.matchedBytes),
        confidence: match.confidence,
        context: match.context
      })),
      detectedPartyDataAddress: result.detectedPartyDataAddress 
        ? `0x${result.detectedPartyDataAddress.toString(16)}`
        : undefined
    }

    writeFileSync(outputPath, JSON.stringify(reportData, null, 2))
    console.log(`Analysis report written to: ${outputPath}`)
  }

  /**
   * Write human-readable analysis report
   */
  private writeHumanReadableReport(result: AnalysisResult, outputPath: string): void {
    const lines = [
      '# Memory Analysis Report',
      '',
      `**ROM:** ${result.romName}`,
      `**Game Title:** ${result.gameTitle}`,
      `**Detected Party Data Address:** ${result.detectedPartyDataAddress ? '0x' + result.detectedPartyDataAddress.toString(16) : 'Not detected'}`,
      `**Confidence:** ${(result.confidence * 100).toFixed(1)}%`,
      '',
      '## Pattern Matches',
      ''
    ]

    for (const match of result.patterns.slice(0, 10)) { // Top 10 matches
      lines.push(`### ${match.pattern.name}`)
      lines.push(`- **Address:** 0x${match.address.toString(16)}`)
      lines.push(`- **Confidence:** ${(match.confidence * 100).toFixed(1)}%`)
      lines.push(`- **Pattern:** ${Array.from(match.matchedBytes).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
      
      if (match.context) {
        lines.push(`- **Instruction Type:** ${match.context.instructionType ?? 'Unknown'}`)
        if (match.context.referencedAddress) {
          lines.push(`- **Referenced Address:** 0x${match.context.referencedAddress.toString(16)}`)
        }
      }
      
      lines.push('')
    }

    lines.push('## Suggested Patterns for Detection')
    lines.push('')

    for (const pattern of result.suggestedPatterns) {
      lines.push(`### ${pattern.name}`)
      lines.push(`- **Description:** ${pattern.description}`)
      lines.push(`- **Pattern:** ${Array.from(pattern.pattern).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
      lines.push('')
    }

    writeFileSync(outputPath, lines.join('\n'))
    console.log(`Human-readable report written to: ${outputPath}`)
  }

  /**
   * Quick analysis focused on a specific address
   */
  async quickAddressAnalysis(targetAddress: number, outputDir = '/tmp/memory-analysis'): Promise<PatternMatch[]> {
    console.log(`Quick analysis around address 0x${targetAddress.toString(16)}`)

    // Read a smaller region around the target address
    const region = await this.dumper.readMemoryRegion(targetAddress - 0x1000, 0x2000)
    
    // Search for address references
    const matches = this.matcher.findAddressReferences([region], targetAddress, 0x10)
    
    // Write quick report
    const report = {
      targetAddress: `0x${targetAddress.toString(16)}`,
      matches: matches.map(match => ({
        address: `0x${match.address.toString(16)}`,
        confidence: match.confidence,
        matchedBytes: Array.from(match.matchedBytes),
        context: match.context
      }))
    }

    writeFileSync(`${outputDir}/quick_analysis_${targetAddress.toString(16)}.json`, JSON.stringify(report, null, 2))
    
    return matches
  }
}