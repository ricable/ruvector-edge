# Scripts Directory

Organized utility scripts for RAN feature management, battle testing, and optimization.

## Directory Structure

```
scripts/
├── archive/                    # Superseded scripts (preserved for reference)
├── battle-test/               # RAN agent battle testing
├── indexing/                  # Feature indexing utilities
├── optimization/              # Energy and CA optimization demos
├── search/                    # Python search and query tools
└── security/                  # Security validation
```

## Quick Start

### Interactive Battle Demo

```bash
bun run scripts/battle-test/ran-battle-cli.ts
```

Features:
- 300 questions (250 + 50 from two question sets)
- Browse by Category (Knowledge/Decision/Advanced)
- Browse by Feature (50 LTE features)
- Random Challenge mode
- Real-time agent responses with scoring

### Index RAN Features

```bash
bun run scripts/indexing/index-ran-features.ts
```

Options:
- `--sequential` - Use sequential processing
- `--batch-size N` - Set parallel batch size (default: 50)
- `--dry-run` - Show what would be indexed

---

## Battle Test Scripts

Located in `battle-test/`:

| Script | Purpose |
|--------|---------|
| `ran-battle-cli.ts` | **Interactive CLI demo** - Main entry point for testing agents |
| `run-battle-test.ts` | Automated battle test framework (ADR-025) |
| `store-questions.ts` | Store questions to AgentDB for reuse |

### Run Battle Test

```bash
# Interactive mode (recommended)
bun run scripts/battle-test/ran-battle-cli.ts

# Automated modes
bun run scripts/battle-test/run-battle-test.ts solo    # Each agent answers its questions
bun run scripts/battle-test/run-battle-test.ts battle  # Agents compete
bun run scripts/battle-test/run-battle-test.ts stress  # All agents answer all questions
bun run scripts/battle-test/run-battle-test.ts ooda    # OODA loop validation
```

---

## Indexing Scripts

Located in `indexing/`:

| Script | Purpose |
|--------|---------|
| `index-ran-features.ts` | **Unified indexer** - Index 593 features to AgentDB |
| `index_ran_features.py` | Python reference implementation |

### Index Features

```bash
# TypeScript (recommended)
bun run scripts/indexing/index-ran-features.ts

# Python (reference)
python scripts/indexing/index_ran_features.py
```

---

## Search Scripts

Located in `search/`:

| Script | Purpose |
|--------|---------|
| `search.py` | Feature search by acronym, name, parameter, domain |
| `deps.py` | Feature dependency graph analysis |
| `cmedit_generator.py` | Generate cmedit CLI commands |

### Search Features

```bash
# Search by acronym
python scripts/search/search.py IFLB

# Search by domain
python scripts/search/search.py --domain "Carrier Aggregation"

# Generate cmedit commands
python scripts/search/cmedit_generator.py IFLB --format bash
```

---

## Optimization Scripts

Located in `optimization/`:

| Script | Purpose |
|--------|---------|
| `execute-energy-optimization.ts` | MIMO Sleep (GOAL-008) + Cell Sleep (GOAL-009) |
| `goal-010-ca-optimization.ts` | Carrier Aggregation optimization demo |

### Run Optimization Demo

```bash
bun run scripts/optimization/execute-energy-optimization.ts
bun run scripts/optimization/goal-010-ca-optimization.ts
```

---

## Security Scripts

Located in `security/`:

| Script | Purpose |
|--------|---------|
| `validate-security-hardening.ts` | GOAL-012 security validation (593 agents) |

### Validate Security

```bash
bun run scripts/security/validate-security-hardening.ts
```

---

## Archived Scripts

Scripts in `archive/` have been superseded by newer implementations:

| Script | Superseded By |
|--------|---------------|
| `archive/indexing/*.sh` | `indexing/index-ran-features.ts` |
| `archive/battle-test/*.ts` | `battle-test/ran-battle-cli.ts` |
| `archive/ran_search_helper.sh` | `search/search.py` or direct CLI |
| `archive/test-skill-query.ts` | `battle-test/ran-battle-cli.ts` |

See `archive/README.md` for details on why each script was archived.

---

## Development

### Adding New Scripts

1. Place scripts in the appropriate subdirectory
2. Add TypeScript scripts with shebang: `#!/usr/bin/env bun`
3. Add `--help` support for CLI scripts
4. Update this README

### Running with Bun

All TypeScript scripts are optimized for Bun runtime:

```bash
bun run scripts/<path>/<script>.ts
```

### Python Scripts

Python scripts use standard library only (no pip install required):

```bash
python scripts/<path>/<script>.py
```
