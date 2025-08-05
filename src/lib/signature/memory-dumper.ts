/**
 * Memory dump acquisition tools for mGBA integration
 * Provides methods to capture RAM dumps and watchpoint contexts for signature analysis
 */

import { execSync, spawn } from 'node:child_process'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { MemoryRegion, MemoryAccessContext, MemoryDumpConfig } from '../signature/types'

/**
 * GDB integration for capturing memory access contexts
 */
export class GdbMemoryAnalyzer {
  private gdbProcess: any
  private accessContexts: MemoryAccessContext[] = []

  constructor(
    private readonly containerName = 'mgba-test-environment',
    private readonly gdbPath = 'gdb-multiarch'
  ) {}

  /**
   * Connect to mGBA's GDB stub
   */
  async connect(port = 2345): Promise<void> {
    console.log(`Connecting to mGBA GDB stub on port ${port}...`)
    
    // Launch GDB in the container
    this.gdbProcess = spawn('docker', [
      'exec', '-i', this.containerName,
      this.gdbPath, '--batch', '--quiet'
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Connect to mGBA
    this.sendGdbCommand(`target remote localhost:${port}`)
    await this.waitForPrompt()
    console.log('Connected to mGBA GDB stub')
  }

  /**
   * Set watchpoints on known partyData addresses to capture access contexts
   */
  async capturePartyDataAccesses(addresses: readonly number[], durationMs = 30000): Promise<MemoryAccessContext[]> {
    console.log(`Setting watchpoints on addresses: ${addresses.map(a => `0x${a.toString(16)}`).join(', ')}`)
    
    // Set watchpoints for each address
    for (const address of addresses) {
      this.sendGdbCommand(`awatch *0x${address.toString(16)}`)
    }

    // Continue execution and capture watchpoint hits
    this.sendGdbCommand('continue')
    
    console.log(`Capturing memory accesses for ${durationMs}ms...`)
    await new Promise(resolve => setTimeout(resolve, durationMs))
    
    // Stop execution and collect results
    this.sendGdbCommand('interrupt')
    this.sendGdbCommand('info breakpoints')
    
    return this.accessContexts
  }

  /**
   * Dump memory regions to files
   */
  async dumpMemoryRegions(regions: readonly MemoryRegion[], outputDir: string): Promise<string[]> {
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true })
    }

    const dumpFiles: string[] = []

    for (const region of regions) {
      const filename = `memory_${region.address.toString(16)}_${region.size.toString(16)}.bin`
      const filepath = join(outputDir, filename)
      
      console.log(`Dumping ${region.description}: 0x${region.address.toString(16)} (${region.size} bytes)`)
      
      // Use GDB to dump memory region
      this.sendGdbCommand(`dump binary memory ${filename} 0x${region.address.toString(16)} 0x${(region.address + region.size).toString(16)}`)
      
      // Copy file from container
      try {
        execSync(`docker cp ${this.containerName}:${filename} ${filepath}`, { stdio: 'inherit' })
        dumpFiles.push(filepath)
        
        // Clean up file in container
        this.sendGdbCommand(`shell rm -f ${filename}`)
      } catch (error) {
        console.warn(`Failed to copy dump file ${filename}: ${error}`)
      }
    }

    return dumpFiles
  }

  /**
   * Capture instruction context around a program counter
   */
  async captureInstructionContext(pc: number, contextSize = 64): Promise<Uint8Array> {
    const startAddr = Math.max(0, pc - contextSize / 2)
    const endAddr = pc + contextSize / 2
    
    // Dump instruction context to temporary file
    const tempFile = `context_${pc.toString(16)}.bin`
    this.sendGdbCommand(`dump binary memory ${tempFile} 0x${startAddr.toString(16)} 0x${endAddr.toString(16)}`)
    
    try {
      // Copy and read the context data
      execSync(`docker cp ${this.containerName}:${tempFile} /tmp/${tempFile}`, { stdio: 'inherit' })
      const contextData = readFileSync(`/tmp/${tempFile}`)
      
      // Clean up
      this.sendGdbCommand(`shell rm -f ${tempFile}`)
      execSync(`rm -f /tmp/${tempFile}`)
      
      return new Uint8Array(contextData)
    } catch (error) {
      console.warn(`Failed to capture instruction context at 0x${pc.toString(16)}: ${error}`)
      return new Uint8Array()
    }
  }

  /**
   * Disconnect from GDB
   */
  disconnect(): void {
    if (this.gdbProcess) {
      this.sendGdbCommand('quit')
      this.gdbProcess.kill()
      this.gdbProcess = null
    }
  }

  private sendGdbCommand(command: string): void {
    if (this.gdbProcess && this.gdbProcess.stdin) {
      this.gdbProcess.stdin.write(command + '\n')
    }
  }

  private async waitForPrompt(): Promise<void> {
    // Simple wait - in production would parse GDB output
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}

