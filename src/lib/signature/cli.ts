#!/usr/bin/env tsx
/**
 * CLI tool for ASM signature extraction and analysis
 * Provides commands to dump memory, extract signatures, and test pattern matching
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { MemoryAnalysisOrchestrator, DockerMemoryDumper } from '../signature/memory-dumper'
import { createPartyDataScanner, PARTY_DATA_SIGNATURES } from '../signature/patterns'
import { SignatureExtractor } from '../signature/extractor'
import { testUniversalPatterns } from '../signature/universal-patterns'
import type { MemoryAccessContext } from '../signature/types'

interface CliOptions {
  command: string
  variant?: 'emerald' | 'quetzal'
  output?: string
  input?: string
  verbose?: boolean
  help?: boolean
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    command: args[0] || 'help',
  }

  for (let i = 1; i < args.length; i++) {
    const arg = args[i]!
    
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=')
      switch (key) {
        case 'variant':
          if (value === 'emerald' || value === 'quetzal') {
            options.variant = value
          }
          break
        case 'output':
          options.output = value
          break
        case 'input':
          options.input = value
          break
        case 'verbose':
          options.verbose = true
          break
        case 'help':
          options.help = true
          break
      }
    }
  }

  return options
}

function printHelp(): void {
  console.log(`
🔍 ASM Signature Extraction Tool

USAGE:
    signature-tool <command> [options]

COMMANDS:
    dump-memory      Dump memory from mGBA for signature analysis
    test-signatures  Test pre-defined signatures against memory dumps  
    scan-universal   Test universal patterns that work in both games
    extract-patterns Extract new patterns from memory access contexts
    scan-dump       Scan a memory dump file for signatures
    validate        Validate signatures work across both variants
    help            Show this help message

OPTIONS:
    --variant=emerald|quetzal   Select ROM variant (default: emerald)
    --output=DIR               Output directory for dumps/results (default: ./signature-output)
    --input=FILE               Input file for scanning/analysis
    --verbose                  Enable verbose logging
    --help                     Show help for specific command

EXAMPLES:
    # Dump memory from both variants for analysis
    signature-tool dump-memory --output=./dumps

    # Test universal patterns (recommended for both games)
    signature-tool scan-universal --input=./memory.bin --verbose

    # Test signatures against Emerald memory dump
    signature-tool test-signatures --variant=emerald --input=./dumps/emerald/memory_2000000_40000.bin

    # Scan a memory dump for all signatures
    signature-tool scan-dump --input=./memory.bin --variant=emerald

    # Validate signatures work on both variants
    signature-tool validate --input=./dumps

WORKFLOW:
    1. dump-memory      → Capture memory dumps from both ROM variants
    2. scan-universal   → Use universal patterns that work in both games (recommended)
    3. test-signatures  → Test pre-defined patterns against dumps  
    4. extract-patterns → Create new patterns from access contexts
    5. validate         → Ensure patterns work across variants
`)
}

async function dumpMemoryCommand(options: CliOptions): Promise<void> {
  const outputDir = options.output || './signature-output'
  const orchestrator = new MemoryAnalysisOrchestrator()

  console.log('🔧 Starting memory analysis...')
  console.log(`Output directory: ${outputDir}`)

  if (options.variant) {
    // Dump single variant
    console.log(`Dumping memory for ${options.variant}...`)
    const dumper = new DockerMemoryDumper()
    const dumps = await dumper.quickMemoryDump(options.variant, join(outputDir, options.variant))
    
    console.log(`✅ Memory dump complete. Files:`)
    dumps.forEach((file: string) => console.log(`  - ${file}`))
  } else {
    // Dump both variants with full analysis
    const results = await orchestrator.analyzePartyDataMemory(outputDir)
    
    console.log(`✅ Memory analysis complete!`)
    console.log(`Emerald dumps: ${results.emeraldDumps.length} files`)
    console.log(`Quetzal dumps: ${results.quetzalDumps.length} files`)
    console.log(`Access contexts: ${results.accessContexts.size} variants`)

    // Save access contexts for pattern extraction
    const contextsFile = join(outputDir, 'access-contexts.json')
    const contextData = Object.fromEntries(
      Array.from(results.accessContexts.entries()).map(([variant, contexts]) => [
        variant,
        contexts.map(ctx => ({
          ...ctx,
          instructionContext: Array.from(ctx.instructionContext), // Convert Uint8Array to array for JSON
        }))
      ])
    )
    writeFileSync(contextsFile, JSON.stringify(contextData, null, 2))
    console.log(`Access contexts saved to: ${contextsFile}`)
  }
}

async function testSignaturesCommand(options: CliOptions): Promise<void> {
  const variant = options.variant || 'emerald'
  const inputFile = options.input
  
  if (!inputFile || !existsSync(inputFile)) {
    console.error('❌ Input file required and must exist. Use --input=path/to/memory.bin')
    return
  }

  console.log(`🧪 Testing signatures against ${variant} memory dump: ${inputFile}`)
  
  const memoryData = readFileSync(inputFile)
  const buffer = new Uint8Array(memoryData)
  
  const scanner = createPartyDataScanner()
  const results = scanner.scan(buffer, variant)

  console.log(`\n📊 Scan Results:`)
  console.log(`Signatures tested: ${PARTY_DATA_SIGNATURES.length}`)
  console.log(`Matches found: ${results.matches.length}`)
  console.log(`Addresses resolved: ${results.resolvedAddresses.size}`)
  console.log(`Errors: ${results.errors.length}`)

  if (results.errors.length > 0) {
    console.log(`\n⚠️  Errors:`)
    results.errors.forEach(error => console.log(`  - ${error}`))
  }

  if (results.matches.length > 0) {
    console.log(`\n🎯 Matches:`)
    for (const match of results.matches) {
      const address = results.resolvedAddresses.get(match.signature.name)
      console.log(`  - ${match.signature.name}:`)
      console.log(`    Pattern: ${match.signature.pattern.idaSignature}`)
      console.log(`    Found at offset: 0x${match.offset.toString(16)}`)
      console.log(`    Resolved address: 0x${address?.toString(16) || 'failed'}`)
      console.log(`    Mode: ${match.signature.mode}`)
      
      if (options.verbose) {
        console.log(`    Matched bytes: ${Array.from(match.matchedBytes).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
      }
    }
  }

  // Compare with known addresses
  const knownAddresses = {
    emerald: 0x020244EC,
    quetzal: 0x020235B8,
  }
  
  const expectedAddress = knownAddresses[variant]
  console.log(`\n🎯 Expected partyData address: 0x${expectedAddress.toString(16)}`)
  
  const foundAddresses = Array.from(results.resolvedAddresses.values())
  const matchesExpected = foundAddresses.some(addr => addr === expectedAddress)
  
  if (matchesExpected) {
    console.log(`✅ SUCCESS: Found expected address!`)
  } else {
    console.log(`❌ FAILED: Expected address not found`)
    if (foundAddresses.length > 0) {
      console.log(`Found addresses: ${foundAddresses.map(a => `0x${a.toString(16)}`).join(', ')}`)
    }
  }
}

async function scanUniversalCommand(options: CliOptions): Promise<void> {
  const inputFile = options.input
  
  if (!inputFile || !existsSync(inputFile)) {
    console.error('❌ Input file required and must exist. Use --input=path/to/memory.bin')
    return
  }

  console.log(`🔍 Testing universal patterns against: ${inputFile}`)
  
  const memoryData = readFileSync(inputFile)
  const buffer = new Uint8Array(memoryData)
  
  testUniversalPatterns(buffer)
}

async function scanDumpCommand(options: CliOptions): Promise<void> {
  const inputFile = options.input
  const variant = options.variant
  
  if (!inputFile || !existsSync(inputFile)) {
    console.error('❌ Input file required and must exist. Use --input=path/to/memory.bin')
    return
  }

  console.log(`🔍 Scanning memory dump: ${inputFile}`)
  if (variant) {
    console.log(`Variant filter: ${variant}`)
  }
  
  const memoryData = readFileSync(inputFile)
  const buffer = new Uint8Array(memoryData)
  
  console.log(`Memory dump size: ${buffer.length} bytes (${(buffer.length / 1024).toFixed(1)} KB)`)
  
  const scanner = createPartyDataScanner()
  const results = scanner.scan(buffer, variant)

  // Display detailed results
  console.log(`\n📈 Detailed Results:`)
  
  for (const signature of PARTY_DATA_SIGNATURES) {
    if (variant && !signature.supportedVariants.includes(variant)) {
      continue // Skip unsupported signatures
    }
    
    const matches = results.matches.filter(m => m.signature.name === signature.name)
    const address = results.resolvedAddresses.get(signature.name)
    
    console.log(`\n🔎 ${signature.name}:`)
    console.log(`  Pattern: ${signature.pattern.idaSignature}`)
    console.log(`  Mode: ${signature.mode}`)
    console.log(`  Matches: ${matches.length}`)
    
    if (matches.length > 0) {
      console.log(`  Locations: ${matches.map(m => `0x${m.offset.toString(16)}`).join(', ')}`)
      if (address) {
        console.log(`  ✅ Resolved: 0x${address.toString(16)}`)
      } else {
        console.log(`  ❌ Resolution failed`)
      }
    } else {
      console.log(`  ❌ Not found`)
    }
  }

  if (results.errors.length > 0) {
    console.log(`\n⚠️  Resolution Errors:`)
    results.errors.forEach(error => console.log(`  - ${error}`))
  }
}

async function validateCommand(options: CliOptions): Promise<void> {
  const inputDir = options.input || './signature-output'
  
  if (!existsSync(inputDir)) {
    console.error(`❌ Input directory does not exist: ${inputDir}`)
    return
  }

  console.log(`🔬 Validating signatures across variants...`)
  console.log(`Input directory: ${inputDir}`)

  const emeraldDumpDir = join(inputDir, 'emerald')
  const quetzalDumpDir = join(inputDir, 'quetzal')

  if (!existsSync(emeraldDumpDir) || !existsSync(quetzalDumpDir)) {
    console.error(`❌ Missing variant directories. Expected: ${emeraldDumpDir} and ${quetzalDumpDir}`)
    return
  }

  // Find memory dump files
  const emeraldDumps = ['memory_2000000_40000.bin', 'memory_2000000_10000.bin'].map(f => join(emeraldDumpDir, f)).filter(existsSync)
  const quetzalDumps = ['memory_2000000_40000.bin', 'memory_2000000_10000.bin'].map(f => join(quetzalDumpDir, f)).filter(existsSync)

  if (emeraldDumps.length === 0 || quetzalDumps.length === 0) {
    console.error(`❌ No memory dumps found in variant directories`)
    return
  }

  const emeraldDump = emeraldDumps[0]!
  const quetzalDump = quetzalDumps[0]!

  console.log(`Using dumps:`)
  console.log(`  Emerald: ${emeraldDump}`)
  console.log(`  Quetzal: ${quetzalDump}`)

  // Test signatures against both variants
  const scanner = createPartyDataScanner()
  
  const emeraldData = new Uint8Array(readFileSync(emeraldDump))
  const quetzalData = new Uint8Array(readFileSync(quetzalDump))
  
  const emeraldResults = scanner.scan(emeraldData, 'emerald')
  const quetzalResults = scanner.scan(quetzalData, 'quetzal')

  // Validation report
  console.log(`\n📊 Validation Report:`)
  
  const knownAddresses = {
    emerald: 0x020244EC,
    quetzal: 0x020235B8,
  }

  let successCount = 0
  let totalTests = 0

  for (const signature of PARTY_DATA_SIGNATURES) {
    console.log(`\n🧪 ${signature.name}:`)
    
    // Test Emerald variant
    if (signature.supportedVariants.includes('emerald')) {
      totalTests++
      const emeraldAddr = emeraldResults.resolvedAddresses.get(signature.name)
      const emeraldSuccess = emeraldAddr === knownAddresses.emerald
      
      console.log(`  Emerald: ${emeraldSuccess ? '✅' : '❌'} (found: 0x${emeraldAddr?.toString(16) || 'none'}, expected: 0x${knownAddresses.emerald.toString(16)})`)
      
      if (emeraldSuccess) successCount++
    }
    
    // Test Quetzal variant  
    if (signature.supportedVariants.includes('quetzal')) {
      totalTests++
      const quetzalAddr = quetzalResults.resolvedAddresses.get(signature.name)
      const quetzalSuccess = quetzalAddr === knownAddresses.quetzal
      
      console.log(`  Quetzal: ${quetzalSuccess ? '✅' : '❌'} (found: 0x${quetzalAddr?.toString(16) || 'none'}, expected: 0x${knownAddresses.quetzal.toString(16)})`)
      
      if (quetzalSuccess) successCount++
    }
  }

  const successRate = (successCount / totalTests * 100).toFixed(1)
  console.log(`\n📈 Overall Results:`)
  console.log(`  Success rate: ${successCount}/${totalTests} (${successRate}%)`)
  
  if (successCount === totalTests) {
    console.log(`  🎉 All signatures validated successfully!`)
  } else {
    console.log(`  ⚠️  Some signatures need improvement`)
  }
}

async function extractPatternsCommand(options: CliOptions): Promise<void> {
  const inputDir = options.input || './signature-output'
  const contextsFile = join(inputDir, 'access-contexts.json')
  
  if (!existsSync(contextsFile)) {
    console.error(`❌ Access contexts file not found: ${contextsFile}`)
    console.log(`Run 'dump-memory' command first to generate access contexts`)
    return
  }

  console.log(`🔍 Extracting patterns from access contexts...`)
  
  const contextData = JSON.parse(readFileSync(contextsFile, 'utf8'))
  
  for (const [variant, rawContexts] of Object.entries(contextData)) {
    console.log(`\n📍 Analyzing ${variant} contexts...`)
    
    // Convert back to MemoryAccessContext objects
    const contexts: MemoryAccessContext[] = (rawContexts as any[]).map(ctx => ({
      ...ctx,
      instructionContext: new Uint8Array(ctx.instructionContext),
    }))
    
    if (contexts.length === 0) {
      console.log(`  No contexts found for ${variant}`)
      continue
    }
    
    console.log(`  Found ${contexts.length} memory access contexts`)
    
    // Extract patterns
    const patterns = SignatureExtractor.extractPatternsFromContexts(contexts)
    console.log(`  Extracted ${patterns.length} unique patterns`)
    
    // Validate patterns
    const validPatterns = SignatureExtractor.validatePatterns(patterns, contexts)
    console.log(`  Validated ${validPatterns.length} stable patterns`)
    
    // Display patterns
    if (options.verbose && validPatterns.length > 0) {
      console.log(`  Patterns:`)
      validPatterns.forEach((pattern, i) => {
        console.log(`    ${i + 1}. ${pattern.idaSignature} (mask: ${pattern.mask})`)
      })
    }
    
    // Save patterns to file
    const patternsFile = join(inputDir, `extracted-patterns-${variant}.json`)
    writeFileSync(patternsFile, JSON.stringify({
      variant,
      totalContexts: contexts.length,
      extractedPatterns: patterns.length,
      validatedPatterns: validPatterns.length,
      patterns: validPatterns,
    }, null, 2))
    
    console.log(`  💾 Patterns saved to: ${patternsFile}`)
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const options = parseArgs(args)

  if (options.help || args.length === 0) {
    printHelp()
    return
  }

  try {
    switch (options.command) {
      case 'dump-memory':
        await dumpMemoryCommand(options)
        break
      case 'test-signatures':
        await testSignaturesCommand(options)
        break
      case 'scan-universal':
        await scanUniversalCommand(options)
        break
      case 'scan-dump':
        await scanDumpCommand(options) 
        break
      case 'validate':
        await validateCommand(options)
        break
      case 'extract-patterns':
        await extractPatternsCommand(options)
        break
      default:
        console.error(`❌ Unknown command: ${options.command}`)
        printHelp()
        process.exit(1)
    }
  } catch (error) {
    console.error(`❌ Command failed:`, error)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}