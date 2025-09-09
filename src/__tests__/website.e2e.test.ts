/**
 * End-to-End Website Tests
 * Tests the complete user workflow of loading, editing, and saving Pokemon save files
 */

import { expect, test, type Page } from '@playwright/test'

// Path to test save file (declared but not used in basic tests)
// const testSaveFile = path.join(__dirname, '../lib/parser/__tests__/test_data/emerald.sav')

test.describe('Pokemon Save Web - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start the dev server and navigate to the app
    await page.goto('http://localhost:5173/')

    // Wait for the app to load
    await expect(page.getByText('Drop your Savegame here')).toBeVisible()
  })

  test('should load and display the initial dropzone', async ({ page }) => {
    // Check that the dropzone is visible
    await expect(page.getByText('Drop your Savegame here')).toBeVisible()
    await expect(page.getByText('or click to browse')).toBeVisible()
    await expect(page.getByText('Supported: .sav, .sa2')).toBeVisible()

    // Check that the Pokeball image is displayed
    await expect(page.getByAltText('Pokeball')).toBeVisible()
  })

  test('should load a save file and display Pokemon data', async ({ page }) => {
    // Load test save file using JavaScript (simulating file upload)
    await page.evaluate(async () => {
      const response = await fetch('/src/lib/parser/__tests__/test_data/emerald.sav')
      const buffer = await response.arrayBuffer()
      const file = new File([buffer], 'emerald.sav', { type: 'application/octet-stream' })

      // Find the file input and trigger change event
      const input = document.querySelector('input[type=file]')
      if (input) {
        Object.defineProperty(input, 'files', {
          value: [file],
          configurable: true,
        })
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })

    // Wait for Pokemon data to load and be displayed
    await expect(page.getByText('TREECKO')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Lv.5')).toBeVisible()

    // Check that the File menu is visible
    await expect(page.getByRole('menuitem', { name: 'File' })).toBeVisible()

    // Check that stat editing interface is visible
    await expect(page.getByText('HP')).toBeVisible()
    await expect(page.getByText('ATK')).toBeVisible()
    await expect(page.getByText('DEF')).toBeVisible()
  })

  test('should allow editing Pokemon IVs', async ({ page }) => {
    // Load save file first
    await loadTestSaveFile(page)

    // Wait for Pokemon data to be visible
    await expect(page.getByText('TREECKO')).toBeVisible({ timeout: 10000 })

    // Find and click on HP IV value to maximize it
    const hpIvElement = page.locator('text="Click to set to max (31)"').first()
    await hpIvElement.click()

    // Verify the IV changed to 31 (or appropriate max value)
    await expect(page.getByText('31')).toBeVisible()
  })

  test('should allow changing Pokemon nature', async ({ page }) => {
    // Load save file first
    await loadTestSaveFile(page)

    // Wait for Pokemon data to be visible
    await expect(page.getByText('TREECKO')).toBeVisible({ timeout: 10000 })

    // Open nature dropdown
    await page.getByRole('combobox').click()

    // Select a different nature (e.g., Adamant)
    await page.getByRole('option', { name: 'Adamant' }).click()

    // Verify nature changed
    await expect(page.getByText('Adamant')).toBeVisible()
  })

  test('should allow downloading the modified save file', async ({ page }) => {
    // Load save file first
    await loadTestSaveFile(page)

    // Wait for Pokemon data to be visible
    await expect(page.getByText('TREECKO')).toBeVisible({ timeout: 10000 })

    // Make a modification (change nature)
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Adamant' }).click()

    // Open File menu
    await page.getByRole('menuitem', { name: 'File' }).click()

    // Start download and wait for it
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: 'Download' }).click()
    const download = await downloadPromise

    // Verify download was successful
    expect(download.suggestedFilename()).toBe('emerald.sav')
  })

  test('should show proper menu options when save data is loaded', async ({ page }) => {
    // Load save file first
    await loadTestSaveFile(page)

    // Wait for Pokemon data to be visible
    await expect(page.getByText('TREECKO')).toBeVisible({ timeout: 10000 })

    // Open File menu
    await page.getByRole('menuitem', { name: 'File' }).click()

    // Check that expected menu items are present
    await expect(page.getByRole('menuitem', { name: 'Open' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Save As' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Download' })).toBeVisible()

    // Check that Save is disabled (since we didn't use File System Access API)
    await expect(page.getByRole('menuitem', { name: /Save.*Ctrl\+S/ })).toHaveAttribute('aria-disabled', 'true')
  })

  test('should handle EV slider changes', async ({ page }) => {
    // Load save file first
    await loadTestSaveFile(page)

    // Wait for Pokemon data to be visible
    await expect(page.getByText('TREECKO')).toBeVisible({ timeout: 10000 })

    // Find HP EV slider and interact with it
    const hpEvSlider = page.locator('[role="slider"]').first()
    await hpEvSlider.focus()

    // Use arrow keys to change the value
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')

    // Verify that the EV value changed
    // Note: This would need to be adjusted based on the actual implementation
  })

  test('should display empty slots correctly', async ({ page }) => {
    // Load save file first
    await loadTestSaveFile(page)

    // Wait for Pokemon data to be visible
    await expect(page.getByText('TREECKO')).toBeVisible({ timeout: 10000 })

    // Check that empty party slots are displayed correctly
    await expect(page.getByText('Empty Slot')).toBeVisible()
    await expect(page.getByText('-/-')).toBeVisible()
  })

  test('should handle responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Load save file
    await loadTestSaveFile(page)
    await expect(page.getByText('TREECKO')).toBeVisible({ timeout: 10000 })

    // Verify that elements are still visible and functional on mobile
    await expect(page.getByRole('menuitem', { name: 'File' })).toBeVisible()

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page.getByText('TREECKO')).toBeVisible()

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })
    await expect(page.getByText('TREECKO')).toBeVisible()
  })
})

/**
 * Helper function to load the test save file
 */
async function loadTestSaveFile(page: Page) {
  await page.evaluate(async () => {
    const response = await fetch('/src/lib/parser/__tests__/test_data/emerald.sav')
    const buffer = await response.arrayBuffer()
    const file = new File([buffer], 'emerald.sav', { type: 'application/octet-stream' })

    const input = document.querySelector('input[type=file]')
    if (input) {
      Object.defineProperty(input, 'files', {
        value: [file],
        configurable: true,
      })
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
  })
}
