#!/bin/bash
set -e

# ELEX WASM Build Script
# Builds the ELEX WASM module for web and Node.js targets

echo "🔨 Building ELEX WASM module..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
WASM_PACK_VERSION="0.12.0"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
WASM_DIR="$PROJECT_ROOT/src/wasm/crates/elex-wasm"
PKG_DIR="$WASM_DIR/pkg"

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v rustup &> /dev/null; then
    echo -e "${RED}Error: rustup not found${NC}"
    echo "Install from https://rustup.rs/"
    exit 1
fi

if ! rustup target list --installed | grep -q "wasm32-unknown-unknown"; then
    echo "📦 Installing wasm32-unknown-unknown target..."
    rustup target add wasm32-unknown-unknown
fi

if ! command -v wasm-pack &> /dev/null; then
    echo "📦 Installing wasm-pack..."
    cargo install wasm-pack --version "$WASM_PACK_VERSION"
fi

if ! command -v wasm-opt &> /dev/null; then
    echo -e "${YELLOW}Warning: wasm-opt not found${NC}"
    echo "Install Binaryen for WASM optimization: https://github.com/WebAssembly/binaryen"
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf "$PKG_DIR"

# Build for web target
echo "🌐 Building for web target..."
cd "$WASM_DIR"
wasm-pack build --dev --target web

# Build for Node.js target
echo "📦 Building for Node.js target..."
wasm-pack build --dev --target nodejs

# Build for bundlers
echo "📚 Building for bundlers..."
wasm-pack build --dev --target bundler

# Optimize WASM (if wasm-opt is available)
if command -v wasm-opt &> /dev/null; then
    echo "⚡ Optimizing WASM binary..."
    for wasm_file in "$PKG_DIR"/*.wasm; do
        if [ -f "$wasm_file" ]; then
            echo "  Optimizing $(basename "$wasm_file")..."
            wasm-opt -O3 -o "$wasm_file.opt" "$wasm_file"
            mv "$wasm_file.opt" "$wasm_file"
        fi
    done
fi

# Copy TypeScript definitions
echo "📝 Copying TypeScript definitions..."
cp "$WASM_DIR/elex-wasm.d.ts" "$PKG_DIR/"

# Create browser example
echo "📄 Creating browser example..."
mkdir -p "$PKG_DIR/examples"
cat > "$PKG_DIR/examples/browser.html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8"/>
    <title>ELEX WASM Example</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .output { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-top: 20px; }
        button { padding: 10px 20px; font-size: 16px; cursor: pointer; }
    </style>
</head>
<body>
    <h1>ELEX WASM Demo</h1>
    <p>This demo loads the ELEX swarm and processes a query.</p>
    <button onclick="runDemo()">Run Demo</button>
    <div id="output" class="output" style="display:none;"></div>

    <script type="module">
        import init, { ElexSwarm, QueryType, Complexity, version, get_supported_features } from './elex_wasm.js';

        async function runDemo() {
            const output = document.getElementById('output');
            output.style.display = 'block';
            output.innerHTML = '<p>Initializing ELEX WASM...</p>';

            try {
                // Initialize WASM
                await init();

                // Show version info
                const v = version();
                const features = get_supported_features();
                output.innerHTML += `<p><strong>Version:</strong> ${v}</p>`;
                output.innerHTML += `<p><strong>Features:</strong> ${features.join(', ')}</p>`;
                output.innerHTML += '<p>Creating swarm...</p>';

                // Create swarm
                const swarm = await new ElexSwarm({
                    topology: 'hierarchical-mesh',
                    maxAgents: 10,
                    enableTelemetry: true
                });

                output.innerHTML += '<p>Swarm created successfully!</p>';
                output.innerHTML += '<p>Processing query...</p>';

                // Process query
                const response = await swarm.query({
                    text: 'Configure IFLB thresholds for load balancing',
                    queryType: QueryType.Parameter,
                    complexity: Complexity.Moderate
                });

                output.innerHTML += `<p><strong>Response:</strong> ${response.text}</p>`;
                output.innerHTML += `<p><strong>Confidence:</strong> ${response.confidence}</p>`;
                output.innerHTML += `<p><strong>Latency:</strong> ${response.latencyMs}ms</p>`;
                output.innerHTML += `<p><strong>Agent:</strong> ${response.agentId}</p>`;

                // Get swarm stats
                const stats = await swarm.getSwarmStats();
                output.innerHTML += `<p><strong>Total Agents:</strong> ${stats.totalAgents}</p>`;
                output.innerHTML += `<p><strong>Uptime:</strong> ${Math.round(stats.uptimeMs)}ms</p>`;

                // Provide feedback
                await swarm.feedback(response.agentId, 0.8, true);
                output.innerHTML += '<p><em>Feedback recorded</em></p>';

            } catch (error) {
                output.innerHTML += `<p style="color: red;"><strong>Error:</strong> ${error.message}</p>`;
            }
        }

        window.runDemo = runDemo;
    </script>
</body>
</html>
EOF

# Create Node.js example
cat > "$PKG_DIR/examples/node.js" << 'EOF'
const { ElexSwarm, QueryType, Complexity, version } = require('./elex_wasm');

async function main() {
    console.log('ELEX WASM Node.js Example');
    console.log('========================');
    console.log(`Version: ${version()}`);
    console.log('');

    try {
        // Create swarm
        console.log('Creating swarm...');
        const swarm = await new ElexSwarm({
            maxAgents: 10,
            enableTelemetry: true
        });

        console.log('Swarm created successfully!');
        console.log('');

        // Process query
        console.log('Processing query...');
        const response = await swarm.query({
            text: 'How to optimize MIMO sleep mode?',
            queryType: QueryType.General,
            complexity: Complexity.Moderate
        });

        console.log(`Response: ${response.text}`);
        console.log(`Confidence: ${response.confidence}`);
        console.log(`Latency: ${response.latencyMs}ms`);
        console.log(`Agent: ${response.agentId}`);
        console.log('');

        // Get stats
        const stats = await swarm.getSwarmStats();
        console.log(`Total Agents: ${stats.totalAgents}`);
        console.log(`Uptime: ${Math.round(stats.uptimeMs)}ms`);

        // Cleanup
        await swarm.shutdown();
        console.log('Shutdown complete');

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();
EOF

# Build summary
echo ""
echo "✅ Build complete!"
echo ""
echo "Generated files:"
echo "  - $PKG_DIR/elex_wasm.js"
echo "  - $PKG_DIR/elex_wasm_bg.wasm"
echo "  - $PKG_DIR/elex_wasm.d.ts"
echo "  - $PKG_DIR/elex_wasm_bg.js"
echo ""
echo "Examples:"
echo "  - $PKG_DIR/examples/browser.html (Open in browser)"
echo "  - $PKG_DIR/examples/node.js (Run with: node examples/node.js)"
echo ""
echo "📦 Package size:"
du -sh "$PKG_DIR/elex_wasm_bg.wasm" 2>/dev/null || echo "  (WASM file not found)"
echo ""
echo "🚀 To use in your project:"
echo "  1. Copy pkg/ directory to your project"
echo "  2. Import: import { ElexSwarm } from './pkg/elex_wasm.js';"
echo "  3. Initialize: const swarm = await new ElexSwarm({ ... });"
echo ""
