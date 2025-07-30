#!/bin/bash

# Pokemon Save Web Development Environment Setup Script
# This script installs all dependencies required for development and testing

set -e

echo "🚀 Setting up Pokemon Save Web development environment..."

# Update package lists
echo "📦 Updating package lists..."
sudo apt-get update

# Install Lua and development tools
echo "🌙 Installing Lua 5.4 and development tools..."
sudo apt-get install -y \
    lua5.4 \
    lua5.4-dev \
    luarocks \
    curl \
    wget \
    git \
    build-essential

# Verify Lua installation
echo "✅ Verifying Lua installation..."
lua5.4 -v

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Install Playwright browsers
echo "🎭 Installing Playwright browsers..."
npx playwright install --with-deps

# Make scripts executable
echo "🔧 Setting up executable permissions..."
chmod +x bin/pokemon-save-parser
chmod +x bin/mgba-docker

# Test mGBA Docker setup
echo "🐋 Testing mGBA Docker setup..."
npm run mgba help

echo "✅ Development environment setup complete!"
echo ""
echo "🔧 Available commands:"
echo "  npm run test           - Run core tests (parser, website)"
echo "  npm run test:mgba      - Run all tests including mGBA WebSocket tests"
echo "  npm run test:e2e       - Run end-to-end tests"
echo "  npm run mgba start     - Start mGBA Docker environment"
echo "  npm run parse --help   - CLI parser help"
echo ""
echo "🌐 To start development:"
echo "  npm run dev            - Start development server"
echo "  npm run mgba start     - Start mGBA for WebSocket testing"
echo ""
echo "📚 For more information, see README.md"