# Archived Scripts

Scripts in this directory have been superseded by newer implementations.
They are preserved for reference and git history.

## Archived: 2026-01-11

### indexing/
Scripts superseded by the unified TypeScript indexer (`../indexing/index-ran-features.ts`):

- `index_ran_batch.sh` - Original batch indexer with sequential processing
- `index_ran_optimized.sh` - Improved version with parallel processing
- `index_ran_final.sh` - Alternative using xargs for parallelization

All three did essentially the same job: index 593 RAN features into AgentDB namespaces.
The unified TypeScript indexer consolidates this functionality with better error handling
and integration with the existing TypeScript ecosystem.

### battle-test/
Scripts superseded by the interactive battle CLI (`../battle-test/ran-battle-cli.ts`):

- `run-ran-agent-battle-tests.ts` - Manual 50-question battle test (318 lines)
- `run-250-ran-agent-battle-tests.ts` - Manual 250-question battle test (404 lines)

Both contained inline question definitions and manual agent iteration.
The new interactive CLI uses the DDD framework from `src/domains/ran-battle-test`
and combines both question sets with interactive browsing.

### Root
- `ran_search_helper.sh` - Thin CLI wrapper around `npx @claude-flow/cli@latest memory search`
  - Functionality available directly through the CLI or Python search utilities
