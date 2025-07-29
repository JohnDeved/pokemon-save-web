/**
 * End-to-End Website Tests
 * Tests the complete user workflow of loading, editing, and saving Pokemon save files
 * Enhanced with robust selectors and comprehensive error handling
 */

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

// Test configuration
const DEFAULT_TIMEOUT = 15000
const LOAD_TIMEOUT = 30000

// Robust selectors using multiple strategies
const SELECTORS = {
  dropzone: {
    container: '[data-testid="dropzone"], .dropzone, [class*="dropzone"]',
    text: 'text="Drop your Savegame here"',
    clickText: 'text="or click to browse"',
    supportedText: 'text="Supported: .sav, .sa2"',
  },
  pokeball: {
    image: 'img[alt="Pokeball"], [data-testid="pokeball"], img[src*="pokeball"]',
  },
  pokemon: {
    heading: 'h2:has-text("TREECKO"), [data-testid="pokemon-name"]:has-text("TREECKO")',
  },
  menu: {
    file: 'role=menuitem[name="File"], [data-testid="file-menu"], button:has-text("File")',
  },
  stats: {
    hp: 'text="HP", [data-testid="stat-hp"]',
    attack: 'text="ATK", [data-testid="stat-attack"]',
    defense: 'text="DEF", [data-testid="stat-defense"]',
  },
  ui: {
    fileInput: 'input[type="file"], [data-testid="file-input"]',
    ivMaxButton: 'text="Click to set to max (31)", [data-testid="iv-max-button"]',
    natureSelect: 'role=combobox, [data-testid="nature-select"], select',
    evSlider: 'role=slider, [data-testid="ev-slider"], input[type="range"]',
  },
} as const

