/**
 * Memory dumper for extracting memory regions from mGBA emulator
 */

import { MgbaWebSocketClient } from '../mgba/websocket-client'
import type { MemoryRegion, MemoryDumpOptions } from './types'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export class MemoryDumper {
  constructor(private client: MgbaWebSocketClient) {}

  /**
   * Dump a large memory region to disk by chunking the reads
   */
  async dumpMemoryToDisk(options: MemoryDumpOptions): Promise<void> {
    const { startAddress, endAddress, outputPath, chunkSize = 0x10000 } = options
    
    if (!this.client.isConnected()) {
      throw new Error('mGBA client is not connected')
    }

    const totalSize = endAddress - startAddress
    const chunks: Uint8Array[] = []
    
    console.log(`Dumping memory region 0x${startAddress.toString(16)} - 0x${endAddress.toString(16)} (${totalSize} bytes)`)
    
    // Read memory in chunks
    for (let addr = startAddress; addr < endAddress; addr += chunkSize) {
      const currentChunkSize = Math.min(chunkSize, endAddress - addr)
      console.log(`Reading chunk at 0x${addr.toString(16)}, size: ${currentChunkSize}`)
      
      try {
        const chunk = await this.client.readBytes(addr, currentChunkSize)
        chunks.push(chunk)
      } catch (error) {
        console.warn(`Failed to read chunk at 0x${addr.toString(16)}: ${error}`)
        // Fill with zeros for failed reads
        chunks.push(new Uint8Array(currentChunkSize))
      }
    }

    // Combine all chunks
    const fullData = new Uint8Array(totalSize)
    let offset = 0
    for (const chunk of chunks) {
      fullData.set(chunk, offset)
      offset += chunk.length
    }

    // Write to disk
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, fullData)
    console.log(`Memory dump written to: ${outputPath}`)
  }

  /**
   * Read a specific memory region
   */
  async readMemoryRegion(address: number, size: number): Promise<MemoryRegion> {
    if (!this.client.isConnected()) {
      throw new Error('mGBA client is not connected')
    }

    const data = await this.client.readBytes(address, size)
    return {
      address,
      size,
      data
    }
  }

  /**
   * Read multiple memory regions around known addresses for pattern analysis
   */
  async readRegionsAroundAddresses(addresses: number[], contextSize = 0x1000): Promise<MemoryRegion[]> {
    const regions: MemoryRegion[] = []
    
    for (const address of addresses) {
      console.log(`Reading context around address 0x${address.toString(16)}`)
      
      // Read a region before and after the target address
      const startAddr = Math.max(0, address - contextSize)
      const endAddr = address + contextSize
      const size = endAddr - startAddr
      
      try {
        const region = await this.readMemoryRegion(startAddr, size)
        regions.push(region)
      } catch (error) {
        console.warn(`Failed to read region around 0x${address.toString(16)}: ${error}`)
      }
    }
    
    return regions
  }

  /**
   * Dump entire EWRAM region for comprehensive analysis
   */
  async dumpEWRAM(outputPath: string): Promise<void> {
    // GBA EWRAM: 0x02000000 - 0x02040000 (256KB)
    await this.dumpMemoryToDisk({
      startAddress: 0x02000000,
      endAddress: 0x02040000,
      outputPath,
      chunkSize: 0x4000 // 16KB chunks
    })
  }

  /**
   * Dump IWRAM region for analysis
   */
  async dumpIWRAM(outputPath: string): Promise<void> {
    // GBA IWRAM: 0x03000000 - 0x03008000 (32KB)
    await this.dumpMemoryToDisk({
      startAddress: 0x03000000,
      endAddress: 0x03008000,
      outputPath,
      chunkSize: 0x2000 // 8KB chunks
    })
  }
}