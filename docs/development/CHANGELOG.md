# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.0] - 2026-01-10

### Added

- **Claude-Flow Integration Layer** (`src/infrastructure/claude-flow/`)
  - Main integration module with device-specific configurations
  - Swarm coordinator for 593-agent management with ESP32 federation support
  - Memory integration with HNSW configuration per PRD specifications

- **New Dependencies**
  - `@claude-flow/memory` - HNSW indexing, vector search, hybrid SQLite+AgentDB
  - `@claude-flow/swarm` - 100+ agent coordination, 4 topologies, hive-mind
  - `@claude-flow/embeddings` - OpenAI, Transformers.js, Mock providers
  - `@claude-flow/shared` - Common types, events, utilities
  - `@claude-flow/neural` - SONA learning integration
  - `@claude-flow/hooks` - Event-driven lifecycle hooks
  - `@claude-flow/performance` - Benchmarking, Flash Attention validation
  - `@ruvector/agentic-integration` - Distributed agent coordination
  - `@ruvector/burst-scaling` - 10-50x traffic spike handling

- **Edge Device Configurations**
  - ESP32 config: 5 cached agents, 4MB memory budget, INT8/INT4 ready
  - Raspberry Pi config: 30 cached agents, 512MB memory budget, full SIMD

### Changed

- Updated `package.json` with new claude-flow and ruvector dependencies

## [2.1.0] - Previous Release

### Added

- Initial ELEX Edge AI Agent Swarm implementation
- 9 Rust crates for WASM SIMD edge deployment
- 593 specialized feature agents for Ericsson RAN optimization
- Q-learning engine with federated learning
- HNSW vector indexing
- Ed25519/AES-256-GCM security layer
