#!/usr/bin/env tsx

/**
 * Comprehensive Quetzal memory analysis script
 * Dumps memory from both savestates and performs cross-reference analysis
 */

import { promises as fs } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'

const execAsync = promisify(exec)

interface AnalysisResult {
  savestate1: string
  savestate2: string
  consistentAddresses: Array<{
    address: string
    confidence1: number
    confidence2: number
    pokemon1: number
    pokemon2: number
  }>
  summary: string
}

async function ensureDockerRunning(): Promise<void> {
  console.log('🐳 Checking Docker container status...')
  
  try {
    const { stdout } = await execAsync('docker ps --filter "name=mgba-test-environment" --format "{{.Status}}"')
    
    if (!stdout.trim()) {
      console.log('🚀 Starting mGBA Docker container...')
      await execAsync('npm run mgba -- start')
      
      // Wait for container to be ready
      console.log('⏳ Waiting for container to be ready...')
      await new Promise(resolve => setTimeout(resolve, 10000))
    } else {
      console.log('✅ mGBA container is already running')
    }
  } catch (error) {
    console.error('❌ Failed to start Docker container:', error)
    throw error
  }
}

async function dumpMemoryForSavestate(savestateName: string, savestateFile: string): Promise<void> {
  console.log(`\n📥 Dumping memory for ${savestateName}...`)
  
  try {
    // Use the memory dump script
    await execAsync(`npx tsx scripts/dump-gba-memory.ts ${savestateName} ${savestateFile}`)
    console.log(`✅ Memory dump completed for ${savestateName}`)
  } catch (error) {
    console.error(`❌ Memory dump failed for ${savestateName}:`, error)
    throw error
  }
}

async function compileCAnalyzer(): Promise<void> {
  console.log('🔨 Compiling C memory analyzer...')
  
  try {
    await execAsync('gcc -O3 -o scripts/analyze-memory-dumps scripts/analyze-memory-dumps.c')
    console.log('✅ C analyzer compiled successfully')
  } catch (error) {
    console.error('❌ Failed to compile C analyzer:', error)
    throw error
  }
}

async function analyzeMemoryDumps(savestate1: string, savestate2: string): Promise<AnalysisResult> {
  console.log(`\n🔍 Analyzing memory dumps: ${savestate1} vs ${savestate2}`)
  
  const dumpDir = join(process.cwd(), 'tmp', 'memory-dumps')
  const ewramFile1 = join(dumpDir, `${savestate1}_ewram.bin`)
  const ewramFile2 = join(dumpDir, `${savestate2}_ewram.bin`)
  
  // Verify dump files exist
  try {
    await fs.access(ewramFile1)
    await fs.access(ewramFile2)
  } catch (error) {
    throw new Error(`Memory dump files not found. Please run memory dumps first.`)
  }
  
  try {
    const { stdout } = await execAsync(
      `./scripts/analyze-memory-dumps "${ewramFile1}" "${ewramFile2}" 0x02000000`
    )
    
    console.log('📊 Analysis Results:')
    console.log(stdout)
    
    // Parse the results
    const lines = stdout.split('\n')
    const consistentAddresses: AnalysisResult['consistentAddresses'] = []
    
    for (const line of lines) {
      const match = line.match(/^0x([0-9A-F]{8})\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)/)
      if (match) {
        consistentAddresses.push({
          address: `0x${match[1]}`,
          confidence1: parseInt(match[2]!),
          confidence2: parseInt(match[3]!),
          pokemon1: parseInt(match[4]!),
          pokemon2: parseInt(match[5]!),
        })
      }
    }
    
    return {
      savestate1,
      savestate2,
      consistentAddresses,
      summary: stdout,
    }
  } catch (error) {
    console.error('❌ Memory analysis failed:', error)
    throw error
  }
}

