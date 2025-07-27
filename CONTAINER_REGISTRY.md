# Container Registry Documentation

This document explains how the mGBA Docker image is built, published to GitHub Container Registry (GHCR), and used in development and CI/CD.

## Overview

The repository uses a Docker image that contains a pre-compiled mGBA emulator with Lua support for HTTP server functionality. To avoid rebuilding mGBA from source (which takes several minutes), the image is pre-built and published to GitHub Container Registry (GHCR).

## Image Information

- **Registry**: `ghcr.io`
- **Image Name**: `ghcr.io/johndeved/pokemon-save-web/mgba-test-env`
- **Available Tags**: `latest`, `main`, version tags, and commit SHA tags

## Using Pre-built Images

### Local Development

#### Option 1: Use pre-built image (recommended)
```bash
# Pull the latest image
npm run mgba:pull

# Start with pre-built image
npm run mgba:start:prebuilt

# Or run in foreground
npm run mgba:run:prebuilt
```

#### Option 2: Build from source (slower)
```bash
# Build and start (traditional method)
npm run mgba:start

# Or run in foreground
npm run mgba:run
```

### Docker Commands

```bash
# Pull the latest image
docker pull ghcr.io/johndeved/pokemon-save-web/mgba-test-env:latest

# Run the image directly
docker run -d --name mgba-test \
  -p 7102:7102 \
  -e DISPLAY=:99 \
  -e QT_QPA_PLATFORM=xcb \
  ghcr.io/johndeved/pokemon-save-web/mgba-test-env:latest

# Stop and clean up
docker stop mgba-test
docker rm mgba-test
```

### Docker Compose

The `docker-compose.yml` supports both pre-built and locally built images:

```bash
# Use pre-built image
MGBA_IMAGE=ghcr.io/johndeved/pokemon-save-web/mgba-test-env:latest docker compose -f docker/docker-compose.yml up

# Use local build (fallback)
docker compose -f docker/docker-compose.yml up --build
```

## Image Publishing

### Automatic Publishing

Images are automatically built and published to GHCR via GitHub Actions when:

1. **Push to main branch** - Tagged as `latest`
2. **Pull requests** - Tagged as `pr-{number}` (test builds, not published)
3. **Releases** - Tagged with version numbers
4. **Manual trigger** - Via GitHub Actions UI

### Publishing Workflow

The `.github/workflows/docker-publish.yml` workflow:

1. Builds the Docker image using GitHub Actions runners
2. Authenticates with GHCR using `GITHUB_TOKEN`
3. Tags the image with appropriate tags
4. Pushes to `ghcr.io/johndeved/pokemon-save-web/mgba-test-env`
5. Uses Docker layer caching for faster builds

### Image Tags

| Trigger | Tag Example | Description |
|---------|-------------|-------------|
| Main branch push | `latest` | Latest stable build |
| Main branch push | `main-abc1234` | Main branch with commit SHA |
| Pull request | `pr-123` | PR test build |
| Release v1.2.3 | `1.2.3`, `1.2` | Semantic version tags |
| Any branch | `feat-abc1234` | Branch name with commit SHA |

## CI/CD Integration

### Lua Tests Workflow

The `lua-tests.yml` workflow now:

1. **Attempts to pull** pre-built image from GHCR
2. **Falls back** to building from source if image unavailable
3. **Uses the image** to run mGBA HTTP server tests
4. **Provides faster CI** when pre-built images are available

### Fallback Strategy

If the pre-built image is not available:
- CI workflows automatically fall back to building from source
- Local development can use `npm run mgba:start` (traditional method)
- No functionality is lost - it just takes longer

## Authentication

### For CI/CD
- Uses `GITHUB_TOKEN` (automatically provided)
- No additional secrets required
- Works for both public and private repositories

### For Local Development
```bash
# Authenticate with GHCR (one-time setup)
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Or use GitHub CLI
gh auth token | docker login ghcr.io -u USERNAME --password-stdin
```

## Troubleshooting

### Image Pull Failures

If you cannot pull the pre-built image:

1. **Check authentication**:
   ```bash
   docker login ghcr.io
   ```

2. **Try alternative tags**:
   ```bash
   docker pull ghcr.io/johndeved/pokemon-save-web/mgba-test-env:main
   ```

3. **Fall back to local build**:
   ```bash
   npm run mgba:start  # Uses --build flag
   ```

### CI/CD Issues

If CI fails to pull the image:
- Check if the image exists in GHCR packages
- Verify the workflow has `packages: write` permission
- The workflow will automatically fall back to building from source

### Local Development Issues

If the pre-built image doesn't work locally:
```bash
# Remove any cached images
docker rmi ghcr.io/johndeved/pokemon-save-web/mgba-test-env:latest

# Use traditional build method
npm run mgba:start
```

## Image Contents

The mGBA Docker image includes:

- **Ubuntu 22.04** base
- **mGBA emulator** compiled from source with:
  - Qt5 support for GUI
  - Lua 5.4 for scripting
  - HTTP server capabilities
- **Pokemon Emerald ROM** (downloaded during build)
- **Test save state** for automated testing
- **Lua HTTP server script** for API access

## Benefits

- **Faster CI/CD**: No need to compile mGBA from source (saves 3-5 minutes)
- **Consistent environment**: Same image used in CI and local development
- **Reliable builds**: Pre-tested images reduce build failures
- **Bandwidth efficiency**: Image layers are cached and reused
- **Fallback support**: Still works if GHCR is unavailable

## Maintenance

### Updating the Image

When mGBA source or dependencies need updates:

1. Update the `docker/Dockerfile`
2. Push changes to trigger automatic rebuild
3. New image will be published to GHCR
4. CI/CD will use the new image automatically

### Image Cleanup

Old images can be cleaned up in GitHub:
- Go to repository → Packages
- Select `mgba-test-env`
- Delete old versions as needed

## Security

- Images are built in GitHub's secure environment
- No secrets or credentials are embedded in images
- GHCR access is controlled by GitHub repository permissions
- Image contents are transparently built from this repository's Dockerfile