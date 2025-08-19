/**
 * Test setup for website component tests
 * Configures testing environment for React components
 */

import '@testing-library/jest-dom'
import React from 'react'
import { vi } from 'vitest'

// Make React available globally for JSX transform
global.React = React

// Mock ResizeObserver which might be used by components
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver which might be used by components
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock matchMedia which is used by responsive components (browser environment only)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  // Mock PointerEvent for touch/pointer interactions
  if (typeof PointerEvent === 'undefined') {
    global.PointerEvent = class PointerEvent extends Event {
      constructor(type: string, options: EventInit = {}) {
        super(type, options)
      }
    } as unknown as typeof Event
  }

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  }
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  })

  // Mock sessionStorage
  const sessionStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  }
  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock,
  })
}

// Suppress console warnings during tests unless explicitly needed
const originalConsoleWarn = console.warn

// These functions are available globally in vitest
declare global {
  function beforeEach(fn: () => void): void
  function afterEach(fn: () => void): void
}

beforeEach(() => {
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && (args[0].includes('ReactDOM.render is no longer supported') || args[0].includes('Warning: Function components cannot be given refs'))) {
      return
    }
    originalConsoleWarn(...args)
  }
})

afterEach(() => {
  console.warn = originalConsoleWarn
})
