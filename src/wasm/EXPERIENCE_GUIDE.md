# ELEX WASM SDK Experience Guide 🚀

Your project code in `./src/wasm` is now built and ready to be experienced in both **Node.js** and the **Browser**.

## 🏗️ Build Status
- **Node.js Package**: Built in `./crates/elex-wasm/pkg-nodejs/`
- **Web Package**: Built in `./crates/elex-wasm/pkg-web/`
- **Demo Dashboard**: Created in `./demo-browser/`

## 💻 Node.js Experience (CLI)

You can run the TypeScript demo directly using `tsx`:

```bash
npx tsx src/wasm/demo-node.ts
```

This demo:
1. Initializes the `ElexSwarm` with a hierarchical-mesh topology.
2. Checks SIMD availability.
3. Processes a RAN optimization query locally using the WASM runtime.
4. Reports latency and confidence metrics.

## 🌐 Browser Experience (Dashboard)

To experience the premium agent dashboard:

1. Start a local web server:
   ```bash
   python3 -m http.server -d src/wasm/demo-browser 8080
   ```
2. Open your browser to: `http://localhost:8080`

### Features of the Dashboard:
- **Real-time Interaction**: Chat with the swarm directly.
- **Dynamic Metrics**: Monitor latency and active agent counts.
- **SIMD Monitoring**: See if your browser supports hardware acceleration.
- **System Logs**: Follow the swarm's thought process and WASM initialization.

---

## 🛠️ Built with Performance in Mind
- **Crate**: `elex-wasm`
- **Version**: 3.1.0
- **Optimization**: Built with `opt-level = "z"` for minimum binary size.
- **Architecture**: Domain-Driven Design (DDD) with 593 specialized agent types.
