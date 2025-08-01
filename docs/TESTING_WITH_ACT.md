# Testing with nektos/act

This repository includes a comprehensive test workflow that can be run locally using [nektos/act](https://github.com/nektos/act).

## Prerequisites

1. **Docker** - Required for running containers
2. **nektos/act** - Install from [releases](https://github.com/nektos/act/releases)

```bash
# Install act (Linux)
curl -L https://github.com/nektos/act/releases/latest/download/act_Linux_x86_64.tar.gz | tar xz
sudo mv act /usr/local/bin/

# Install act (macOS)
brew install act
```

## Running Tests Locally

### Run All Tests
```bash
act -W .github/workflows/comprehensive-tests.yml
```

### Run Specific Test Types
```bash
# Lint only
act -W .github/workflows/comprehensive-tests.yml -j comprehensive-test --input test_type=lint

# Unit tests only  
act -W .github/workflows/comprehensive-tests.yml -j comprehensive-test --input test_type=unit

# Lua/Docker tests only
act -W .github/workflows/comprehensive-tests.yml -j comprehensive-test --input test_type=lua
```

### Run Individual Workflows
```bash
# Run lint workflow
act -W .github/workflows/lint.yml

# Run unit tests workflow  
act -W .github/workflows/test.yml

# Run Lua tests workflow
act -W .github/workflows/lua-tests.yml
```

## Configuration

The repository includes `.actrc` configuration file with optimal settings for local testing. You can override these by creating a `.env.secrets` file:

```bash
cp .env.secrets.example .env.secrets
# Edit .env.secrets with your settings
```

## Docker Requirements

The comprehensive test workflow requires Docker for:
- Building/pulling mGBA test environment
- Running Lua HTTP server integration tests
- Testing WebSocket watch mode functionality

The workflow will automatically:
1. Try to pull pre-built mGBA image from GitHub Container Registry
2. Fall back to building from source if image unavailable
3. Start container with proper port mapping (7102)
4. Run integration tests against the container
5. Clean up containers after testing

## Troubleshooting

### Docker Permission Issues
```bash
# Add user to docker group
sudo usermod -aG docker $USER
# Log out and back in, or run:
newgrp docker
```

### Container Build Failures
```bash
# Pull latest base images
docker pull ubuntu:20.04
docker pull node:20

# Clean Docker cache
docker system prune -f
```

### Act-specific Issues
```bash
# Use larger runner image for complex builds
act -P ubuntu-latest=catthehacker/ubuntu:full-20.04

# Enable verbose logging
act -v

# Skip Docker-in-Docker if having issues
act --container-daemon-socket=""
```

## Example Output

```bash
$ act -W .github/workflows/comprehensive-tests.yml

[Comprehensive Tests/comprehensive-test] 🚀  Start image=catthehacker/ubuntu:act-20.04
[Comprehensive Tests/comprehensive-test]   🐳  docker pull image=catthehacker/ubuntu:act-20.04:latest platform= username= forcePull=false
[Comprehensive Tests/comprehensive-test]   🐳  docker create image=catthehacker/ubuntu:act-20.04:latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[]
[Comprehensive Tests/comprehensive-test]   🐳  docker run image=catthehacker/ubuntu:act-20.04:latest platform= entrypoint=["tail" "-f" "/dev/null"] cmd=[]
[Comprehensive Tests/comprehensive-test] ⭐ Run Main Checkout repository
[Comprehensive Tests/comprehensive-test] ⭐ Run Main Setup Node.js  
[Comprehensive Tests/comprehensive-test] ⭐ Run Main Install dependencies
[Comprehensive Tests/comprehensive-test] ⭐ Run Main Run linting
[Comprehensive Tests/comprehensive-test] ⭐ Run Main Run build test
[Comprehensive Tests/comprehensive-test] ⭐ Run Main Run unit and integration tests
[Comprehensive Tests/comprehensive-test] ⭐ Run Main Start mGBA container for testing
[Comprehensive Tests/comprehensive-test] ⭐ Run Main Run Lua HTTP Server integration tests
[Comprehensive Tests/comprehensive-test] ⭐ Run Main Test WebSocket watch mode functionality
[Comprehensive Tests/comprehensive-test] 🏁  Job succeeded
```