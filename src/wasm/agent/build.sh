#!/bin/bash
set -e

echo "==================================="
echo "Building WASM Agent Module with SIMD"
echo "==================================="
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "Script directory: $SCRIPT_DIR"
echo "Project root: $PROJECT_ROOT"
echo ""

# Check for wasm-pack
if ! command -v wasm-pack &> /dev/null; then
    echo "ERROR: wasm-pack not found. Install with:"
    echo "  curl https://rustwasm.org/wasm-pack/installer/init.sh -sSf | sh"
    exit 1
fi

# Check for wasm-opt
if ! command -v wasm-opt &> /dev/null; then
    echo "WARNING: wasm-opt not found. Skipping WASM optimization."
    echo "Install with: npm install -g wasm-opt"
fi

echo "Building WASM module..."
echo "Target: wasm32-unknown-unknown"
echo "Features: SIMD128"
echo ""

# Build WASM with SIMD enabled
RUSTFLAGS="-C target-feature=+simd128 -C llvm-args=-mcpu=generic" \
wasm-pack build \
  --target web \
  --out-dir "$PROJECT_ROOT/dist/wasm/agent" \
  --release \
  "$SCRIPT_DIR" 2>&1

BUILD_EXIT_CODE=$?

# wasm-opt may fail due to SIMD features, but the WASM file is still valid
# Check if the WASM file was created before wasm-opt stage
if [ ! -f "$PROJECT_ROOT/dist/wasm/agent/edge_agent_wasm_bg.wasm" ] && [ $BUILD_EXIT_CODE -ne 0 ]; then
    # Try to find the unoptimized WASM file
    if [ -f "$SCRIPT_DIR/../../target/wasm32-unknown-unknown/release/edge_agent_wasm.wasm" ]; then
        echo "Copying unoptimized WASM module..."
        mkdir -p "$PROJECT_ROOT/dist/wasm/agent"
        cp "$SCRIPT_DIR/../../target/wasm32-unknown-unknown/release/edge_agent_wasm.wasm" \
           "$PROJECT_ROOT/dist/wasm/agent/edge_agent_wasm_bg.wasm"
        BUILD_EXIT_CODE=0
    fi
fi

if [ $BUILD_EXIT_CODE -ne 0 ]; then
    echo ""
    echo "ERROR: WASM build failed with exit code $BUILD_EXIT_CODE"
    exit $BUILD_EXIT_CODE
fi

echo ""
echo "WASM build complete!"
echo ""

# Check output file
WASM_FILE="$PROJECT_ROOT/dist/wasm/agent/edge_agent_wasm_bg.wasm"
if [ -f "$WASM_FILE" ]; then
    FILE_SIZE=$(du -h "$WASM_FILE" | cut -f1)
    echo "✓ WASM module created: $WASM_FILE"
    echo "  Size: $FILE_SIZE"
else
    echo "ERROR: WASM file not found at $WASM_FILE"
    exit 1
fi

# Optimize with wasm-opt if available
if command -v wasm-opt &> /dev/null; then
    echo ""
    echo "Optimizing WASM with wasm-opt..."
    wasm-opt -Oz \
      "$WASM_FILE" \
      -o "$WASM_FILE.opt"

    if [ -f "$WASM_FILE.opt" ]; then
        ORIG_SIZE=$(du -h "$WASM_FILE" | cut -f1)
        OPT_SIZE=$(du -h "$WASM_FILE.opt" | cut -f1)
        mv "$WASM_FILE.opt" "$WASM_FILE"
        echo "✓ Optimization complete"
        echo "  Original: $ORIG_SIZE → Optimized: $OPT_SIZE"
    fi
fi

echo ""
echo "==================================="
echo "SIMD Features in WASM:"
echo "==================================="

# Check if SIMD instructions are in the WASM
if command -v wasm-objdump &> /dev/null; then
    echo ""
    echo "SIMD Instructions Found:"
    wasm-objdump -x "$WASM_FILE" | grep -i "simd\|v128" | head -20
else
    echo "Install wabt tools to verify SIMD instructions:"
    echo "  npm install -g wabt"
fi

echo ""
echo "==================================="
echo "Build Verification"
echo "==================================="
echo ""
echo "To verify the WASM module:"
echo "  1. Check size (~400-600KB): ls -lh $WASM_FILE"
echo "  2. Run tests: npm test"
echo "  3. Benchmark: npm run benchmark:wasm"
echo ""
echo "==================================="
echo "Build Success! ✓"
echo "==================================="