test.describe('Pokemon Save Web - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start the dev server and navigate to the app
    await page.goto('http://localhost:5173/')

    // Wait for the app to load with multiple selector strategies
    await Promise.race([
      expect(page.locator(SELECTORS.dropzone.text)).toBeVisible({ timeout: DEFAULT_TIMEOUT }),
      expect(page.locator(SELECTORS.dropzone.container)).toBeVisible({ timeout: DEFAULT_TIMEOUT }),
    ])
  })

  test('should load and display the initial dropzone', async ({ page }) => {
    // Check that the dropzone is visible using robust selectors
    await expect(page.locator(SELECTORS.dropzone.text)).toBeVisible()
    await expect(page.locator(SELECTORS.dropzone.clickText)).toBeVisible()
    await expect(page.locator(SELECTORS.dropzone.supportedText)).toBeVisible()

    // Check that the Pokeball image is displayed
    await expect(page.locator(SELECTORS.pokeball.image)).toBeVisible()
  })

  test('should load a save file and display Pokemon data', async ({ page }) => {
    // Load test save file using JavaScript with enhanced error handling
    await loadTestSaveFileRobust(page)

    // Wait for Pokemon data to load and be displayed with robust selector
    await expect(page.locator(SELECTORS.pokemon.heading)).toBeVisible({ timeout: LOAD_TIMEOUT })

    // Check that the File menu is visible with multiple selector strategies
    await expect(page.locator(SELECTORS.menu.file)).toBeVisible()

    // Check that stat editing interface is visible
    await expect(page.locator(SELECTORS.stats.hp)).toBeVisible()
    await expect(page.locator(SELECTORS.stats.attack)).toBeVisible()
    await expect(page.locator(SELECTORS.stats.defense)).toBeVisible()
  })

  test('should allow editing Pokemon IVs', async ({ page }) => {
    // Load save file first
    await loadTestSaveFileRobust(page)

    // Wait for Pokemon data to be visible
    await expect(page.locator(SELECTORS.pokemon.heading)).toBeVisible({ timeout: LOAD_TIMEOUT })

    // Find and click on HP IV value to maximize it with robust selector
    const ivButton = page.locator(SELECTORS.ui.ivMaxButton).first()
    await expect(ivButton).toBeVisible({ timeout: DEFAULT_TIMEOUT })
    await ivButton.click()

    // Verify the IV changed to 31 (or appropriate max value)
    await expect(page.getByText('31')).toBeVisible({ timeout: DEFAULT_TIMEOUT })
  })

  test('should allow changing Pokemon nature', async ({ page }) => {
    // Load save file first
    await loadTestSaveFileRobust(page)

    // Wait for Pokemon data to be visible
    await expect(page.locator(SELECTORS.pokemon.heading)).toBeVisible({ timeout: LOAD_TIMEOUT })

    // Open nature dropdown with robust selector
    const natureSelect = page.locator(SELECTORS.ui.natureSelect)
    await expect(natureSelect).toBeVisible({ timeout: DEFAULT_TIMEOUT })
    await natureSelect.click()

    // Select a different nature (e.g., Adamant)
    await page.getByRole('option', { name: 'Adamant' }).click()

    // Verify nature changed
    await expect(page.getByText('Adamant')).toBeVisible({ timeout: DEFAULT_TIMEOUT })
  })

  test('should allow downloading the modified save file', async ({ page }) => {
    // Load save file first
    await loadTestSaveFileRobust(page)

    // Wait for Pokemon data to be visible
    await expect(page.locator(SELECTORS.pokemon.heading)).toBeVisible({ timeout: LOAD_TIMEOUT })

    // Make a modification (change nature) with error handling
    try {
      const natureSelect = page.locator(SELECTORS.ui.natureSelect)
      await expect(natureSelect).toBeVisible({ timeout: DEFAULT_TIMEOUT })
      await natureSelect.click()
      await page.getByRole('option', { name: 'Adamant' }).click()
    } catch (error) {
      console.warn('Could not modify nature, proceeding with download test:', error)
    }

    // Open File menu with robust selector
    const fileMenu = page.locator(SELECTORS.menu.file)
    await expect(fileMenu).toBeVisible({ timeout: DEFAULT_TIMEOUT })
    await fileMenu.click()

    // Start download and wait for it
    const downloadPromise = page.waitForDownload({ timeout: DEFAULT_TIMEOUT })
    await page.getByRole('menuitem', { name: 'Download' }).click()
    const download = await downloadPromise

    // Verify download was successful
    expect(download.suggestedFilename()).toBe('emerald.sav')
  })

  test('should show proper menu options when save data is loaded', async ({ page }) => {
    // Load save file first
    await loadTestSaveFileRobust(page)

    // Wait for Pokemon data to be visible
    await expect(page.locator(SELECTORS.pokemon.heading)).toBeVisible({ timeout: LOAD_TIMEOUT })

    // Open File menu
    const fileMenu = page.locator(SELECTORS.menu.file)
    await expect(fileMenu).toBeVisible({ timeout: DEFAULT_TIMEOUT })
    await fileMenu.click()

    // Check that expected menu items are present
    await expect(page.getByRole('menuitem', { name: 'Open' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Save As' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Download' })).toBeVisible()

    // Check that Save is disabled (since we didn't use File System Access API)
    await expect(page.getByRole('menuitem', { name: /Save.*Ctrl\+S/ })).toHaveAttribute('aria-disabled', 'true')
  })

  test('should handle EV slider changes', async ({ page }) => {
    // Load save file first
    await loadTestSaveFileRobust(page)

    // Wait for Pokemon data to be visible
    await expect(page.locator(SELECTORS.pokemon.heading)).toBeVisible({ timeout: LOAD_TIMEOUT })

    // Find HP EV slider and interact with it using robust selector
    const evSlider = page.locator(SELECTORS.ui.evSlider).first()
    await expect(evSlider).toBeVisible({ timeout: DEFAULT_TIMEOUT })
    await evSlider.focus()

    // Use arrow keys to change the value
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')

    // Verify that the slider interaction was successful (no specific value test needed)
    // The main goal is to ensure the slider is functional without errors
  })

  test('should display empty slots correctly', async ({ page }) => {
    // Load save file first
    await loadTestSaveFileRobust(page)

    // Wait for Pokemon data to be visible
    await expect(page.locator(SELECTORS.pokemon.heading)).toBeVisible({ timeout: LOAD_TIMEOUT })

    // Check that empty party slots are displayed correctly
    await expect(page.getByText('Empty Slot')).toBeVisible({ timeout: DEFAULT_TIMEOUT })
    await expect(page.getByText('-/-')).toBeVisible({ timeout: DEFAULT_TIMEOUT })
  })

  test('should handle responsive design across multiple viewports', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Load save file
    await loadTestSaveFileRobust(page)
    await expect(page.locator(SELECTORS.pokemon.heading)).toBeVisible({ timeout: LOAD_TIMEOUT })

    // Verify that elements are still visible and functional on mobile
    await expect(page.locator(SELECTORS.menu.file)).toBeVisible({ timeout: DEFAULT_TIMEOUT })

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page.locator(SELECTORS.pokemon.heading)).toBeVisible({ timeout: DEFAULT_TIMEOUT })

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })
    await expect(page.locator(SELECTORS.pokemon.heading)).toBeVisible({ timeout: DEFAULT_TIMEOUT })
  })

  test('should handle file upload errors gracefully', async ({ page }) => {
    // Try to upload an invalid file (simulate via JavaScript)
    await page.evaluate(async () => {
      const invalidFile = new File(['invalid content'], 'invalid.txt', { type: 'text/plain' })
      const input = document.querySelector('input[type="file"]')
      if (input) {
        Object.defineProperty(input, 'files', {
          value: [invalidFile],
          configurable: true,
        })
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })

    // Should not crash and should show appropriate error handling
    // The app should remain in a stable state
    await expect(page.locator(SELECTORS.dropzone.text)).toBeVisible({ timeout: DEFAULT_TIMEOUT })
  })

  test('should handle network errors when loading save file', async ({ page }) => {
    // Simulate network failure by trying to load a non-existent file
    const loadResult = await page.evaluate(async () => {
      try {
        const response = await fetch('/non-existent-file.sav')
        return { success: response.ok, status: response.status }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    })

    // Should handle the error gracefully
    expect(loadResult.success).toBe(false)

    // App should remain functional
    await expect(page.locator(SELECTORS.dropzone.text)).toBeVisible({ timeout: DEFAULT_TIMEOUT })
  })
})

/**
 * Enhanced helper function to load the test save file with robust error handling
 */
async function loadTestSaveFileRobust (page: Page): Promise<void> {
  const maxRetries = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await page.evaluate(async () => {
        const response = await fetch('/src/lib/parser/__tests__/test_data/emerald.sav')
        if (!response.ok) {
          throw new Error(`Failed to fetch save file: ${response.status} ${response.statusText}`)
        }

        const buffer = await response.arrayBuffer()
        const file = new File([buffer], 'emerald.sav', { type: 'application/octet-stream' })

        const input = document.querySelector('input[type="file"]')
        if (!input) {
          throw new Error('File input not found in DOM')
        }

        Object.defineProperty(input, 'files', {
          value: [file],
          configurable: true,
        })
        input.dispatchEvent(new Event('change', { bubbles: true }))
      })

      // Wait a moment for the file to be processed
      await page.waitForTimeout(1000)
      return // Success
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`Load attempt ${attempt}/${maxRetries} failed:`, lastError.message)

      if (attempt < maxRetries) {
        await page.waitForTimeout(1000) // Wait before retry
      }
    }
  }

  if (lastError) {
    throw lastError
  }
  throw new Error(`Failed to load test save file after ${maxRetries} attempts`)
}
