#!/usr/bin/env tsx
import { execSync } from 'node:child_process'

const composeFile = 'docker/docker-compose.yml'
const dockerfile = 'docker/Dockerfile'
const image = 'mgba-test-env:latest'
const remoteImage = 'ghcr.io/johndeved/pokemon-save-web/mgba-test-env:latest'
const container = 'mgba-test-environment'

function run(cmd: string, env?: NodeJS.ProcessEnv) {
  try {
    execSync(cmd, { stdio: 'inherit', env: env ? { ...process.env, ...env } : process.env })
  } catch {
    process.exit(1)
  }
}

function printHelp() {
  console.log('\n\x1b[1mPokémon Save Web: mGBA Docker CLI\x1b[0m\n')
  console.log('Usage: tsx docker/mgba-docker.ts <command> [args] [--game emerald|quetzal]\n')
  console.log('Commands:')
  console.log('  \x1b[36mstart\x1b[0m           Start the mGBA Docker container in the background')
  console.log('  \x1b[36mstart:build\x1b[0m     Build and start the container in the background')
  console.log('  \x1b[36mrun\x1b[0m             Start the container in the foreground (logs shown)')
  console.log('  \x1b[36mrun:build\x1b[0m       Build and start the container in the foreground')
  console.log('  \x1b[36mstop\x1b[0m            Stop the running container')
  console.log('  \x1b[36mbuild\x1b[0m           Build the Docker image locally')
  console.log('  \x1b[36mpull\x1b[0m            Pull the latest image from GitHub Container Registry')
  console.log('  \x1b[36mstatus\x1b[0m          Show container status')
  console.log('  \x1b[36mlogs\x1b[0m            Show container logs')
  console.log('  \x1b[36mexec <cmd..>\x1b[0m    Run a command inside the running container')
  console.log('  \x1b[36mshell\x1b[0m           Open a shell inside the running container')
  console.log('  \x1b[36mhelp\x1b[0m            Show this help message')
  console.log('\nOptions:')
  console.log('  --game emerald|quetzal   Select which ROM/savestate to load (default: emerald)')
  console.log('\nExamples:')
  console.log('  tsx docker/mgba-docker.ts start --game quetzal')
  console.log('  tsx docker/mgba-docker.ts exec ls /app/data --game emerald')
  console.log('  tsx docker/mgba-docker.ts shell --game quetzal')
  console.log('')
}

const [cmd, ...args] = process.argv.slice(2)
let game: string | undefined
const filteredArgs = [...args]
const gameIdx = filteredArgs.indexOf('--game')
if (gameIdx !== -1 && filteredArgs[gameIdx + 1]) {
  game = filteredArgs[gameIdx + 1]
  filteredArgs.splice(gameIdx, 2)
}

function withGameEnv(cmd: string): { cmd: string; env?: NodeJS.ProcessEnv } {
  if (!game) return { cmd }
  // For docker exec, inject -e GAME=... as a CLI flag
  if (cmd.startsWith('docker exec')) {
    const parts = cmd.split(' ')
    parts.splice(2, 0, '-e', `GAME=${game}`)
    return { cmd: parts.join(' ') }
  }
  // For docker compose, set env in Node.js process
  if (cmd.includes('docker compose')) {
    return { cmd, env: { GAME: game } }
  }
  // Fallback: set env for other commands
  return { cmd, env: { GAME: game } }
}

switch (cmd) {
  case 'start': {
    const { cmd: c, env } = withGameEnv(`docker compose -f ${composeFile} up -d`)
    run(c, env)
    break
  }
  case 'start:build': {
    const { cmd: c, env } = withGameEnv(`docker compose -f ${composeFile} up -d --build`)
    run(c, env)
    break
  }
  case 'run': {
    const { cmd: c, env } = withGameEnv(`docker compose -f ${composeFile} up`)
    run(c, env)
    break
  }
  case 'run:build': {
    const { cmd: c, env } = withGameEnv(`docker compose -f ${composeFile} up --build`)
    run(c, env)
    break
  }
  case 'stop':
    run(`docker compose -f ${composeFile} down`)
    break
  case 'build':
    run(`docker build -f ${dockerfile} -t ${image} .`)
    break
  case 'pull':
    run(`docker pull ${remoteImage}`)
    break
  case 'status':
    run(`docker compose -f ${composeFile} ps`)
    break
  case 'logs':
    run(`docker logs -f ${container}`)
    break
  case 'exec': {
    if (filteredArgs.length === 0) {
      console.error('Usage: tsx docker/mgba-docker.ts exec <command> [--game emerald|quetzal]')
      process.exit(1)
    }
    const { cmd: c, env } = withGameEnv(`docker exec -it ${container} ${filteredArgs.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')}`)
    run(c, env)
    break
  }
  case 'shell': {
    const { cmd: c, env } = withGameEnv(`docker exec -it ${container} bash`)
    run(c, env)
    break
  }
  case 'help':
  case undefined:
    printHelp()
    process.exit(0)
    break
  default:
    console.error(`Unknown command: ${cmd}\n`)
    printHelp()
    process.exit(1)
}
