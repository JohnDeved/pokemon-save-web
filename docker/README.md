# mGBA Docker Environment

This directory contains the Docker setup for running mGBA with Lua HTTP server support, used by Pokémon Save Web.

## Contents
- `Dockerfile` — Builds a container with mGBA, ROMs, and Lua support.
- `entrypoint.sh` — Entrypoint script that launches mGBA with the correct ROM, savestate, and Lua script.
- `docker-compose.yml` — Compose file for running the container with correct mounts and environment.
- `mgba-docker.ts` — Node.js CLI for managing the container (build, run, shell, etc).

## Usage

### Build and Run

```
npm run mgba -- run:build [--game emerald|quetzal]
```
- `--game` (optional): Selects which ROM/savestate to load. Defaults to `emerald` if not specified or if an unsupported value is given.

### Supported Commands
- `start`, `start:build`, `run`, `run:build`, `stop`, `build`, `pull`, `status`, `logs`, `exec`, `shell`, `help`

See all commands:
```
npm run mgba -- help
```

### Environment Variables
- `GAME`: Selects the ROM/savestate. Only `emerald` and `quetzal` are supported. Any other value falls back to `emerald`.

### Volumes
- Test data and Lua scripts are mounted into `/app/data`.
- ROMs and savestates are downloaded into `/app/roms` during image build.

### Example
```
npm run mgba -- run:build --game quetzal
```

## Using the Prebuilt Image
Since local build can take several minutes, you can use the prebuilt image
Prebuilt image from GitHub Container Registry (`ghcr.io/johndeved/pokemon-save-web/mgba-test-env:latest`)

## Troubleshooting
- If you see a warning about an unsupported `GAME` value, the container will use `emerald`.
- Ensure Docker is installed and running.
- For more details, see logs with:
  ```
  npm run mgba -- logs
  ```

## License
See repository root for license information.
