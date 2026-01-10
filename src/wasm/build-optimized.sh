#!/bin/bash
# ELEX WASM RAN SDK - Optimized Build Script
# Phase 7 Performance: <500KB binary target with Brotli compression

set -e

echo "======================================"
echo "ELEX WASM RAN SDK - Optimized Build"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WASM_CRATE="elex-wasm"
TARGET_DIR="target/wasm32-unknown-unknown/release"
OUTPUT_DIR="pkg"
FINAL_WASM="elex_wasm_bg.wasm"

echo -e "${BLUE}Step 1: Building with LTO and optimizations...${NC}"
cargo build --release --target wasm32-unknown-unknown -p ${WASM_CRATE}

echo -e "${BLUE}Step 2: Creating WASM bindings...${NC}"
wasm-bindgen ${TARGET_DIR}/${WASM_CRATE}.wasm \
    --out-dir ${OUTPUT_DIR} \
    --target web \
    --no-typescript \
    --omit-default-module-path

echo -e "${BLUE}Step 3: Running wasm-opt -O3 optimizations...${NC}"

# Check if wasm-opt is available
if command -v wasm-opt &> /dev/null; then
    # Backup original
    cp ${OUTPUT_DIR}/${WASM_CRATE}_bg.wasm ${OUTPUT_DIR}/${WASM_CRATE}_bg_original.wasm

    # Run wasm-opt with -O3 (aggressive optimization)
    wasm-opt -O3 \
        -g \
        --enable-bulk-memory \
        --enable-sign-ext \
        --enable-nontrapping-fptoint \
        --enable-multivalue \
        --enable-simd \
        -o ${OUTPUT_DIR}/${WASM_CRATE}_bg_opt.wasm \
        ${OUTPUT_DIR}/${WASM_CRATE}_bg.wasm

    # Replace original with optimized
    mv ${OUTPUT_DIR}/${WASM_CRATE}_bg_opt.wasm ${OUTPUT_DIR}/${WASM_CRATE}_bg.wasm

    # Show size reduction
    ORIGINAL_SIZE=$(wc -c < ${OUTPUT_DIR}/${WASM_CRATE}_bg_original.wasm)
    OPTIMIZED_SIZE=$(wc -c < ${OUTPUT_DIR}/${WASM_CRATE}_bg.wasm)
    REDUCTION=$((ORIGINAL_SIZE - OPTIMIZED_SIZE))
    PERCENT=$((REDUCTION * 100 / ORIGINAL_SIZE))

    echo -e "${GREEN}wasm-opt: ${REDUCTION} bytes reduction (${PERCENT}%)${NC}"
    echo -e "  Before: ${ORIGINAL_SIZE} bytes"
    echo -e "  After: ${OPTIMIZED_SIZE} bytes"
else
    echo -e "${YELLOW}wasm-opt not found - skipping wasm-opt optimization${NC}"
    echo -e "${YELLOW}Install with: apt install binaryen (Linux) or brew install binaryen (macOS)${NC}"
fi

echo -e "${BLUE}Step 4: Applying Brotli compression...${NC}"

# Check if brotli is available
if command -v brotli &> /dev/null; then
    # Compress with brotli (best compression, quality 11)
    brotli -q 11 -o ${OUTPUT_DIR}/${WASM_CRATE}_bg.wasm.br ${OUTPUT_DIR}/${WASM_CRATE}_bg.wasm

    # Show compression stats
    UNCOMPRESSED_SIZE=$(wc -c < ${OUTPUT_DIR}/${WASM_CRATE}_bg.wasm)
    COMPRESSED_SIZE=$(wc -c < ${OUTPUT_DIR}/${WASM_CRATE}_bg.wasm.br)
    SAVED=$((UNCOMPRESSED_SIZE - COMPRESSED_SIZE))
    PERCENT=$((SAVED * 100 / UNCOMPRESSED_SIZE))

    echo -e "${GREEN}Brotli: ${SAVED} bytes saved (${PERCENT}%)${NC}"
    echo -e "  Uncompressed: ${UNCOMPRESSED_SIZE} bytes"
    echo -e "  Compressed: ${COMPRESSED_SIZE} bytes"

    # Check if we meet the <500KB target
    if [ ${COMPRESSED_SIZE} -lt 512000 ]; then
        echo -e "${GREEN}Target met: Compressed size <500KB!${NC}"
    else
        echo -e "${YELLOW}Warning: Compressed size exceeds 500KB target${NC}"
    fi
else
    echo -e "${YELLOW}brotli not found - skipping Brotli compression${NC}"
    echo -e "${YELLOW}Install with: apt install brotli (Linux) or brew install brotli (macOS)${NC}"
fi

echo -e "${BLUE}Step 5: Generating size report...${NC}"

# Generate detailed size breakdown
if command -v wasm-objdump &> /dev/null; then
    echo ""
    echo "=== WASM Section Sizes ==="
    wasm-objdump -h ${OUTPUT_DIR}/${WASM_CRATE}_bg.wasm | tail -n +5
fi

echo ""
echo -e "${GREEN}======================================"
echo -e "Build Complete!"
echo -e "======================================${NC}"
echo -e "Output directory: ${OUTPUT_DIR}/"
echo -e "Main files:"
echo -e "  - ${WASM_CRATE}_bg.wasm (optimized)"
echo -e "  - ${WASM_CRATE}_bg.wasm.br (Brotli compressed, if available)"
echo -e "  - ${WASM_CRATE}.js (JavaScript bindings)"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "1. Run benchmarks: cargo bench --package elex-simd"
echo -e "2. Test in browser: python3 -m http.server -d ${OUTPUT_DIR}"
echo ""
