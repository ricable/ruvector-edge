# Claude Code Configuration - Claude Flow V3

Project-specific development guide: [docs/development/elex-development.md](docs/development/elex-development.md)

## Automatic Swarm Orchestration

**When starting work on complex tasks, Claude Code MUST automatically:**

1. **Initialize the swarm** using CLI tools via Bash
2. **Spawn concurrent agents** using Claude Code's Task tool
3. **Coordinate via hooks** and memory

### CRITICAL: CLI + Task Tool in SAME Message

**When user says "spawn swarm" or requests complex work, Claude Code MUST in ONE message:**
1. Call CLI tools via Bash to initialize coordination
2. **IMMEDIATELY** call Task tool to spawn REAL working agents
3. Both CLI and Task calls must be in the SAME response

**CLI coordinates, Task tool agents do the actual work!**

### Auto-Start Swarm Protocol (Background Execution)

When the user requests a complex task, **spawn agents in background and WAIT for completion:**

```javascript
// STEP 1: Initialize swarm coordination
Bash("npx @claude-flow/cli@latest swarm init --topology hierarchical-mesh --max-agents 15")

// STEP 2: Spawn ALL agents IN BACKGROUND in a SINGLE message
// Use run_in_background: true so agents work concurrently
Task({
  prompt: "Research requirements, analyze codebase patterns, store findings in memory",
  subagent_type: "researcher",
  description: "Research phase",
  run_in_background: true
})
Task({
  prompt: "Design architecture based on research. Document decisions.",
  subagent_type: "system-architect",
  description: "Architecture phase",
  run_in_background: true
})
Task({
  prompt: "Implement the solution following the design. Write clean code.",
  subagent_type: "coder",
  description: "Implementation phase",
  run_in_background: true
})
Task({
  prompt: "Write comprehensive tests for the implementation.",
  subagent_type: "tester",
  description: "Testing phase",
  run_in_background: true
})
Task({
  prompt: "Review code quality, security, and best practices.",
  subagent_type: "reviewer",
  description: "Review phase",
  run_in_background: true
})

// STEP 3: WAIT - Tell user agents are working, then STOP
// DO NOT check status repeatedly. Just wait for user or agent responses.
```

### Spawn and Wait Pattern

**After spawning background agents:**
1. **TELL USER** - "I've spawned X agents working in parallel on: [list tasks]"
2. **STOP** - Do not continue with more tool calls
3. **WAIT** - Let the background agents complete their work
4. **RESPOND** - When agents return results, review and synthesize

**DO NOT:** Continuously check swarm status, poll TaskOutput repeatedly, add more tool calls after spawning

**DO:** Spawn all agents in ONE message, tell user what's happening, wait for agent results to arrive, synthesize results when they return

## Auto-Learning Protocol

### Before Starting Any Task
```bash
# Search memory for relevant patterns from past successes
Bash("npx @claude-flow/cli@latest memory search --query '[task keywords]' --namespace patterns")

# Check if similar task was done before
Bash("npx @claude-flow/cli@latest memory search --query '[task type]' --namespace tasks")

# Load learned optimizations
Bash("npx @claude-flow/cli@latest hooks route --task '[task description]'")
```

### After Completing Any Task Successfully
```bash
# Store successful pattern for future reference
Bash("npx @claude-flow/cli@latest memory store --namespace patterns --key '[pattern-name]' --value '[what worked]'")

# Train neural patterns on the successful approach
Bash("npx @claude-flow/cli@latest hooks post-edit --file '[main-file]' --train-neural true")

# Record task completion with metrics
Bash("npx @claude-flow/cli@latest hooks post-task --task-id '[id]' --success true --store-results true")

# Trigger optimization worker if performance-related
Bash("npx @claude-flow/cli@latest hooks worker dispatch --trigger optimize")
```

### Continuous Improvement Triggers

| Trigger | Worker | Purpose |
|---------|--------|---------|
| After major refactor | `optimize` | Performance optimization |
| After adding features | `testgaps` | Find missing test coverage |
| After security changes | `audit` | Security analysis |
| After API changes | `document` | Update documentation |
| Every 5+ file changes | `map` | Update codebase map |
| Complex debugging | `deepdive` | Deep code analysis |

