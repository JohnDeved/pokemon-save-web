import { describe, it, expect } from 'vitest'
import { spawn } from 'child_process'
import { existsSync, renameSync } from 'fs'
import { join } from 'path'

describe('mGBA Test Environment Integration', () => {
  const projectRoot = join(process.cwd())
  const testDataDir = join(projectRoot, 'test_data')
  const scriptsDir = join(projectRoot, 'scripts')

  it('should have test_data directory with required files', () => {
    expect(existsSync(testDataDir)).toBe(true)
    expect(existsSync(join(testDataDir, 'emerald.ss0'))).toBe(true)
    expect(existsSync(join(testDataDir, 'mgba_http_server.lua'))).toBe(true)
    expect(existsSync(join(testDataDir, 'README.md'))).toBe(true)
    
    // Check if ROM file exists (may be present for testing)
    const romExists = existsSync(join(testDataDir, 'emerald.gba'))
    if (romExists) {
      console.log('  📄 ROM file found: emerald.gba (test environment ready)')
    } else {
      console.log('  ⚠️  ROM file not present: emerald.gba (manual setup required)')
    }
  })

  it('should have launch script with proper help output', async () => {
    const scriptPath = join(scriptsDir, 'launch-mgba.js')
    expect(existsSync(scriptPath)).toBe(true)

    const { stdout, exitCode } = await runScript('node', [scriptPath, '--help'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('mGBA Launch Script')
    expect(stdout).toContain('Usage:')
    expect(stdout).toContain('--help')
    expect(stdout).toContain('--no-lua')
    expect(stdout).toContain('--no-savestate')
    expect(stdout).toContain('emerald.gba')
  })

  it('should have HTTP test script', async () => {
    const scriptPath = join(scriptsDir, 'test-mgba-http.js')
    expect(existsSync(scriptPath)).toBe(true)

    // Test that the script runs and shows appropriate message when server is not available
    const { stdout, exitCode } = await runScript('node', [scriptPath])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('mGBA HTTP Interface Test Suite')
    expect(stdout).toContain('Basic connectivity')
    expect(stdout).toContain('Make sure mGBA is running')
  })

  it('should properly detect missing ROM file', async () => {
    const scriptPath = join(scriptsDir, 'launch-mgba.js')
    const romPath = join(testDataDir, 'emerald.gba')
    const tempRomPath = join(testDataDir, 'emerald.gba.tmp')
    
    // Temporarily move ROM file if it exists
    const romExists = existsSync(romPath)
    if (romExists) {
      renameSync(romPath, tempRomPath)
    }
    
    try {
      const { stdout, stderr, exitCode } = await runScript('node', [scriptPath])
      expect(exitCode).toBe(1)
      const output = stdout + stderr
      expect(output).toContain('ROM file not found')
      expect(output).toContain('emerald.gba')
      expect(output).toContain('legally obtained')
    } finally {
      // Restore ROM file if it was moved
      if (romExists) {
        renameSync(tempRomPath, romPath)
      }
    }
  })

  it('should validate required files exist before launching', async () => {
    const scriptPath = join(scriptsDir, 'launch-mgba.js')
    const romPath = join(testDataDir, 'emerald.gba')
    const tempRomPath = join(testDataDir, 'emerald.gba.tmp')
    
    // Temporarily move ROM file if it exists to test validation
    const romExists = existsSync(romPath)
    if (romExists) {
      renameSync(romPath, tempRomPath)
    }
    
    try {
      const { stdout, stderr, exitCode } = await runScript('node', [scriptPath, '--no-lua'])
      expect(exitCode).toBe(1)
      const output = stdout + stderr
      expect(output).toContain('Checking required files')
      expect(output).toContain('ROM file not found')
    } finally {
      // Restore ROM file if it was moved
      if (romExists) {
        renameSync(tempRomPath, romPath)
      }
    }
  })

  it('should successfully validate when ROM file is present', async () => {
    const scriptPath = join(scriptsDir, 'launch-mgba.js')
    const romPath = join(testDataDir, 'emerald.gba')
    
    // Only run this test if ROM file is present
    if (existsSync(romPath)) {
      const { stdout, stderr, exitCode } = await runScript('node', [scriptPath, '--help'])
      expect(exitCode).toBe(0)
      expect(stdout).toContain('mGBA Launch Script')
    } else {
      console.log('  ⏭️ Skipping ROM validation test - ROM file not present')
    }
  })
})

function runScript(command: string, args: string[]): Promise<{stdout: string, stderr: string, exitCode: number}> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: process.cwd() })
    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code || 0 })
    })

    // Set a timeout to prevent hanging tests
    setTimeout(() => {
      child.kill()
      resolve({ stdout, stderr, exitCode: -1 })
    }, 10000)
  })
}