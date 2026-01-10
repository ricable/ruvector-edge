#!/bin/bash
# ELEX WASM RAN SDK - Performance Benchmark Suite (Phase 7)
#
# Targets:
# - WASM binary <500KB (with Brotli compression)
# - HNSW search <1ms P95 latency
# - SIMD 3-8x speedup
# - 500MB memory budget enforcement
# - Full query cycle <500ms

set -e

echo "======================================"
echo "ELEX WASM RAN SDK - Performance Benchmarks"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BENCHMARKS=(
    "hnsw_benchmark"
    "simd_benchmark"
    "qlearning_benchmark"
    "cache_benchmark"
    "memory_benchmark"
)

# Phase 7 Performance Targets
TARGET_WASM_SIZE_KB=500
TARGET_HNSW_P95_MS=1
TARGET_SIMD_SPEEDUP=3
TARGET_MEMORY_MB=500
TARGET_QUERY_CYCLE_MS=500

echo ""
echo -e "${BLUE}Phase 7 Performance Targets:${NC}"
echo "  1. WASM Binary: <${TARGET_WASM_SIZE_KB}KB (with Brotli)"
echo "  2. HNSW Search: <${TARGET_HNSW_P95_MS}ms P95 latency"
echo "  3. SIMD Speedup: ${TARGET_SIMD_SPEEDUP}x-8x"
echo "  4. Memory Budget: ${TARGET_MEMORY_MB}MB"
echo "  5. Query Cycle: <${TARGET_QUERY_CYCLE_MS}ms"
echo ""

# Step 1: Build optimized WASM
echo -e "${BLUE}Step 1: Building optimized WASM...${NC}"
./build-optimized.sh

# Check if build succeeded
if [ ! -f "pkg/elex_wasm_bg.wasm" ]; then
    echo -e "${RED}Build failed - WASM file not found${NC}"
    exit 1
fi

# Check WASM binary size
WASM_SIZE_KB=$(wc -c < pkg/elex_wasm_bg.wasm / 1024)
echo -e "  WASM binary: ${WASM_SIZE_KB}KB"

if [ -f "pkg/elex_wasm_bg.wasm.br" ]; then
    WASM_BR_SIZE_KB=$(wc -c < pkg/elex_wasm_bg.wasm.br / 1024)
    echo -e "  WASM + Brotli: ${WASM_BR_SIZE_KB}KB"

    if [ ${WASM_BR_SIZE_KB} -lt ${TARGET_WASM_SIZE_KB} ]; then
        echo -e "${GREEN}Target met: Binary size <${TARGET_WASM_SIZE_KB}KB${NC}"
    else
        echo -e "${YELLOW}Warning: Binary size exceeds ${TARGET_WASM_SIZE_KB}KB target${NC}"
    fi
fi

echo ""

# Step 2: Run HNSW benchmarks
echo -e "${BLUE}Step 2: Running HNSW benchmarks...${NC}"
cargo bench --bench hnsw_benchmark -- --sample-size 100 --output-format bencher | tee hnsw_results.txt

echo ""
echo -e "${BLUE}Step 3: Running SIMD benchmarks...${NC}"
cargo bench --bench simd_benchmark -- --sample-size 100 --output-format bencher | tee simd_results.txt

echo ""
echo -e "${BLUE}Step 4: Running Q-learning benchmarks...${NC}"
cargo bench --bench qlearning_benchmark -- --sample-size 100 --output-format bencher | tee qlearning_results.txt

echo ""
echo -e "${BLUE}Step 5: Running cache benchmarks...${NC}"
cargo bench --bench cache_benchmark -- --sample-size 100 --output-format bencher | tee cache_results.txt

echo ""
echo -e "${BLUE}Step 6: Running memory benchmarks...${NC}"
cargo bench --bench memory_benchmark -- --sample-size 100 --output-format bencher | tee memory_results.txt

# Step 7: Generate performance report
echo ""
echo -e "${BLUE}Step 7: Generating performance report...${NC}"

cat > PHASE7_PERFORMANCE_REPORT.md << 'EOF'
# Phase 7 Performance Report

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| WASM Binary Size | <500KB (Brotli) | ⏳ |
| HNSW Search P95 | <1ms | ⏳ |
| SIMD Speedup | 3-8x | ⏳ |
| Memory Budget | 500MB | ⏳ |
| Query Cycle | <500ms | ⏳ |

## Benchmark Results

### HNSW Performance
EOF

# Extract key metrics from benchmark results
echo "  Extracting HNSW P95 latency..."
echo "  Check hnsw_results.txt for detailed results"

echo "" >> PHASE7_PERFORMANCE_REPORT.md
echo "### SIMD Performance" >> PHASE7_PERFORMANCE_REPORT.md
echo "  Check simd_results.txt for detailed results" >> PHASE7_PERFORMANCE_REPORT.md

echo "" >> PHASE7_PERFORMANCE_REPORT.md
echo "### Q-Learning Performance" >> PHASE7_PERFORMANCE_REPORT.md
echo "  Check qlearning_results.txt for detailed results" >> PHASE7_PERFORMANCE_REPORT.md

echo "" >> PHASE7_PERFORMANCE_REPORT.md
echo "### Cache Performance" >> PHASE7_PERFORMANCE_REPORT.md
echo "  Check cache_results.txt for detailed results" >> PHASE7_PERFORMANCE_REPORT.md

echo "" >> PHASE7_PERFORMANCE_REPORT.md
echo "### Memory Management" >> PHASE7_PERFORMANCE_REPORT.md
echo "  Check memory_results.txt for detailed results" >> PHASE7_PERFORMANCE_REPORT.md

echo ""
echo -e "${GREEN}======================================"
echo -e "Benchmark Suite Complete!"
echo -e "======================================${NC}"
echo ""
echo "Results saved to:"
echo "  - hnsw_results.txt"
echo "  - simd_results.txt"
echo "  - qlearning_results.txt"
echo "  - cache_results.txt"
echo "  - memory_results.txt"
echo "  - PHASE7_PERFORMANCE_REPORT.md"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Review benchmark results"
echo "  2. Check HTML reports in target/criterion/"
echo "  3. Optimize based on findings"
echo ""
echo -e "${YELLOW}To view HTML reports:${NC}"
echo "  open target/criterion/report/index.html"
echo ""
