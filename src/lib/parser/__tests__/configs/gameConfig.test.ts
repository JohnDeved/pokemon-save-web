/**
 * Test for game configuration module
 */

import { describe, expect, it } from 'vitest'
import { autoDetectGameConfig, QuetzalConfig, VanillaConfig } from '../../configs'

describe('Game Configuration Module', () => {
  describe('QuetzalConfig', () => {
    it('should create QuetzalConfig instance', () => {
      const config = new QuetzalConfig()
      expect(config.name).toBe('Pokemon Quetzal')
      expect(config.signature).toBe(0x08012025)
      expect(config.offsets.partyStartOffset).toBe(0x6A8)
    })

    it('should have pokemon mappings', () => {
      const config = new QuetzalConfig()
      expect(config.mappings.pokemon.size).toBeGreaterThan(0)
    })
  })

  describe('VanillaConfig', () => {
    it('should create VanillaConfig instance', () => {
      const config = new VanillaConfig()
      expect(config.name).toBe('Pokemon Emerald (Vanilla)')
      expect(config.signature).toBe(0x08012025)
      expect(config.offsets.partyStartOffset).toBe(0x234)
    })
  })

  describe('autoDetectGameConfig', () => {
    it('should return null for empty save data', () => {
      const emptyData = new Uint8Array(1000)
      const detected = autoDetectGameConfig(emptyData)
      expect(detected).toBeNull()
    })

    it('should return null for invalid save data', () => {
      const invalidData = new Uint8Array(100).fill(0xFF)
      const detected = autoDetectGameConfig(invalidData)
      expect(detected).toBeNull()
    })
  })
})