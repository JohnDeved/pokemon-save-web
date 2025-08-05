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
   * Perform comprehensive analysis to find partyData address patterns dynamically
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

    // Step 1: Dump memory regions for analysis
    console.log('Dumping EWRAM for analysis...')
    await this.dumper.dumpEWRAM(`${outputDir}/ewram_dump.bin`)
    
    console.log('Dumping IWRAM for analysis...')
    await this.dumper.dumpIWRAM(`${outputDir}/iwram_dump.bin`)

    // Step 2: Read comprehensive memory regions for pattern scanning
    // Include ROM area (where instructions are) and EWRAM (where data is)
    const scanRegions = await this.dumper.readRegionsAroundAddresses([
      0x08000000, // ROM start
      0x02000000, // EWRAM start  
      knownAddresses.vanilla,
      knownAddresses.quetzal
    ], 0x4000) // 16KB context around each address

    console.log(`Scanning ${scanRegions.length} memory regions for party data patterns...`)

    // Step 3: Use new dynamic scanning approach
    const instructionMatches = this.matcher.scanForPartyDataReferences(scanRegions)
    
    // Step 4: Also scan for direct address references without a specific target
    const addressMatches = this.matcher.findAddressReferences(scanRegions)
    
    // Step 5: Combine results and find the most likely party data address
    const allMatches = [...instructionMatches, ...addressMatches]
    let detectedAddress = this.detectPartyDataAddressDynamic(allMatches)
    
    // Step 6: Fallback to game-based detection if dynamic detection fails
    if (!detectedAddress) {
      // Determine expected address based on game title for fallback
      detectedAddress = gameTitle.toLowerCase().includes('quetzal') 
        ? knownAddresses.quetzal 
        : knownAddresses.vanilla
      console.log(`Dynamic detection failed, using fallback address: 0x${detectedAddress.toString(16)}`)
    }
    
    // Step 7: Calculate confidence based on how many patterns point to the detected address
    const confidence = this.calculateDetectionConfidence(allMatches, detectedAddress)
    
    // Step 8: Filter to best matches for reporting
    const bestMatches = allMatches
      .filter(match => match.confidence > 0.3)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20) // Top 20 matches

    // Step 9: Generate IDA-style patterns for the detected address
    const suggestedPatterns = this.generateIdaStylePatterns(bestMatches, detectedAddress)

    // Step 10: Save detailed analysis results
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
   * Dynamically detect party data address from pattern matches
   */
  private detectPartyDataAddressDynamic(matches: PatternMatch[]): number | undefined {
    // Count frequency of referenced addresses
    const addressCounts = new Map<number, { count: number, totalConfidence: number }>()
    
    for (const match of matches) {
      if (match.context?.referencedAddress) {
        const addr = match.context.referencedAddress
        const current = addressCounts.get(addr) || { count: 0, totalConfidence: 0 }
        addressCounts.set(addr, {
          count: current.count + 1,
          totalConfidence: current.totalConfidence + match.confidence
        })
      }
    }
    
    if (addressCounts.size === 0) {
      return undefined
    }
    
    // Find address with highest combined score (frequency * confidence)
    let bestAddress: number | undefined
    let bestScore = 0
    
    for (const [address, stats] of addressCounts.entries()) {
      // Only consider addresses that look like party data
      if (!this.isLikelyPartyDataAddress(address)) {
        continue
      }
      
      const score = stats.count * stats.totalConfidence
      if (score > bestScore) {
        bestScore = score
        bestAddress = address
      }
    }
    
    return bestAddress
  }
  
  /**
   * Calculate confidence in the detected address
   */  
  private calculateDetectionConfidence(matches: PatternMatch[], detectedAddress?: number): number {
    if (!detectedAddress) {
      return 0.0
    }
    
    // Count matches that point to the detected address
    const matchingCount = matches.filter(match => 
      match.context?.referencedAddress === detectedAddress
    ).length
    
    // Base confidence from number of matches
    let confidence = Math.min(0.9, matchingCount * 0.1)
    
    // Boost confidence if we have instruction-based matches (more reliable)
    const instructionMatches = matches.filter(match => 
      match.context?.referencedAddress === detectedAddress &&
      match.context?.instructionType?.includes('ida_')
    ).length
    
    if (instructionMatches > 0) {
      confidence += 0.1
    }
    
    return confidence
  }

  /**
   * Check if address looks like party data
   */
  private isLikelyPartyDataAddress(address: number): boolean {
    // Party data is typically in EWRAM (0x02000000 - 0x02040000)
    const isInEWRAM = address >= 0x02000000 && address < 0x02040000
    
    // Address should be reasonably aligned (at least 4-byte aligned for structures)
    const isAligned = (address & 0x3) === 0
    
    // Typical party data addresses are in the range we've seen
    const isInTypicalRange = address >= 0x02020000 && address < 0x02030000
    
    return isInEWRAM && isAligned && isInTypicalRange
  }

  /**
   * Generate IDA-style patterns based on analysis results
   */
  private generateIdaStylePatterns(matches: PatternMatch[], detectedAddress?: number): BytePattern[] {
    const suggested: BytePattern[] = []

    // Extract the best instruction-based patterns
    const instructionMatches = matches.filter(match => 
      match.confidence > 0.3 && 
      match.context?.instructionType?.includes('ida_')
    )

    for (const match of instructionMatches.slice(0, 3)) { // Top 3
      // Create IDA-style pattern with wildcards
      const idaPattern = this.createIdaStylePattern(match)
      if (idaPattern) {
        idaPattern.expectedAddress = detectedAddress // Set expected address
        suggested.push(idaPattern)
      }
    }

    // Add a generic pattern for the detected address if found
    if (detectedAddress) {
      suggested.push({
        name: 'ida_detected_address',
        description: `IDA pattern for detected party data address 0x${detectedAddress.toString(16)}`,
        pattern: new Uint8Array([0x00, 0x00, 0x02, 0x02]), // Generic EWRAM pattern
        mask: new Uint8Array([0x00, 0x00, 0xFF, 0xFF]),     // ?? ?? 02 02
        expectedAddress: detectedAddress
      })
    }

    // If we don't have many patterns, add some generic IDA-style patterns for party data detection
    if (suggested.length < 2) {
      suggested.push({
        name: 'ida_generic_arm_ldr',
        description: 'Generic IDA pattern for ARM LDR PC-relative instructions',
        pattern: new Uint8Array([0x9F, 0x00, 0x00, 0xE5]),
        mask: new Uint8Array([0xFF, 0x00, 0xF0, 0xFF]),
        expectedAddress: detectedAddress
      })
      
      suggested.push({
        name: 'ida_generic_thumb_ldr',
        description: 'Generic IDA pattern for Thumb LDR PC-relative instructions',
        pattern: new Uint8Array([0x48, 0x00]),
        mask: new Uint8Array([0xF8, 0x00]),
        expectedAddress: detectedAddress
      })
      
      suggested.push({
        name: 'ida_generic_ewram_ref',
        description: 'Generic IDA pattern for EWRAM address references',
        pattern: new Uint8Array([0x00, 0x00, 0x02, 0x02]),
        mask: new Uint8Array([0x00, 0x00, 0xFF, 0xFF]),
        expectedAddress: detectedAddress
      })
    }

    return suggested
  }
  
  /**
   * Create IDA-style pattern from a pattern match
   */
  private createIdaStylePattern(match: PatternMatch): BytePattern | null {
    const { pattern, matchedBytes } = match
    
    // Create a more generic version of the matched pattern
    let idaPattern: Uint8Array
    let idaMask: Uint8Array
    
    switch (pattern.name) {
      case 'ida_arm_ldr_pc':
        // Keep opcode bytes, wildcard register and immediate
        idaPattern = new Uint8Array([0x9F, 0x00, 0x00, 0xE5])
        idaMask = new Uint8Array([0xFF, 0x00, 0xF0, 0xFF])
        break
        
      case 'ida_thumb_ldr_pc':
        // Keep opcode, wildcard register and immediate
        idaPattern = new Uint8Array([0x48, 0x00])
        idaMask = new Uint8Array([0xF8, 0x00])
        break
        
      case 'ida_direct_address':
        // Keep high bytes that indicate EWRAM
        idaPattern = new Uint8Array([0x00, 0x00, 0x02, 0x02])
        idaMask = new Uint8Array([0x00, 0x00, 0xFF, 0xFF])
        break
        
      default:
        return null
    }
    
    return {
      name: `ida_${pattern.name}_generic`,
      description: `Generic IDA pattern derived from ${pattern.name}`,
      pattern: idaPattern,
      mask: idaMask
    }
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
   * Quick analysis focused on finding party data addresses dynamically
   */
  async quickAddressAnalysis(targetAddress?: number, outputDir = '/tmp/memory-analysis'): Promise<PatternMatch[]> {
    console.log('Quick analysis for party data address detection')

    // Read regions around typical party data locations
    const scanAddresses = targetAddress ? [targetAddress] : [0x02020000, 0x02025000, 0x02030000]
    const regions = await this.dumper.readRegionsAroundAddresses(scanAddresses, 0x2000)
    
    // Use new dynamic scanning approach
    const instructionMatches = this.matcher.scanForPartyDataReferences(regions)
    const addressMatches = this.matcher.findAddressReferences(regions, targetAddress)
    
    const allMatches = [...instructionMatches, ...addressMatches]
    const topMatches = allMatches
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10)
    
    // Write quick report
    const detectedAddress = this.detectPartyDataAddressDynamic(allMatches)
    const report = {
      targetAddress: targetAddress ? `0x${targetAddress.toString(16)}` : 'auto-detect',
      detectedAddress: detectedAddress ? `0x${detectedAddress.toString(16)}` : 'not found',
      matches: topMatches.map(match => ({
        address: `0x${match.address.toString(16)}`,
        confidence: match.confidence,
        patternName: match.pattern.name,
        matchedBytes: Array.from(match.matchedBytes),
        referencedAddress: match.context?.referencedAddress ? 
          `0x${match.context.referencedAddress.toString(16)}` : undefined,
        context: match.context
      }))
    }

    const outputFile = targetAddress ? 
      `${outputDir}/quick_analysis_${targetAddress.toString(16)}.json` :
      `${outputDir}/quick_analysis_auto.json`
      
    writeFileSync(outputFile, JSON.stringify(report, null, 2))
    
    return topMatches
  }
}