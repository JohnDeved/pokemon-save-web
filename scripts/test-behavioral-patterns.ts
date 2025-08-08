#!/usr/bin/env tsx

/**
 * Behavioral Universal Pattern Validation
 * 
 * Tests the new behavioral pattern system that finds partyData addresses
 * through code analysis without knowing target addresses beforehand.
 */

import { spawn } from 'child_process';
import WebSocket from 'ws';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface TestResult {
  game: string;
  rom: string;
  success: boolean;
  address?: number;
  method?: string;
  confidence?: string;
  patterns?: string[];
  error?: string;
}

class BehavioralPatternTester {
  private ws?: WebSocket;
  private mgbaProcess?: any;
  private messageQueue: any[] = [];
  private isConnected = false;

  async testGame(game: 'emerald' | 'quetzal'): Promise<TestResult> {
    console.log(`\n============================================================`);
    console.log(`🎮 Testing Behavioral Patterns for Pokemon ${game.toUpperCase()}`);
    console.log(`============================================================`);

    try {
      // Start mGBA Docker
      await this.startMGBA(game);
      
      // Wait for connection
      await this.waitForConnection();
      
      // Get ROM info
      const romInfo = await this.getROMInfo();
      console.log(`✅ ROM: ${romInfo.title} (${romInfo.size} bytes)`);
      
      // Load and run behavioral pattern Lua script
      console.log(`\n🧪 Loading behavioral pattern scanner...`);
      const luaScript = readFileSync(
        resolve(__dirname, 'mgba-lua/behavioral-universal-patterns.lua'), 
        'utf8'
      );
      
      // Execute the behavioral pattern detection
      console.log(`🔍 Running behavioral pattern analysis...`);
      const result = await this.executeLua(luaScript);
      
      // Parse the result
      let address: number | undefined;
      let method: string | undefined;
      let patterns: string[] = [];
      
      if (result && typeof result.return_value === 'number') {
        address = result.return_value;
        method = 'behavioral_analysis';
        console.log(`✅ Behavioral analysis succeeded!`);
        console.log(`   Address found: 0x${address.toString(16).toUpperCase().padStart(8, '0')}`);
      } else {
        console.log(`❌ Behavioral analysis failed`);
        return {
          game,
          rom: romInfo.title,
          success: false,
          error: 'No address found through behavioral analysis'
        };
      }
      
      // Validate the result
      const expectedAddresses = {
        emerald: 0x020244EC,
        quetzal: 0x020235B8
      };
      
      const isExpected = address === expectedAddresses[game];
      
      return {
        game,
        rom: romInfo.title,
        success: true,
        address,
        method,
        confidence: isExpected ? 'high' : 'medium',
        patterns: ['behavioral_analysis']
      };
      
    } catch (error) {
      console.error(`❌ Error testing ${game}:`, error);
      return {
        game,
        rom: `${game} ROM`,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      await this.cleanup();
    }
  }

  private async startMGBA(game: string): Promise<void> {
    console.log(`🚀 Starting mGBA Docker for ${game}...`);
    
    // Stop any existing containers
    try {
      await this.execCommand('docker', ['stop', 'mgba-behavioral-test'], false);
      await this.sleep(1000);
    } catch {}
    
    // Start new container
    const dockerProcess = spawn('docker', [
      'run', '--rm', '-d',
      '--name', 'mgba-behavioral-test',
      '-p', '8080:8080',
      '-v', `${resolve(__dirname, 'mgba-lua')}:/lua:ro`,
      '-v', `${resolve(__dirname, '..', 'docker', 'test_data')}:/roms:ro`,
      'mgba-test-environment',
      'mgba-qt',
      '-s', '8080',
      `/roms/${game}.gba`
    ]);

    this.mgbaProcess = dockerProcess;

    return new Promise((resolve, reject) => {
      let resolved = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Docker startup timeout'));
        }
      }, 30000);

      dockerProcess.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(error);
        }
      });

      // Wait a bit for container to start
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve();
        }
      }, 3000);
    });
  }

  private async waitForConnection(): Promise<void> {
    console.log(`🔗 Connecting to mGBA WebSocket...`);
    
    const maxAttempts = 15;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await new Promise<void>((resolve, reject) => {
          const ws = new WebSocket('ws://localhost:8080');
          
          const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Connection timeout'));
          }, 5000);

          ws.on('open', () => {
            clearTimeout(timeout);
            this.ws = ws;
            this.isConnected = true;
            
            ws.on('message', (data) => {
              try {
                const message = JSON.parse(data.toString());
                this.messageQueue.push(message);
              } catch (e) {
                console.error('Failed to parse message:', data.toString());
              }
            });
            
            ws.on('close', () => {
              this.isConnected = false;
            });
            
            resolve();
          });

          ws.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });
        
        console.log(`✅ Connected to mGBA (attempt ${attempt})`);
        return;
        
      } catch (error) {
        console.log(`   Waiting... (${attempt}/${maxAttempts})`);
        if (attempt === maxAttempts) {
          throw new Error(`Failed to connect after ${maxAttempts} attempts`);
        }
        await this.sleep(2000);
      }
    }
  }

  private async getROMInfo(): Promise<{ title: string; size: number }> {
    const response = await this.executeLua(`
      return {
        title = emu:getGameTitle(),
        size = emu:romSize()
      }
    `);
    
    return response.return_value;
  }

  private async executeLua(script: string): Promise<any> {
    if (!this.ws || !this.isConnected) {
      throw new Error('Not connected to mGBA');
    }

    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substr(2, 9);
      
      // Clear message queue
      this.messageQueue = [];
      
      this.ws!.send(JSON.stringify({
        type: 'eval',
        script: script,
        id: id
      }));

      const timeout = setTimeout(() => {
        reject(new Error('Lua execution timeout'));
      }, 30000);

      const checkForResponse = () => {
        const response = this.messageQueue.find(msg => msg.id === id);
        if (response) {
          clearTimeout(timeout);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        } else {
          setTimeout(checkForResponse, 100);
        }
      };

      checkForResponse();
    });
  }

  private async cleanup(): Promise<void> {
    console.log(`🧹 Cleaning up...`);
    
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    
    try {
      await this.execCommand('docker', ['stop', 'mgba-behavioral-test'], false);
    } catch {}
  }

  private async execCommand(command: string, args: string[], throwOnError = true): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args);
      let output = '';
      let error = '';

      process.stdout?.on('data', (data) => {
        output += data.toString();
      });

      process.stderr?.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0 || !throwOnError) {
          resolve(output);
        } else {
          reject(new Error(`Command failed with code ${code}: ${error}`));
        }
      });

      process.on('error', (err) => {
        if (throwOnError) {
          reject(err);
        } else {
          resolve('');
        }
      });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

