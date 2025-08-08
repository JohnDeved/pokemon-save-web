#!/usr/bin/env tsx

/**
 * Mock ROM Data Generator for Behavioral Pattern Testing
 * 
 * Creates realistic ARM/THUMB code patterns that would be found in Pokemon ROMs
 * to test the behavioral pattern system.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function createMockROM(name: string, partyDataAddr: number, pokemonSize: number): Uint8Array {
  console.log(`🔧 Creating mock ${name} ROM with partyData at 0x${partyDataAddr.toString(16).toUpperCase()}`);
  
  // Create a 1MB mock ROM 
  const romSize = 1024 * 1024;
  const buffer = new Uint8Array(romSize);
  
  // Fill with random data to simulate real ROM
  for (let i = 0; i < romSize; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  
  // Add valid GBA header
  buffer[0] = 0x7F; // Valid GBA ROM start
  buffer[1] = 0x00;
  buffer[2] = 0x00;
  buffer[3] = 0xEA;
  
  console.log(`   ROM size: ${(romSize / 1024).toFixed(0)}KB`);
  console.log(`   Pokemon size: ${pokemonSize} bytes`);
  
  // PATTERN 1: Party size loop (MOV r0, #6 + LDR literal)
  const pattern1Offset = 0x1000;
  console.log(`   Adding party size loop at 0x${pattern1Offset.toString(16)}`);
  
  buffer[pattern1Offset] = 0x06;     // MOV r0, #6
  buffer[pattern1Offset + 1] = 0x20;
  // Add some padding instructions
  buffer[pattern1Offset + 2] = 0x00;
  buffer[pattern1Offset + 3] = 0x00;
  buffer[pattern1Offset + 4] = 0x00;
  buffer[pattern1Offset + 5] = 0x00;
  // LDR literal (E5 9F immediately after padding)
  buffer[pattern1Offset + 6] = 0xE5; // ARM LDR first
  buffer[pattern1Offset + 7] = 0x9F; // LDR literal marker
  buffer[pattern1Offset + 8] = 0x10; // LDR immediate low
  buffer[pattern1Offset + 9] = 0x00; // LDR immediate high
  
  // Literal pool for pattern 1 (PC + 8 + immediate)
  const literal1Addr = pattern1Offset + 6 + 8 + 0x10;
  buffer[literal1Addr] = (partyDataAddr >> 0) & 0xFF;
  buffer[literal1Addr + 1] = (partyDataAddr >> 8) & 0xFF;
  buffer[literal1Addr + 2] = (partyDataAddr >> 16) & 0xFF;
  buffer[literal1Addr + 3] = (partyDataAddr >> 24) & 0xFF;
  
  // PATTERN 2: Pokemon size calculation
  const pattern2Offset = 0x2000;
  console.log(`   Adding Pokemon size calculation at 0x${pattern2Offset.toString(16)}`);
  
  buffer[pattern2Offset] = pokemonSize; // Size (0x64 for Emerald, 0x68 for Quetzal)
  buffer[pattern2Offset + 1] = 0x00;
  buffer[pattern2Offset + 2] = 0x00;
  buffer[pattern2Offset + 3] = 0x00;
  // LDR literal right after (E5 9F first)
  buffer[pattern2Offset + 4] = 0xE5; // ARM LDR first
  buffer[pattern2Offset + 5] = 0x9F; // LDR literal marker  
  buffer[pattern2Offset + 6] = 0x08; // LDR immediate low
  buffer[pattern2Offset + 7] = 0x00; // LDR immediate high
  
  // Literal pool for pattern 2
  const literal2Addr = pattern2Offset + 4 + 8 + 0x08;
  buffer[literal2Addr] = (partyDataAddr >> 0) & 0xFF;
  buffer[literal2Addr + 1] = (partyDataAddr >> 8) & 0xFF;
  buffer[literal2Addr + 2] = (partyDataAddr >> 16) & 0xFF;
  buffer[literal2Addr + 3] = (partyDataAddr >> 24) & 0xFF;
  
  // PATTERN 3: THUMB party base loading
  const pattern3Offset = 0x3000;
  console.log(`   Adding THUMB party base at 0x${pattern3Offset.toString(16)}`);
  
  buffer[pattern3Offset] = 0x48;     // THUMB LDR literal
  buffer[pattern3Offset + 1] = 0x04; // immediate = 4
  buffer[pattern3Offset + 2] = 0x68; // THUMB LDR [r0]
  buffer[pattern3Offset + 3] = 0x00; // register
  buffer[pattern3Offset + 4] = 0x30; // THUMB ADDS (this needs to be before offset)
  buffer[pattern3Offset + 5] = 0x30; // Make it match 48 ?? 68 ?? ?? 30
  
  // THUMB literal pool (word-aligned PC + immediate*4)
  const thumbPC = ((pattern3Offset + 4) & ~3) + (4 * 4);
  buffer[thumbPC] = (partyDataAddr >> 0) & 0xFF;
  buffer[thumbPC + 1] = (partyDataAddr >> 8) & 0xFF;
  buffer[thumbPC + 2] = (partyDataAddr >> 16) & 0xFF;
  buffer[thumbPC + 3] = (partyDataAddr >> 24) & 0xFF;
  
  // PATTERN 4: Party bounds check (CMP #5)
  const pattern4Offset = 0x4000;
  console.log(`   Adding party bounds check at 0x${pattern4Offset.toString(16)}`);
  
  buffer[pattern4Offset] = 0x05;     // CMP #5
  buffer[pattern4Offset + 1] = 0x28;
  buffer[pattern4Offset + 2] = 0x43; // Some instruction
  buffer[pattern4Offset + 3] = 0xE1; // Some instruction  
  // LDR literal (E5 9F first)
  buffer[pattern4Offset + 4] = 0xE5; // ARM LDR first
  buffer[pattern4Offset + 5] = 0x9F; // LDR literal marker
  buffer[pattern4Offset + 6] = 0x0C; // LDR immediate low
  buffer[pattern4Offset + 7] = 0x00; // LDR immediate high
  
  // Literal pool for pattern 4
  const literal4Addr = pattern4Offset + 4 + 8 + 0x0C;
  buffer[literal4Addr] = (partyDataAddr >> 0) & 0xFF;
  buffer[literal4Addr + 1] = (partyDataAddr >> 8) & 0xFF;
  buffer[literal4Addr + 2] = (partyDataAddr >> 16) & 0xFF;
  buffer[literal4Addr + 3] = (partyDataAddr >> 24) & 0xFF;
  
  console.log(`✅ Mock ${name} ROM created with multiple behavioral patterns`);
  return buffer;
}

async function createMockROMs() {
  console.log('🚀 Creating Mock ROM Files for Behavioral Pattern Testing');
  console.log('============================================================\n');
  
  const testDataDir = resolve(__dirname, '..', 'docker', 'test_data');
  
  if (!existsSync(testDataDir)) {
    mkdirSync(testDataDir, { recursive: true });
  }
  
  // Create mock Emerald ROM
  const emeraldROM = createMockROM('Emerald', 0x020244EC, 0x64);
  const emeraldPath = resolve(testDataDir, 'emerald.gba');
  writeFileSync(emeraldPath, emeraldROM);
  console.log(`📁 Saved: ${emeraldPath}`);
  
  // Create mock Quetzal ROM  
  const quetzalROM = createMockROM('Quetzal', 0x020235B8, 0x68);
  const quetzalPath = resolve(testDataDir, 'quetzal.gba');
  writeFileSync(quetzalPath, quetzalROM);
  console.log(`📁 Saved: ${quetzalPath}`);
  
  console.log('\n✅ Mock ROM files created successfully!');
  console.log('These ROMs contain realistic ARM/THUMB patterns that the');
  console.log('behavioral pattern system should be able to detect.');
  console.log('\nRun: npm run test-true-behavioral');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createMockROMs().catch(console.error);
}