/**
 * Docker-based memory dump acquisition
 */
export class DockerMemoryDumper {
  constructor(
    private readonly containerName = 'mgba-test-environment'
  ) {}

  /**
   * Execute memory dump using Docker exec and mGBA Lua
   */
  async dumpMemoryWithLua(config: MemoryDumpConfig, outputDir: string): Promise<string[]> {
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true })
    }

    const dumpFiles: string[] = []

    // Generate Lua script for memory dumping
    const luaScript = this.generateMemoryDumpScript(config.regions)
    const scriptPath = join(outputDir, 'memory_dump.lua')
    writeFileSync(scriptPath, luaScript)

    try {
      // Copy script to container
      execSync(`docker cp ${scriptPath} ${this.containerName}:/tmp/memory_dump.lua`, { stdio: 'inherit' })

      // Execute memory dump via mGBA Lua
      console.log('Executing memory dump via mGBA Lua...')
      execSync(`docker exec ${this.containerName} mgba-qt -l /tmp/memory_dump.lua --gdb=2345`, { 
        stdio: 'inherit',
        timeout: 60000 // 60 second timeout
      })

      // Copy dump files back
      for (let i = 0; i < config.regions.length; i++) {
        const region = config.regions[i]!
        const filename = `dump_${i}_${region.address.toString(16)}.bin`
        const localPath = join(outputDir, filename)
        
        try {
          execSync(`docker cp ${this.containerName}:/tmp/${filename} ${localPath}`, { stdio: 'inherit' })
          dumpFiles.push(localPath)
        } catch (error) {
          console.warn(`Failed to copy dump file ${filename}: ${error}`)
        }
      }

    } catch (error) {
      console.error('Memory dump execution failed:', error)
    } finally {
      // Clean up
      execSync(`rm -f ${scriptPath}`)
      execSync(`docker exec ${this.containerName} rm -f /tmp/memory_dump.lua /tmp/dump_*.bin || true`, { stdio: 'inherit' })
    }

    return dumpFiles
  }

  /**
   * Start mGBA container with specific game variant
   */
  async startContainer(gameVariant: 'emerald' | 'quetzal' = 'emerald'): Promise<void> {
    console.log(`Starting mGBA container with ${gameVariant}...`)
    
    try {
      // Stop any existing container
      execSync(`docker stop ${this.containerName} || true`, { stdio: 'inherit' })
      execSync(`docker rm ${this.containerName} || true`, { stdio: 'inherit' })

      // Start container with specified game
      execSync(`GAME=${gameVariant} docker compose -f docker/docker-compose.yml up -d`, { 
        stdio: 'inherit',
        env: { ...process.env, GAME: gameVariant }
      })

      // Wait for container to be ready
      console.log('Waiting for mGBA to initialize...')
      await new Promise(resolve => setTimeout(resolve, 10000))
      
    } catch (error) {
      console.error('Failed to start mGBA container:', error)
      throw error
    }
  }

  /**
   * Stop mGBA container
   */
  stopContainer(): void {
    try {
      execSync(`docker compose -f docker/docker-compose.yml down`, { stdio: 'inherit' })
    } catch (error) {
      console.warn('Failed to stop container:', error)
    }
  }

  private generateMemoryDumpScript(regions: readonly MemoryRegion[]): string {
    const dumpCommands = regions.map((region, index) => `
  -- Dump ${region.description}
  local data_${index} = ""
  for i = 0, ${region.size - 1} do
    local byte = memory.read8(${region.address} + i)
    data_${index} = data_${index} .. string.char(byte)
  end
  
  local file_${index} = io.open("/tmp/dump_${index}_${region.address.toString(16)}.bin", "wb")
  if file_${index} then
    file_${index}:write(data_${index})
    file_${index}:close()
    print("Dumped ${region.description} to dump_${index}_${region.address.toString(16)}.bin")
  else
    print("Failed to create dump file for ${region.description}")
  end
`).join('\n')

    return `
-- Memory dump script generated for signature analysis
print("Starting memory dump...")

${dumpCommands}

print("Memory dump complete")
`
  }
}

