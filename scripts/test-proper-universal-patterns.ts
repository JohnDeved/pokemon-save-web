#!/usr/bin/env tsx

/**
 * Test the PROPER Universal Pattern approach as explained by @JohnDeved
 * 
 * This script implements the CORRECT method:
 * 1. Find ROM locations that REFERENCE target addresses (0x020244EC, 0x020235B8)
 * 2. Look for stable ARM/ASM instruction patterns AROUND those references  
 * 3. Create byte pattern masks that can find those instruction patterns
 * 4. Extract addresses from the found patterns
 */

import { execSync, spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MGBA_PORT = 7102;
const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws';
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml';
const TEST_TIMEOUT = 30000;

interface UniversalPattern {
  type: string;
  beforePattern: string;
  afterPattern: string;
  description: string;
  emeraldAddr: number;
  quetzalAddr: number;
  searchMask?: string;
}

class ProperUniversalPatternTester {
  private ws: WebSocket | null = null;
  private isReady = false;
  private containerName = '';

  async testBothGames() {
    console.log('🔍 PROPER Universal Pattern Detection Test');
    console.log('==========================================');
    console.log('Method: Find instruction patterns that REFERENCE target addresses');
    console.log('');

    const games = [
      { name: 'emerald', file: 'emerald.gba', expectedAddr: 0x020244EC },
      { name: 'quetzal', file: 'quetzal.gba', expectedAddr: 0x020235B8 }
    ];

    const allPatterns: UniversalPattern[] = [];

    for (const game of games) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🎮 Testing ${game.name.toUpperCase()}`);
      console.log(`${'='.repeat(60)}`);

      try {
        const patterns = await this.testGame(game.name, game.file, game.expectedAddr);
        if (patterns && patterns.length > 0) {
          allPatterns.push(...patterns);
          console.log(`✅ ${game.name}: Found ${patterns.length} universal patterns`);
        } else {
          console.log(`❌ ${game.name}: No patterns found`);
        }
      } catch (error) {
        console.error(`❌ ${game.name}: Error -`, error);
      }
    }

    // Analyze combined results
    console.log(`\n${'='.repeat(60)}`);
    console.log('🎯 COMBINED ANALYSIS');
    console.log(`${'='.repeat(60)}`);
    
    if (allPatterns.length > 0) {
      this.analyzeCombinedPatterns(allPatterns);
    } else {
      console.log('❌ No universal patterns found across both games');
    }
  }

  private async testGame(gameName: string, gameFile: string, expectedAddr: number): Promise<UniversalPattern[]> {
    console.log(`🚀 Starting mGBA Docker for ${gameName}...`);
    
    try {
      // Start mGBA container
      await this.startMgbaContainer(gameName);
      
      // Connect and test
      await this.connectWebSocket();
      
      // Get ROM info
      const romInfo = await this.getRomInfo();
      console.log(`✅ ROM: ${romInfo.title} (${romInfo.size} bytes)`);
      
      // Load and execute the minimal test script
      const luaScript = fs.readFileSync(
        path.join(__dirname, 'mgba-lua/minimal-test.lua'), 
        'utf8'
      );
      
      console.log('📝 Executing minimal test...');
      const result = await this.executeLuaScript(luaScript);
      
      // Parse results
      const patterns = this.parsePatternResults(result);
      
      if (patterns.length > 0) {
        console.log(`\n🎉 SUCCESS: Found ${patterns.length} universal patterns for ${gameName}`);
        patterns.forEach((pattern, i) => {
          console.log(`\nPattern ${i + 1} (${pattern.type}):`);
          console.log(`   Before LDR: ${pattern.beforePattern}`);
          console.log(`   After LDR:  ${pattern.afterPattern}`);
          console.log(`   Search mask: ${pattern.searchMask || 'N/A'}`);
          console.log(`   Expected: 0x${expectedAddr.toString(16).toUpperCase()}`);
        });
      } else {
        console.log(`❌ No universal patterns found for ${gameName}`);
      }
      
      return patterns;
      
    } finally {
      await this.cleanup();
    }
  }

  private async startMgbaContainer(gameName: string): Promise<void> {
    this.containerName = `mgba-test-${gameName}-${Date.now()}`;
    
    // Stop any existing containers
    try {
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' });
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (e) {
      // Ignore errors
    }

    // Start new container with game environment variable
    console.log('   Starting container...');
    execSync(`GAME=${gameName} docker compose -f ${DOCKER_COMPOSE_FILE} up -d`, { 
      stdio: 'inherit',
      env: { ...process.env, GAME: gameName }
    });
    
    // Wait for container to be ready
    console.log('   Waiting for mGBA to start...');
    await this.waitForMgba();
  }

  private async waitForMgba(): Promise<void> {
    for (let i = 0; i < 20; i++) {
      try {
        const ws = new WebSocket(MGBA_WEBSOCKET_URL);
        
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Connection timeout'));
          }, 3000);

          ws.on('open', () => {
            clearTimeout(timeout);
            ws.close();
            resolve();
          });

          ws.on('error', () => {
            clearTimeout(timeout);
            reject(new Error('Connection failed'));
          });
        });

        console.log(`✅ mGBA ready (attempt ${i + 1})`);
        return;
        
      } catch (e) {
        console.log(`   Waiting... (${i + 1}/20)`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    throw new Error('mGBA failed to start');
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(MGBA_WEBSOCKET_URL);
      
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 15000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.isReady = true;
        resolve();
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private async getRomInfo(): Promise<{ title: string; size: number }> {
    const script = `
      local romSize = emu:romSize()
      local romTitle = emu:read(0x08000000 + 0xA0, 12)
      print(string.format("ROM_INFO:%s:%d", romTitle, romSize))
    `;
    
    const result = await this.executeLuaScript(script);
    const match = result.match(/ROM_INFO:([^:]+):(\d+)/);
    
    if (match) {
      return {
        title: match[1].trim(),
        size: parseInt(match[2])
      };
    }
    
    return { title: 'Unknown', size: 0 };
  }

  private async executeLuaScript(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.ws || !this.isReady) {
        reject(new Error('WebSocket not ready'));
        return;
      }

      let output = '';
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Lua script execution timeout'));
        }
      }, TEST_TIMEOUT);

      const messageHandler = (data: Buffer) => {
        const message = data.toString();
        output += message + '\n';
        
        // Check for completion markers
        if (message.includes('MINIMAL_TEST_COMPLETE') || 
            message.includes('ERROR:')) {
          
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            this.ws?.off('message', messageHandler);
            resolve(output);
          }
        }
      };

      this.ws.on('message', messageHandler);
      this.ws.send(script);
    });
  }

  private parsePatternResults(output: string): UniversalPattern[] {
    const patterns: UniversalPattern[] = [];
    const lines = output.split('\n');
    
    let currentPattern: Partial<UniversalPattern> | null = null;
    
    for (const line of lines) {
      // Look for pattern headers
      if (line.includes('Pattern') && line.includes('(') && line.includes('):')) {
        if (currentPattern && currentPattern.type) {
          patterns.push(currentPattern as UniversalPattern);
        }
        
        const typeMatch = line.match(/\(([^)]+)\)/);
        currentPattern = {
          type: typeMatch ? typeMatch[1] : 'unknown',
          beforePattern: '',
          afterPattern: '',
          description: '',
          emeraldAddr: 0x020244EC,
          quetzalAddr: 0x020235B8
        };
      }
      
      // Parse pattern details
      if (currentPattern) {
        if (line.includes('Before LDR:')) {
          currentPattern.beforePattern = line.split('Before LDR:')[1]?.trim() || '';
        }
        if (line.includes('After LDR:')) {
          currentPattern.afterPattern = line.split('After LDR:')[1]?.trim() || '';
        }
        if (line.includes('Search mask:')) {
          currentPattern.searchMask = line.split('Search mask:')[1]?.trim() || '';
        }
      }
    }
    
    // Add the last pattern
    if (currentPattern && currentPattern.type) {
      patterns.push(currentPattern as UniversalPattern);
    }
    
    return patterns;
  }

  private analyzeCombinedPatterns(patterns: UniversalPattern[]): void {
    console.log(`Total universal patterns found: ${patterns.length}`);
    
    if (patterns.length === 0) {
      console.log('❌ No universal patterns to analyze');
      return;
    }

    console.log('\n📋 UNIVERSAL PATTERN SUMMARY:');
    console.log('==============================');
    
    patterns.forEach((pattern, i) => {
      console.log(`\n${i + 1}. ${pattern.type}:`);
      console.log(`   Before: ${pattern.beforePattern}`);
      console.log(`   After:  ${pattern.afterPattern}`);
      if (pattern.searchMask) {
        console.log(`   Mask:   ${pattern.searchMask}`);
      }
    });

    console.log('\n💡 IMPLEMENTATION GUIDE:');
    console.log('=========================');
    console.log('1. Use these patterns to search ROM memory');
    console.log('2. When pattern matches, extract LDR instruction');
    console.log('3. Calculate literal pool address from immediate value');
    console.log('4. Read partyData address from literal pool');
    console.log('');
    console.log('Expected results:');
    console.log('  - Emerald: 0x020244EC');
    console.log('  - Quetzal: 0x020235B8');
  }

  private async cleanup(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isReady = false;
    
    // Stop container
    try {
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'ignore' });
    } catch (e) {
      // Ignore errors
    }
  }
}

// Main execution
async function main() {
  const tester = new ProperUniversalPatternTester();
  
  try {
    await tester.testBothGames();
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Auto-run when script is executed directly
main();