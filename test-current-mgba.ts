#!/usr/bin/env tsx
/**
 * Test current running mGBA container
 */

import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'

async function testRunningMGBA() {
  console.log('🔗 Testing current running mGBA container...')
  
  const ws = new WebSocket(MGBA_WEBSOCKET_URL)
  
  const execute = (code: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 30000)
      
      const handler = (data: any) => {
        const msg = data.toString()
        if (msg.startsWith('Welcome')) return
        
        ws.off('message', handler)
        clearTimeout(timeout)
        
        try {
          const response = JSON.parse(msg)
          resolve(response.result || response)
        } catch {
          resolve(msg.trim())
        }
      }
      
      ws.on('message', handler)
      ws.send(code)
    })
  }
  
  await new Promise((resolve) => {
    ws.on('open', resolve)
  })
  
  console.log('📋 ROM info:')
  const romInfo = await execute(`
    return {
      title = emu:getGameTitle(),
      size = emu:romSize()
    }
  `)
  console.log(romInfo)
  
  console.log('🔍 Testing pattern with working approach:')
  const result = await execute(`
    local expectedAddr = 0x020235B8  -- Quetzal target
    local found = {}
    
    -- Search for exact pattern: 48 ?? 68 ?? 30 ??
    for addr = 0x08000000, 0x08000000 + 500000 - 6 do
      local b1 = emu:read8(addr)
      local b3 = emu:read8(addr + 2)
      local b5 = emu:read8(addr + 4)
      
      if b1 == 0x48 and b3 == 0x68 and b5 == 0x30 then
        local b2 = emu:read8(addr + 1)
        local immediate = b2
        local pc = math.floor((addr + 4) / 4) * 4
        local literalAddr = pc + immediate * 4
        
        if literalAddr >= 0x08000000 and literalAddr < 0x08000000 + emu:romSize() then
          local ab1 = emu:read8(literalAddr)
          local ab2 = emu:read8(literalAddr + 1)
          local ab3 = emu:read8(literalAddr + 2)
          local ab4 = emu:read8(literalAddr + 3)
          
          local address = ab1 + ab2 * 256 + ab3 * 65536 + ab4 * 16777216
          
          if address >= 0x02000000 and address < 0x04000000 then
            table.insert(found, {
              pattern = string.format("0x%08X", addr),
              address = string.format("0x%08X", address),
              target = (address == expectedAddr)
            })
            
            if address == expectedAddr then
              return {
                success = true,
                foundAddress = address,
                method = "thumb_pattern",
                allMatches = found
              }
            end
          end
        end
        
        if #found >= 10 then break end
      end
    end
    
    return {
      success = false,
      foundAddress = nil,
      method = "none",
      allMatches = found
    }
  `)
  
  console.log('🔍 Pattern result:', JSON.stringify(result, null, 2))
  
  if (result.success) {
    console.log(`🎉 SUCCESS: Found target address 0x${result.foundAddress.toString(16)} via ${result.method}!`)
  } else {
    console.log(`❌ Target not found. Found ${result.allMatches?.length || 0} valid addresses:`)
    if (result.allMatches) {
      result.allMatches.forEach((match: any, i: number) => {
        console.log(`  ${i + 1}. Pattern ${match.pattern} → ${match.address} ${match.target ? '(TARGET!)' : ''}`)
      })
    }
  }
  
  ws.close()
}

testRunningMGBA()