async function generateReport(results: AnalysisResult[]): Promise<void> {
  console.log('\n📋 Generating analysis report...')
  
  const reportPath = join(process.cwd(), 'tmp', 'quetzal-memory-analysis-report.md')
  
  let report = `# Quetzal Memory Analysis Report\n\n`
  report += `Generated: ${new Date().toISOString()}\n\n`
  
  if (results.length === 0) {
    report += `## No Analysis Results\n\nNo memory dumps were analyzed.\n`
  } else {
    for (const result of results) {
      report += `## Analysis: ${result.savestate1} vs ${result.savestate2}\n\n`
      
      if (result.consistentAddresses.length === 0) {
        report += `❌ **No consistent addresses found**\n\n`
        report += `This indicates that Quetzal ROM hack uses highly dynamic memory allocation for Pokemon party data. The addresses change between different savestates, making it impossible to use fixed memory addresses for real-time editing.\n\n`
        report += `**Recommendation**: Memory support should remain disabled for Quetzal (\`canHandleMemory() → false\`).\n\n`
      } else {
        report += `✅ **${result.consistentAddresses.length} potentially consistent addresses found**\n\n`
        report += `| Address    | Confidence 1 | Confidence 2 | Pokemon 1 | Pokemon 2 |\n`
        report += `|------------|--------------|--------------|-----------|----------|\n`
        
        for (const addr of result.consistentAddresses) {
          report += `| ${addr.address} | ${addr.confidence1} | ${addr.confidence2} | ${addr.pokemon1} | ${addr.pokemon2} |\n`
        }
        report += `\n`
        
        // Find the best candidate
        const bestCandidate = result.consistentAddresses.reduce((best, current) => {
          const currentScore = current.confidence1 + current.confidence2
          const bestScore = best.confidence1 + best.confidence2
          return currentScore > bestScore ? current : best
        })
        
        report += `**Best candidate address**: ${bestCandidate.address} (total confidence: ${bestCandidate.confidence1 + bestCandidate.confidence2})\n\n`
      }
      
      report += `### Raw Analysis Output\n\n`
      report += `\`\`\`\n${result.summary}\n\`\`\`\n\n`
    }
  }
  
  report += `## Conclusion\n\n`
  report += `Based on this analysis, we can determine whether Quetzal ROM hack has:\n\n`
  report += `1. **Consistent Memory Addresses**: If addresses were found in multiple savestates\n`
  report += `2. **Dynamic Memory Allocation**: If no consistent addresses exist\n\n`
  report += `This information will guide whether to enable or disable memory support in QuetzalConfig.\n`
  
  await fs.writeFile(reportPath, report)
  console.log(`📄 Report saved to: ${reportPath}`)
}

async function main(): Promise<void> {
  console.log('🚀 Starting comprehensive Quetzal memory analysis')
  console.log('🎯 Goal: Find consistent Pokemon party addresses across savestates\n')
  
  try {
    // Ensure Docker is running
    await ensureDockerRunning()
    
    // Create tmp directory
    await fs.mkdir(join(process.cwd(), 'tmp'), { recursive: true })
    
    // Dump memory for both savestates
    await dumpMemoryForSavestate('quetzal1', 'quetzal.ss0')
    await dumpMemoryForSavestate('quetzal2', 'quetzal2.ss0')
    
    // Compile the C analyzer
    await compileCAnalyzer()
    
    // Analyze the memory dumps
    const analysisResults: AnalysisResult[] = []
    
    const result = await analyzeMemoryDumps('quetzal1', 'quetzal2')
    analysisResults.push(result)
    
    // Generate comprehensive report
    await generateReport(analysisResults)
    
    console.log('\n🎉 Comprehensive memory analysis completed!')
    console.log('📊 Check the generated report for detailed findings')
    
    // Summary output
    if (result.consistentAddresses.length > 0) {
      console.log(`\n✅ Found ${result.consistentAddresses.length} potentially consistent addresses`)
      console.log('💡 Quetzal may support fixed memory addresses for real-time editing')
      
      const bestAddress = result.consistentAddresses.reduce((best, current) => {
        const currentScore = current.confidence1 + current.confidence2
        const bestScore = best.confidence1 + best.confidence2
        return currentScore > bestScore ? current : best
      })
      
      console.log(`🎯 Best candidate: ${bestAddress.address} (confidence: ${bestAddress.confidence1 + bestAddress.confidence2})`)
    } else {
      console.log('\n❌ No consistent addresses found between savestates')
      console.log('💡 Quetzal uses dynamic memory allocation - memory support should stay disabled')
    }
    
  } catch (error) {
    console.error('\n❌ Analysis failed:', error)
    process.exit(1)
  }
}

import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const isMainModule = process.argv[1] === __filename

if (isMainModule) {
  main().catch(console.error)
}