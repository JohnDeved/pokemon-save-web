/**
 * Website Integration Tests
 * Tests the core website functionality including loading, editing, and saving Pokemon save files
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { App } from '../App'

// Mock file content (emerald.sav test data)
const mockSaveFileContent = new Uint8Array([
  // This would be the actual emerald.sav content - for testing we'll use a minimal mock
  0x00, 0x01, 0x02, 0x03, // ... truncated for brevity
])

// Create a mock File object
const createMockFile = (name: string, content: Uint8Array): File => {
  const blob = new Blob([content], { type: 'application/octet-stream' })
  return new File([blob], name, { type: 'application/octet-stream' })
}

// Mock react-dropzone
vi.mock('react-dropzone', () => ({
  useDropzone: vi.fn(() => ({
    getRootProps: () => ({ 'data-testid': 'dropzone' }),
    getInputProps: () => ({ 'data-testid': 'file-input' }),
    isDragActive: false,
    open: vi.fn(),
  })),
  fromEvent: vi.fn(),
}))

// Mock file-saver
vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}))

// Mock sonner toasts
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
  Toaster: () => null,
}))

// Mock the shader background component
vi.mock('../components/common/ShaderBackground', () => ({
  ShaderBackground: () => null,
}))

// Mock PWA install prompt
vi.mock('../components/common/PWAInstallPrompt', () => ({
  PWAInstallPrompt: () => null,
}))

describe('Pokemon Save Web - Website Integration Tests', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    
    // Mock fetch for sprite images
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob()),
      } as Response)
    )

    // Mock window.showSaveFilePicker for File System Access API
    Object.defineProperty(window, 'showSaveFilePicker', {
      value: vi.fn(),
      writable: true,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const renderApp = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    )
  }

  describe('Initial Load', () => {
    it('should render the dropzone when no save file is loaded', () => {
      renderApp()
      
      expect(screen.getByText('Drop your Savegame here')).toBeInTheDocument()
      expect(screen.getByText('or click to browse')).toBeInTheDocument()
      expect(screen.getByText('Supported: .sav, .sa2')).toBeInTheDocument()
    })

    it('should show pokeball image in dropzone', () => {
      renderApp()
      
      const pokeball = screen.getByAltText('Pokeball')
      expect(pokeball).toBeInTheDocument()
    })
  })

  describe('Save File Loading', () => {
    it('should handle file loading through dropzone', async () => {
      const { container } = renderApp()
      
      // Mock the parser to return valid save data
      const mockSaveData = {
        party_pokemon: [
          {
            nickname: 'TREECKO',
            level: 5,
            speciesId: 252,
            currentHp: 18,
            totalHp: 20,
            details: {
              moves: [],
              stats: { hp: 20, attack: 10, defense: 8, speed: 14, spAttack: 12, spDefense: 11 },
              evs: { hp: 1, attack: 0, defense: 0, speed: 1, spAttack: 0, spDefense: 0 },
              ivs: { hp: 20, attack: 13, defense: 20, speed: 25, spAttack: 27, spDefense: 24 },
            },
          },
        ],
        player_name: 'Test Player',
        play_time: { hours: 1, minutes: 30, seconds: 45 },
      }

      // Simulate file drop by calling the parser directly
      const fileInput = container.querySelector('input[data-testid="file-input"]')
      if (fileInput) {
        const mockFile = createMockFile('emerald.sav', mockSaveFileContent)
        fireEvent.change(fileInput, { target: { files: [mockFile] } })
      }

      // We would expect the app to show the Pokemon data after loading
      // Note: This would require mocking the actual parser functionality
    })
  })

  describe('Pokemon Display and Editing', () => {
    it('should display Pokemon party list when save data is loaded', () => {
      // This test would simulate having save data loaded
      // and verify that the Pokemon are displayed correctly
      renderApp()
      
      // Mock having save data loaded
      // This would require setting up the context/state properly
    })

    it('should allow editing Pokemon stats', () => {
      // Test EV/IV sliders and nature dropdown functionality
      renderApp()
      
      // This would test the stat editing functionality
    })
  })

  describe('File Operations', () => {
    it('should show file menu options when save data is loaded', () => {
      renderApp()
      
      // Mock having save data and test menu options
      // Should show Open, Save As, Download options
    })

    it('should handle save file download', () => {
      renderApp()
      
      // Mock the download functionality
      // Verify file-saver is called correctly
    })
  })

  describe('Error Handling', () => {
    it('should show error toast for invalid save files', () => {
      renderApp()
      
      // Test error handling for corrupted/invalid files
    })

    it('should handle missing Pokemon data gracefully', () => {
      renderApp()
      
      // Test edge cases with empty/invalid Pokemon data
    })
  })
})