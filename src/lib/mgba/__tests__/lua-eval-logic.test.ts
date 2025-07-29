/**
 * Test the Lua eval logic for handling various input scenarios
 * This tests the eval enhancement logic that decides when to prepend 'return'
 */

import { describe, it, expect } from 'vitest'

// Mock the eval logic from http-server.lua
function processEvalInput (input: string): string {
  const trimmedMessage = input.trim()
  let chunk = trimmedMessage

  // Don't process empty input
  if (trimmedMessage === '') {
    return trimmedMessage
  }

  // Enhanced support for non-self-executing function inputs
  // Only prepend 'return' for simple expressions that don't already have control flow
  let needsReturn = true

  // Don't add return if code already contains these keywords at the start
  const keywords = ['return', 'local', 'function', 'for', 'while', 'if', 'do', 'repeat', 'goto', 'break', 'end']
  for (const keyword of keywords) {
    const pattern = new RegExp(`^\\s*${keyword}[\\s(]`)
    if (pattern.test(trimmedMessage) || trimmedMessage === keyword) {
      needsReturn = false
      break
    }
  }

  // Don't add return for multi-line code
  if (trimmedMessage.includes('\n') || trimmedMessage.includes('\r')) {
    needsReturn = false
  }

  // Don't add return if code contains semicolons (likely statements)
  if (trimmedMessage.includes(';')) {
    needsReturn = false
  }

  if (needsReturn) {
    chunk = `return ${trimmedMessage}`
  }

  return chunk
}

describe('Lua Eval Logic', () => {
  it('should prepend return to simple expressions', () => {
    expect(processEvalInput('1+1')).toBe('return 1+1')
    expect(processEvalInput('math.sqrt(16)')).toBe('return math.sqrt(16)')
    expect(processEvalInput('2 * 3 + 4')).toBe('return 2 * 3 + 4')
  })

  it('should not prepend return to expressions that already have return', () => {
    expect(processEvalInput('return 1+1')).toBe('return 1+1')
    expect(processEvalInput('  return 2*3  ')).toBe('return 2*3')
  })

  it('should not prepend return to code starting with control flow keywords', () => {
    expect(processEvalInput('if true then return 42 end')).toBe('if true then return 42 end')
    expect(processEvalInput('for i=1,10 do print(i) end')).toBe('for i=1,10 do print(i) end')
    expect(processEvalInput('while true do break end')).toBe('while true do break end')
    expect(processEvalInput('function test() return 1 end')).toBe('function test() return 1 end')
    expect(processEvalInput('do return 42 end')).toBe('do return 42 end')
  })

  it('should not prepend return to code starting with local', () => {
    expect(processEvalInput('local x = 5')).toBe('local x = 5')
    expect(processEvalInput('local function test() return 1 end')).toBe('local function test() return 1 end')
  })

  it('should not prepend return to multi-line code', () => {
    expect(processEvalInput('local test = 1\nreturn test + 1')).toBe('local test = 1\nreturn test + 1')
    expect(processEvalInput('if true then\n  return 42\nend')).toBe('if true then\n  return 42\nend')
  })

  it('should not prepend return to code with semicolons', () => {
    expect(processEvalInput('local x = 5; return x * 2')).toBe('local x = 5; return x * 2')
    expect(processEvalInput('x = 1; y = 2; return x + y')).toBe('x = 1; y = 2; return x + y')
  })

  it('should handle edge cases correctly', () => {
    expect(processEvalInput('   1+1   ')).toBe('return 1+1')
    expect(processEvalInput('')).toBe('')
    expect(processEvalInput('return')).toBe('return')
    expect(processEvalInput('local')).toBe('local')
  })
})
