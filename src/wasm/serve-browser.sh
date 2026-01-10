#!/bin/bash

###############################################################################
# ELEX WASM RAN SDK - Browser Server Script
#
# This script starts a local HTTP server for testing the WASM module in browsers.
#
# Usage: ./serve-browser.sh [port] [directory]
#
# Examples:
#   ./serve-browser.sh           # Default: port 8080, pkg/ directory
#   ./serve-browser.sh 9000      # Custom port
#   ./serve-browser.sh 8080 pkg  # Custom directory
###############################################################################

set -e

# Default values
DEFAULT_PORT=8080
DEFAULT_DIR="pkg"
PORT=${1:-$DEFAULT_PORT}
DIR=${2:-$DEFAULT_DIR}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

###############################################################################
# Functions
###############################################################################

log() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  ${1}${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"
}

###############################################################################
# Check if directory exists
###############################################################################

if [ ! -d "$DIR" ]; then
    error "Directory '$DIR' not found!"
    echo ""
    echo "Please build the WASM package first:"
    echo "  ./build-optimized.sh"
    echo ""
    echo "Or for development:"
    echo "  wasm-pack build --dev --target web"
    exit 1
fi

###############################################################################
# Check if WASM files exist
###############################################################################

if [ ! -f "$DIR/elex_wasm_bg.wasm" ]; then
    warn "WASM binary not found in '$DIR'"
    echo ""
    echo "Build the package first:"
    echo "  ./build-optimized.sh"
    exit 1
fi

###############################################################################
# Check port availability
###############################################################################

if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    warn "Port $PORT is already in use!"
    echo ""
    read -p "Do you want to use a different port? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter port number: " NEW_PORT
        PORT=$NEW_PORT
    else
        log "Attempting to kill existing process..."
        lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
fi

###############################################################################
# Find available server
###############################################################################

SERVER=""
SERVER_CMD=""

# Try Python 3
if command -v python3 &> /dev/null; then
    SERVER="python3"
    SERVER_CMD="python3 -m http.server $PORT --directory $DIR"
    log "Using Python 3 HTTP server"
# Try Python 2
elif command -v python &> /dev/null; then
    SERVER="python"
    SERVER_CMD="python -m SimpleHTTPServer $PORT"
    log "Using Python 2 HTTP server"
# Try php
elif command -v php &> /dev/null; then
    SERVER="php"
    SERVER_CMD="php -S localhost:$PORT -t $DIR"
    log "Using PHP built-in server"
# Try node http-server
elif command -v npx &> /dev/null; then
    SERVER="npx"
    SERVER_CMD="npx http-server $DIR -p $PORT -c-1 --cors"
    log "Using Node.js http-server"
else
    error "No HTTP server found!"
    echo ""
    echo "Please install one of:"
    echo "  - Python 3: brew install python3"
    echo "  - Node.js: brew install node"
    echo ""
    echo "Or install a dedicated server:"
    echo "  npm install -g http-server"
    exit 1
fi

###############################################################################
# Display server information
###############################################################################

print_header "ELEX WASM RAN SDK - Browser Server"

# Show server info
echo -e "${GREEN}Server:${NC}         $SERVER"
echo -e "${GREEN}Port:${NC}           $PORT"
echo -e "${GREEN}Directory:${NC}      $DIR/"
echo -e "${GREEN}URL:${NC}            ${BLUE}http://localhost:$PORT${NC}"

# Show WASM file sizes
if [ -f "$DIR/elex_wasm_bg.wasm" ]; then
    WASM_SIZE=$(du -h "$DIR/elex_wasm_bg.wasm" | cut -f1)
    echo -e "${GREEN}WASM Binary:${NC}    $WASM_SIZE"
fi

if [ -f "$DIR/elex_wasm_bg.wasm.br" ]; then
    BROTLI_SIZE=$(du -h "$DIR/elex_wasm_bg.wasm.br" | cut -f1)
    echo -e "${GREEN}Brotli:${NC}         $BROTLI_SIZE ${GREEN}(compressed)${NC}"
fi

echo ""
echo -e "${CYAN}Open your browser to:${NC} ${BLUE}http://localhost:$PORT${NC}"
echo ""

###############################################################################
# Start server
###############################################################################

log "Starting server..."
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}\n"

# Trap Ctrl+C
trap 'echo -e "\n${GREEN}Server stopped${NC}"; exit 0' INT

# Start server
eval $SERVER_CMD