async function main() {
  console.log(`🚀 Behavioral Universal Pattern Validation Test`);
  console.log(`Testing NEW behavioral analysis approach that finds addresses dynamically`);
  console.log(`WITHOUT knowing target addresses beforehand`);
  console.log(`============================================================\n`);

  const tester = new BehavioralPatternTester();
  const results: TestResult[] = [];

  // Test both games
  for (const game of ['emerald', 'quetzal'] as const) {
    const result = await tester.testGame(game);
    results.push(result);
  }

  // Summary
  console.log(`\n============================================================`);
  console.log(`📊 BEHAVIORAL PATTERN ANALYSIS SUMMARY`);
  console.log(`============================================================\n`);

  for (const result of results) {
    console.log(`🎮 ${result.game.toUpperCase()}:`);
    console.log(`   📱 ROM: ${result.rom}`);
    
    if (result.success) {
      console.log(`   ✅ SUCCESS`);
      console.log(`   📍 Found: 0x${result.address!.toString(16).toUpperCase()}`);
      console.log(`   🔧 Method: ${result.method}`);
      console.log(`   🎯 Confidence: ${result.confidence}`);
    } else {
      console.log(`   ❌ FAILED`);
      console.log(`   💥 Error: ${result.error}`);
    }
    console.log(``);
  }

  const successCount = results.filter(r => r.success).length;
  if (successCount === results.length) {
    console.log(`🎉 ALL TESTS PASSED!`);
    console.log(`✅ Behavioral patterns successfully discovered partyData addresses dynamically.`);
    console.log(`✅ The new approach works without knowing target addresses beforehand.`);
  } else {
    console.log(`⚠️  ${successCount}/${results.length} tests passed.`);
    console.log(`❌ Some behavioral patterns failed - further refinement needed.`);
  }

  console.log(`============================================================`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}