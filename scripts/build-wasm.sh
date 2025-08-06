#!/bin/bash

# Build Go WASM Parser
# This script builds the Go parser into WASM and copies necessary files

set -e

echo "Building Go WASM parser..."

# Build WASM module
GOOS=js GOARCH=wasm go build -o public/parser.wasm ./parser

# Copy WASM exec helper to public directory for web access  
cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" public/

echo "WASM build complete:"
echo "  - public/parser.wasm ($(du -h public/parser.wasm | cut -f1))"
echo "  - public/wasm_exec.js"

# Build regular CLI version for development
go build -o bin/parser-go ./parser

echo "CLI build complete:"
echo "  - bin/parser-go"