### Agent Routing by Task Type

| Task Type | Required Agents | Topology |
|-----------|-----------------|----------|
| Bug Fix | researcher, coder, tester | mesh |
| New Feature | coordinator, architect, coder, tester, reviewer | hierarchical |
| Refactoring | architect, coder, reviewer | mesh |
| Performance | researcher, performance-engineer, coder | hierarchical |
| Security Audit | security-architect, security-auditor, reviewer | hierarchical |
| Memory Optimization | memory-specialist, performance-engineer | mesh |

### Task Complexity Detection

**AUTO-INVOKE SWARM when task involves:**
- Multiple files (3+)
- New feature implementation
- Refactoring across modules
- API changes with tests
- Security-related changes
- Performance optimization
- Database schema changes

**SKIP SWARM for:**
- Single file edits
- Simple bug fixes (1-2 lines)
- Documentation updates
- Configuration changes
- Quick questions/exploration

## Project Configuration

This project is configured with Claude Flow V3:
- **Topology**: hierarchical-mesh
- **Max Agents**: 15
- **Memory Backend**: hybrid
- **HNSW Indexing**: Enabled (150x-12,500x faster)
- **Neural Learning**: Enabled (SONA)

## V3 CLI Commands

### Core Commands

| Command | Subcommands | Description |
|---------|-------------|-------------|
| `init` | 4 | Project initialization with wizard, presets, skills, hooks |
| `agent` | 8 | Agent lifecycle (spawn, list, status, stop, metrics, pool, health, logs) |
| `swarm` | 6 | Multi-agent swarm coordination and orchestration |
| `memory` | 11 | AgentDB memory with vector search (150x-12,500x faster) |
| `mcp` | 9 | MCP server management and tool execution |
| `task` | 6 | Task creation, assignment, and lifecycle |
| `session` | 7 | Session state management and persistence |
| `config` | 7 | Configuration management and provider setup |
| `status` | 3 | System status monitoring with watch mode |
| `workflow` | 6 | Workflow execution and template management |
| `hooks` | 17 | Self-learning hooks + 12 background workers |

### Quick CLI Examples

```bash
# Initialize project
npx @claude-flow/cli@latest init --wizard

# Start daemon with background workers
npx @claude-flow/cli@latest daemon start

# Spawn an agent
npx @claude-flow/cli@latest agent spawn -t coder --name my-coder

# Initialize swarm
npx @claude-flow/cli@latest swarm init --v3-mode

# Search memory (HNSW-indexed)
npx @claude-flow/cli@latest memory search --query "authentication patterns"

# System diagnostics
npx @claude-flow/cli@latest doctor --fix
```

## Available Agents

### Core Development
`coder`, `reviewer`, `tester`, `planner`, `researcher`

### V3 Specialized Agents
`security-architect`, `security-auditor`, `memory-specialist`, `performance-engineer`

### Swarm Coordination
`hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`, `swarm-memory-manager`

### GitHub & Repository
`pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`, `workflow-automation`, `repo-architect`

### SPARC Methodology
`sparc-coord`, `sparc-coder`, `specification`, `pseudocode`, `architecture`, `refinement`

## V3 Hooks System

### Essential Hook Commands

```bash
# Core hooks
npx @claude-flow/cli@latest hooks pre-task --description "[task]"
npx @claude-flow/cli@latest hooks post-task --task-id "[id]" --success true
npx @claude-flow/cli@latest hooks post-edit --file "[file]" --train-neural true

# Session management
npx @claude-flow/cli@latest hooks session-start --session-id "[id]"
npx @claude-flow/cli@latest hooks session-end --export-metrics true

# Intelligence routing
npx @claude-flow/cli@latest hooks route --task "[task]"

# Background workers
npx @claude-flow/cli@latest hooks worker list
npx @claude-flow/cli@latest hooks worker dispatch --trigger audit
```

## Memory Commands Reference

### Store Data
```bash
# REQUIRED: --key and --value
# OPTIONAL: --namespace (default: "default"), --ttl, --tags
npx @claude-flow/cli@latest memory store --key "pattern-auth" --value "JWT with refresh tokens" --namespace patterns
```

