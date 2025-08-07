/**
 * Test WASM integration
 */
import { wasmUtils } from '../core/WasmPokemonSaveParser'

describe('WASM Pokemon Save Parser', () => {
  test('should load WASM module and run test function', async () => {
    const result = await wasmUtils.testWasm()
    expect(result).toBe('Pokemon Save Parser WASM module is working!')
  })

  test('should convert strings to GBA bytes', async () => {
    const text = 'PIKACHU'
    const bytes = wasmUtils.gbaStringToBytes(text, 10)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBe(10)
  })

  test('should get Pokemon nature from personality', async () => {
    const personality = 123456
    const nature = wasmUtils.getPokemonNature(personality)
    expect(typeof nature).toBe('string')
    expect(nature.length).toBeGreaterThan(0)
  })

  test('should check if Pokemon is shiny', async () => {
    const personality = 123456
    const otId = 789
    const isShiny = wasmUtils.isPokemonShiny(personality, otId)
    expect(typeof isShiny).toBe('boolean')
  })

  test('should format play time', async () => {
    const formatted = wasmUtils.formatPlayTime(12, 34, 56)
    expect(formatted).toBe('12:34:56')
  })
})