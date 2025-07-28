#!/usr/bin/env tsx

/**
 * Script to dump entire GBA memory for static analysis
 * This dumps EWRAM and IWRAM regions to binary files for analysis
 */

import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client'
import { promises as fs } from 'fs'
import { join } from 'path'

// GBA Memory Map
const GBA_MEMORY_REGIONS = {
  EWRAM: { start: 0x02000000, size: 0x40000, name: 'ewram' },  // 256KB
  IWRAM: { start: 0x03000000, size: 0x8000, name: 'iwram' },   // 32KB
} as const

interface MemoryDumpOptions {
  outputDir: string
  savestateName: string
  savestatePathInContainer: string
}

async function createOutputDirectory(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true })
    console.log(`📁 Created output directory: ${dir}`)
  } catch (error) {
    console.error(`❌ Failed to create directory ${dir}:`, error)
    throw error
  }
}

async function loadSavestate(client: MgbaWebSocketClient, savestatePath: string): Promise<void> {
  console.log(`🔄 Loading savestate: ${savestatePath}`)
  
  // Use the mgba Lua API to load the savestate
  const loadResult = await client.eval(`emu:loadStateFile("${savestatePath}", 0)`)
  
  if (loadResult.error || !loadResult.result) {
    throw new Error(`Failed to load savestate: ${loadResult.error || 'Unknown error'}`)
  }
  
  console.log(`✅ Savestate loaded successfully`)
  
  // Wait a moment for the state to stabilize
  await new Promise(resolve => setTimeout(resolve, 1000))
}

async function dumpMemoryRegion(
  client: MgbaWebSocketClient, 
  region: typeof GBA_MEMORY_REGIONS.EWRAM,
  outputPath: string
): Promise<void> {
  console.log(`📥 Dumping ${region.name.toUpperCase()} (0x${region.start.toString(16)} - 0x${(region.start + region.size - 1).toString(16)})`)
  
  // Dump memory using Lua's io library for 1:1 binary dump
  const luaScript = `
    (function()
      -- Open file for binary writing
      local file = io.open("${outputPath}", "wb")
      if not file then
        error("Could not open file for writing: ${outputPath}")
      end
      
      -- Read memory region and write to file
      local address = ${region.start}
      local size = ${region.size}
      local buffer = {}
      
      -- Read in chunks to avoid memory issues
      local chunkSize = 4096
      for i = 0, size - 1, chunkSize do
        local currentChunk = math.min(chunkSize, size - i)
        local chunk = {}
        
        for j = 0, currentChunk - 1 do
          chunk[j + 1] = emu:read8(address + i + j)
        end
        
        -- Convert to string and write
        local bytes = {}
        for k = 1, #chunk do
          bytes[k] = string.char(chunk[k])
        end
        file:write(table.concat(bytes))
      end
      
      file:close()
      return "Memory dump completed"
    end)()
  `
  
  const result = await client.eval(luaScript)
  
  if (result.error) {
    throw new Error(`Failed to dump ${region.name}: ${result.error}`)
  }
  
  console.log(`✅ ${region.name.toUpperCase()} dump completed: ${outputPath}`)
}

async function verifyDumpFile(filePath: string, expectedSize: number): Promise<void> {
  try {
    const stats = await fs.stat(filePath)
    if (stats.size !== expectedSize) {
      throw new Error(`File size mismatch: expected ${expectedSize}, got ${stats.size}`)
    }
    console.log(`✅ Verified dump file: ${filePath} (${stats.size} bytes)`)
  } catch (error) {
    console.error(`❌ Failed to verify dump file ${filePath}:`, error)
    throw error
  }
}

async function dumpGBAMemory(options: MemoryDumpOptions): Promise<void> {
  const client = new MgbaWebSocketClient()
  
  try {
    // Create output directory
    await createOutputDirectory(options.outputDir)
    
    // Connect to mGBA
    console.log('🔌 Connecting to mGBA WebSocket...')
    await client.connect()
    console.log('✅ Connected to mGBA')
    
    // Load the specified savestate
    await loadSavestate(client, options.savestatePathInContainer)
    
    // Dump each memory region
    for (const [regionName, region] of Object.entries(GBA_MEMORY_REGIONS)) {
      const containerOutputFile = `/app/data/${options.savestateName}_${region.name}.bin`
      const hostOutputFile = join(process.cwd(), 'src/lib/parser/__tests__/test_data', `${options.savestateName}_${region.name}.bin`)
      const finalOutputFile = join(options.outputDir, `${options.savestateName}_${region.name}.bin`)
      
      await dumpMemoryRegion(client, region, containerOutputFile)
      
      // Copy from volume mount location to final output location
      try {
        await fs.copyFile(hostOutputFile, finalOutputFile)
        console.log(`📋 Copied dump to: ${finalOutputFile}`)
      } catch (error) {
        console.error(`❌ Failed to copy dump file: ${error}`)
        throw error
      }
      
      // Verify the final dump file
      await verifyDumpFile(finalOutputFile, region.size)
    }
    
    console.log(`🎉 Memory dump completed for ${options.savestateName}`)
    
  } catch (error) {
    console.error('❌ Memory dump failed:', error)
    throw error
  } finally {
    client.disconnect()
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const savestateName = args[0]
  const savestateFile = args[1]
  
  if (!savestateName || !savestateFile) {
    console.error('Usage: tsx scripts/dump-gba-memory.ts <savestate_name> <savestate_file>')
    console.error('Example: tsx scripts/dump-gba-memory.ts quetzal1 quetzal.ss0')
    process.exit(1)
  }
  
  const outputDir = join(process.cwd(), 'tmp', 'memory-dumps')
  const savestatePathInContainer = `/app/data/${savestateFile}`
  
  console.log(`🚀 Starting memory dump for ${savestateName}`)
  console.log(`📄 Savestate: ${savestateFile}`)
  console.log(`📁 Output: ${outputDir}`)
  
  try {
    await dumpGBAMemory({
      outputDir,
      savestateName,
      savestatePathInContainer,
    })
    
    console.log('\n🎉 Memory dump process completed successfully!')
    console.log(`📁 Dumps available in: ${outputDir}`)
    
  } catch (error) {
    console.error('\n❌ Memory dump process failed:', error)
    process.exit(1)
  }
}

import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const isMainModule = process.argv[1] === __filename

if (isMainModule) {
  main().catch(console.error)
}