### Search Data (semantic vector search)
```bash
# REQUIRED: --query (full flag, not -q)
npx @claude-flow/cli@latest memory search --query "authentication patterns"
```

### List Entries
```bash
npx @claude-flow/cli@latest memory list --namespace patterns --limit 10
```

### Retrieve Specific Entry
```bash
# REQUIRED: --key
npx @claude-flow/cli@latest memory retrieve --key "pattern-auth" --namespace patterns
```

## V3 Integrated Workflow (SPARC + DDD + ADR)

### Architecture Overview
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CLAUDE FLOW V3 INTEGRATION                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │    SPARC     │───▶│     DDD      │───▶│     ADR      │                   │
│  │ (Methodology)│    │ (Structure)  │    │ (Decisions)  │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│                             ▼                                               │
│                   ┌──────────────────┐                                      │
│  ┌────────────────┤   GOAL AGENT     │                                      │
│  │                │ (Orchestration)  │                                      │
│  │                └────────┬─────────┘                                      │
│  │                         ▼                                                │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  │              MCP SKILLS (claude-flow)                              │  │
│  │  └────────────────────────────────────────────────────────────────────┘  │
│  └──────────────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────────────┘
```

### SPARC Methodology

| Phase | Description | Key Agents |
|-------|-------------|------------|
| **S**pecification | Requirements & acceptance criteria | `specification`, `researcher` |
| **P**seudocode | High-level design before code | `pseudocode`, `architect` |
| **A**rchitecture | System design & bounded contexts | `architecture`, `ddd-domain-expert` |
| **R**efinement | TDD implementation | `coder`, `tester`, `reviewer` |
| **C**ompletion | Documentation, deployment | `documenter`, `workflow-manager` |

```bash
# Using SPARC via CLI
npx @claude-flow/cli@latest sparc run specification "Define auth requirements"
npx @claude-flow/cli@latest sparc run tdd "Implement authentication with 90% coverage"
```

### DDD (Domain-Driven Design)

**Key Bounded Contexts:**

| Context | Type | Responsibility |
|---------|------|----------------|
| Swarm | Core | Agent coordination, topology |
| Agent | Core | Agent lifecycle, capabilities |
| Task | Core | Task orchestration, execution |
| Memory | Supporting | Persistence, search, sync |
| Neural | Supporting | Pattern learning, prediction |
| MCP | Generic | Transport, tool execution |

```bash
npx @claude-flow/cli@latest ddd analyze --path ./src
npx @claude-flow/cli@latest ddd context-map
```

### ADR (Architecture Decision Records)

**ADR Locations:**
- `docs/adr/` — Project-level ADRs
- `claude-flow-v3/v3/implementation/adrs/` — Framework ADRs

## Environment Variables

```bash
# Configuration
CLAUDE_FLOW_CONFIG=./claude-flow.config.json
CLAUDE_FLOW_LOG_LEVEL=info

# Provider API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# MCP Server
CLAUDE_FLOW_MCP_PORT=3000
CLAUDE_FLOW_MCP_TRANSPORT=stdio

# Memory
CLAUDE_FLOW_MEMORY_BACKEND=hybrid
CLAUDE_FLOW_MEMORY_PATH=./data/memory
```

## Quick Setup

```bash
# Add MCP servers
claude mcp add claude-flow -- npx -y @claude-flow/cli@latest

# Start daemon
npx @claude-flow/cli@latest daemon start

# Run doctor
npx @claude-flow/cli@latest doctor --fix
```

## Critical Execution Rules

1. **SPAWN IN BACKGROUND**: Use `run_in_background: true` for all agent Task calls
2. **SPAWN ALL AT ONCE**: Put ALL agent Task calls in ONE message for parallel execution
3. **TELL USER**: After spawning, list what each agent is doing
4. **STOP AND WAIT**: After spawning, STOP - do NOT add more tool calls or check status
5. **NO POLLING**: Never poll TaskOutput or check swarm status - trust agents to return
6. **SYNTHESIZE**: When agent results arrive, review ALL results before proceeding

## Support

- Documentation: https://github.com/ruvnet/claude-flow
- Issues: https://github.com/ruvnet/claude-flow/issues

---

**Remember: Claude Flow CLI coordinates, Claude Code Task tool creates!**