/**
 * High-level memory analysis orchestrator
 */
export class MemoryAnalysisOrchestrator {
  private dumper = new DockerMemoryDumper()
  private analyzer = new GdbMemoryAnalyzer()

  /**
   * Perform complete memory analysis for both game variants
   */
  async analyzePartyDataMemory(outputDir: string): Promise<{
    emeraldDumps: string[]
    quetzalDumps: string[]
    accessContexts: Map<string, MemoryAccessContext[]>
  }> {
    const results = {
      emeraldDumps: [] as string[],
      quetzalDumps: [] as string[],
      accessContexts: new Map<string, MemoryAccessContext[]>(),
    }

    const emeraldOutputDir = join(outputDir, 'emerald')
    const quetzalOutputDir = join(outputDir, 'quetzal')

    // Analyze Emerald variant
    console.log('=== Analyzing Pokemon Emerald (Vanilla) ===')
    await this.dumper.startContainer('emerald')
    
    try {
      // Dump memory regions
      const emeraldConfig: MemoryDumpConfig = {
        regions: [
          { address: 0x02000000, size: 0x40000, description: 'EWRAM' },
          { address: 0x03000000, size: 0x8000, description: 'IWRAM' },
          { address: 0x08000000, size: 0x100000, description: 'ROM (1MB)' },
        ],
        format: 'raw',
      }
      
      results.emeraldDumps = await this.dumper.dumpMemoryWithLua(emeraldConfig, emeraldOutputDir)
      
      // Capture access contexts
      await this.analyzer.connect()
      const emeraldContexts = await this.analyzer.capturePartyDataAccesses([0x020244EC])
      results.accessContexts.set('emerald', emeraldContexts)
      this.analyzer.disconnect()
      
    } finally {
      this.dumper.stopContainer()
    }

    // Analyze Quetzal variant
    console.log('\n=== Analyzing Pokemon Quetzal ===')
    await this.dumper.startContainer('quetzal')
    
    try {
      const quetzalConfig: MemoryDumpConfig = {
        regions: [
          { address: 0x02000000, size: 0x40000, description: 'EWRAM' },
          { address: 0x03000000, size: 0x8000, description: 'IWRAM' },
          { address: 0x08000000, size: 0x100000, description: 'ROM (1MB)' },
        ],
        format: 'raw',
      }
      
      results.quetzalDumps = await this.dumper.dumpMemoryWithLua(quetzalConfig, quetzalOutputDir)
      
      await this.analyzer.connect()
      const quetzalContexts = await this.analyzer.capturePartyDataAccesses([0x020235B8])
      results.accessContexts.set('quetzal', quetzalContexts)
      this.analyzer.disconnect()
      
    } finally {
      this.dumper.stopContainer()
    }

    return results
  }

  /**
   * Quick memory dump for testing signatures
   */
  async quickMemoryDump(variant: 'emerald' | 'quetzal', outputDir: string): Promise<string[]> {
    await this.dumper.startContainer(variant)
    
    try {
      const config: MemoryDumpConfig = {
        regions: [
          { address: 0x02000000, size: 0x10000, description: 'EWRAM (64KB)' }, // Smaller region for quick testing
        ],
        format: 'raw',
      }
      
      return await this.dumper.dumpMemoryWithLua(config, outputDir)
      
    } finally {
      this.dumper.stopContainer()
    }
  }
}