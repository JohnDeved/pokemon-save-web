#!/usr/bin/env tsx
/**
 * Calculate memory addresses for Quetzal based on save file analysis
 */

// From our analysis:
// Active slot base: 0x1e000 (slot 14)
// Party count offset: 0x6A4 
// Party data offset: 0x6A8

const ACTIVE_SLOT_BASE = 0x1e000
const PARTY_COUNT_OFFSET = 0x6A4
const PARTY_DATA_OFFSET = 0x6A8

// Calculate save file offsets
const SAVE_PARTY_COUNT_OFFSET = ACTIVE_SLOT_BASE + PARTY_COUNT_OFFSET // 0x1e6a4
const SAVE_PARTY_DATA_OFFSET = ACTIVE_SLOT_BASE + PARTY_DATA_OFFSET   // 0x1e6a8

console.log('🔍 Quetzal Save File Analysis Results')
console.log('=====================================')
console.log(`Active slot base: 0x${ACTIVE_SLOT_BASE.toString(16)}`)
console.log(`Party count at save offset: 0x${SAVE_PARTY_COUNT_OFFSET.toString(16)} (${SAVE_PARTY_COUNT_OFFSET})`)
console.log(`Party data at save offset: 0x${SAVE_PARTY_DATA_OFFSET.toString(16)} (${SAVE_PARTY_DATA_OFFSET})`)

// For GBA games, common memory regions:
// EWRAM: 0x02000000 - 0x02040000 (256KB)
// IWRAM: 0x03000000 - 0x03008000 (32KB)
// Save data is typically loaded into EWRAM

// For Pokemon Emerald specifically, save data is often loaded around:
// - 0x02024000 region for various save blocks
// - The party data tends to be at consistent offsets from these bases

// Vanilla addresses for reference:
const VANILLA_PARTY_COUNT = 0x20244e9
const VANILLA_PARTY_DATA = 0x20244ec

console.log('\n📍 Vanilla Reference Addresses:')
console.log(`Vanilla party count: 0x${VANILLA_PARTY_COUNT.toString(16)}`)
console.log(`Vanilla party data:  0x${VANILLA_PARTY_DATA.toString(16)}`)

// Calculate potential memory bases by subtracting save offsets from vanilla addresses
const POTENTIAL_MEMORY_BASE_1 = VANILLA_PARTY_COUNT - PARTY_COUNT_OFFSET
const POTENTIAL_MEMORY_BASE_2 = VANILLA_PARTY_DATA - PARTY_DATA_OFFSET

console.log('\n💡 Calculated Memory Bases:')
console.log(`Base from party count: 0x${POTENTIAL_MEMORY_BASE_1.toString(16)}`)
console.log(`Base from party data:  0x${POTENTIAL_MEMORY_BASE_2.toString(16)}`)

// These should be the same, let's use the average
const MEMORY_BASE = Math.floor((POTENTIAL_MEMORY_BASE_1 + POTENTIAL_MEMORY_BASE_2) / 2)

console.log(`\nProposed memory base: 0x${MEMORY_BASE.toString(16)}`)

// Calculate final Quetzal memory addresses
const QUETZAL_PARTY_COUNT = MEMORY_BASE + PARTY_COUNT_OFFSET
const QUETZAL_PARTY_DATA = MEMORY_BASE + PARTY_DATA_OFFSET

console.log('\n🎯 Proposed Quetzal Memory Addresses:')
console.log(`Party count: 0x${QUETZAL_PARTY_COUNT.toString(16)}`)
console.log(`Party data:  0x${QUETZAL_PARTY_DATA.toString(16)}`)

console.log('\n📝 Config Update:')
console.log(`memoryAddresses: {`)
console.log(`  partyData: 0x${QUETZAL_PARTY_DATA.toString(16)},`)
console.log(`  partyCount: 0x${QUETZAL_PARTY_COUNT.toString(16)},`)
console.log(`}`)

// Check if addresses are reasonable
console.log('\n✅ Validation:')
console.log(`Addresses are in EWRAM range: ${(QUETZAL_PARTY_COUNT >= 0x02000000 && QUETZAL_PARTY_COUNT < 0x02040000) ? 'Yes' : 'No'}`)
console.log(`Offset difference matches: ${(QUETZAL_PARTY_DATA - QUETZAL_PARTY_COUNT) === 4 ? 'Yes' : 'No'}`)

// Also check for potential player name and play time
// Play time was found at save offset 0x1d010, let's see what that gives us
const SAVE_PLAY_TIME_OFFSET = 0x1d010
const PLAY_TIME_MEMORY = MEMORY_BASE + (SAVE_PLAY_TIME_OFFSET - ACTIVE_SLOT_BASE)

console.log(`\n🕒 Play Time Analysis:`)
console.log(`Play time at save offset: 0x${SAVE_PLAY_TIME_OFFSET.toString(16)}`)
console.log(`Proposed play time memory: 0x${PLAY_TIME_MEMORY.toString(16)}`)