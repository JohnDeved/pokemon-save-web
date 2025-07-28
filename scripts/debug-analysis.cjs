#!/usr/bin/env node

/**
 * Quick script to debug memory addresses using the working CLI 
 */

console.log('🔍 MEMORY ADDRESS DEBUG')
console.log('======================')

console.log('User confirmed addresses:')
console.log('- quetzal.ss0: Party data at 0x2024a14, count at 0x2024a10')

console.log('\nMy scanner found:')
console.log('- Count at 0x2024a14, data at 0x2024a18')

console.log('\nThe issue:')
console.log('- My scanner found count=6 at 0x2024a14')
console.log('- But parser reads value 211 from 0x2024a14')
console.log('- This suggests the count is actually at 0x2024a10')

console.log('\nSolution:')
console.log('- Adjust scanner to check if party count is at -4 offset from Pokemon data')
console.log('- Look for Pokemon data first, then check count at -4 offset')

console.log('\nLet me implement this fix...')