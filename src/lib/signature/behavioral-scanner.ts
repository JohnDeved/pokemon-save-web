/**
 * Behavioral Universal Pattern Scanner
 * 
 * This scanner finds partyData addresses by analyzing behavioral patterns
 * in ARM/THUMB code without knowing target addresses beforehand.
 */

import { 
  BEHAVIORAL_PATTERNS, 
  parseHexPattern, 
  matchesPattern 
} from './behavioral-patterns.js';

export interface ScanResult {
  address: number;
  confidence: 'high' | 'medium' | 'low';
  pattern: string;
  method: string;
  matches: number;
  offset: number;
}

export interface ScanOptions {
  startOffset?: number;
  endOffset?: number;
  maxMatches?: number;
  minConfidence?: 'high' | 'medium' | 'low';
}

/**
 * Scan ROM buffer for behavioral patterns that indicate partyData access
 */
export function scanBehavioralPatterns(buffer: Uint8Array, options: ScanOptions = {}): ScanResult[] {
  const {
    startOffset = 0,
    endOffset = buffer.length,
    maxMatches = 10,
    minConfidence = 'low'
  } = options;

  const results: ScanResult[] = [];
  const foundAddresses = new Set<number>();

  console.log(`🔍 Scanning ${((endOffset - startOffset) / 1024 / 1024).toFixed(1)}MB for behavioral patterns...`);
  
  for (const pattern of BEHAVIORAL_PATTERNS) {
    // Skip patterns that don't meet confidence requirement
    if (minConfidence === 'high' && pattern.confidence !== 'high') continue;
    if (minConfidence === 'medium' && pattern.confidence === 'low') continue;

    console.log(`\n📋 Testing pattern: ${pattern.name}`);
    console.log(`   Description: ${pattern.description}`);
    console.log(`   Pattern: ${pattern.hexPattern}`);
    
    const parsedPattern = parseHexPattern(pattern.hexPattern);
    let patternMatches = 0;
    
    // Scan through the buffer looking for this pattern
    for (let offset = startOffset; offset <= endOffset - parsedPattern.bytes.length; offset++) {
      if (matchesPattern(buffer, offset, parsedPattern)) {
        // Found a pattern match - try to extract address
        const address = pattern.extractAddress(buffer, offset);
        
        if (address && !foundAddresses.has(address)) {
          foundAddresses.add(address);
          patternMatches++;
          
          results.push({
            address,
            confidence: pattern.confidence,
            pattern: pattern.name,
            method: 'behavioral_analysis',
            matches: patternMatches,
            offset
          });
          
          console.log(`   ✅ Found address: 0x${address.toString(16).toUpperCase().padStart(8, '0')} at offset 0x${offset.toString(16)}`);
          
          if (results.length >= maxMatches) {
            console.log(`   ⚠️  Reached max matches limit (${maxMatches})`);
            break;
          }
        } else if (address) {
          patternMatches++;
        }
      }
    }
    
    console.log(`   📊 Pattern matches: ${patternMatches}, unique addresses: ${results.filter(r => r.pattern === pattern.name).length}`);
  }

  // Sort results by confidence and number of matches
  results.sort((a, b) => {
    const confidenceOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    const confDiff = confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
    if (confDiff !== 0) return confDiff;
    return b.matches - a.matches;
  });

  return results;
}

/**
 * Find the most likely partyData address using behavioral analysis
 */
export function findPartyDataBehavioral(buffer: Uint8Array, options: ScanOptions = {}): ScanResult | null {
  const results = scanBehavioralPatterns(buffer, options);
  
  if (results.length === 0) {
    console.log('❌ No behavioral patterns found');
    return null;
  }

  // Group results by address to find consensus
  const addressCounts = new Map<number, { count: number, totalConfidence: number, patterns: string[] }>();
  
  for (const result of results) {
    const current = addressCounts.get(result.address) || { count: 0, totalConfidence: 0, patterns: [] };
    current.count++;
    current.totalConfidence += result.confidence === 'high' ? 3 : result.confidence === 'medium' ? 2 : 1;
    current.patterns.push(result.pattern);
    addressCounts.set(result.address, current);
  }

  // Find address with highest confidence and pattern count
  let bestAddress = 0;
  let bestScore = 0;
  let bestResult: ScanResult | null = null;

  for (const [address, data] of addressCounts) {
    const score = data.count * data.totalConfidence;
    if (score > bestScore) {
      bestScore = score;
      bestAddress = address;
      bestResult = results.find(r => r.address === address) || null;
    }
  }

  if (bestResult) {
    const consensus = addressCounts.get(bestAddress)!;
    console.log(`\n🎯 Best candidate: 0x${bestAddress.toString(16).toUpperCase().padStart(8, '0')}`);
    console.log(`   Confidence: ${bestResult.confidence}`);
    console.log(`   Supporting patterns: ${consensus.count}`);
    console.log(`   Pattern types: ${consensus.patterns.join(', ')}`);
    console.log(`   Score: ${bestScore}`);
  }

  return bestResult;
}

/**
 * Validate if an address looks like valid partyData
 */
export function validatePartyDataAddress(address: number): boolean {
  // Basic validation - should be in RAM range
  if (address < 0x02000000 || address > 0x02040000) {
    return false;
  }

  // Should be word-aligned
  if (address % 4 !== 0) {
    return false;
  }

  // Should be in typical party data range
  if (address < 0x02020000 || address > 0x02030000) {
    return false;
  }

  return true;
}

/**
 * Enhanced scan that also validates discovered addresses
 */
export function scanAndValidate(buffer: Uint8Array, options: ScanOptions = {}): ScanResult[] {
  const results = scanBehavioralPatterns(buffer, options);
  
  return results.filter(result => {
    const isValid = validatePartyDataAddress(result.address);
    if (!isValid) {
      console.log(`⚠️  Filtered out invalid address: 0x${result.address.toString(16)} (out of expected range)`);
    }
    return isValid;
  });
}