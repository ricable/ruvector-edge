# Test Infrastructure

This directory contains the comprehensive test suite for the ELEX Edge AI Agent Swarm project, organized to achieve 40% test coverage across all domains.

## Test Structure

```
tests/
├── unit/                    # Unit tests for individual components
│   ├── core/               # Core primitive tests
│   │   ├── agent/          # Agent lifecycle utilities
│   │   ├── knowledge/      # Knowledge base components
│   │   ├── learning/       # Learning algorithms
│   │   ├── memory/         # Memory management
│   │   └── types/          # Value objects and types
│   ├── domains/            # Domain aggregate tests (highest priority)
│   │   ├── agent-lifecycle/
│   │   ├── coordination/
│   │   ├── energy/
│   │   ├── intelligence/   # Q-learning, state machines
│   │   ├── knowledge/      # Feature agents, knowledge base
│   │   ├── optimization/
│   │   ├── ran-battle-test/
│   │   ├── ran-knowledge/
│   │   ├── runtime/
│   │   └── security/
│   ├── layers/             # Layer integration tests
│   ├── infrastructure/     # Infrastructure components
│   └── security/           # Security components
├── integration/            # Integration tests
│   ├── domains/           # Cross-domain integration
│   ├── layers/            # Layer integration
│   └── wire/              # Wire protocol tests
├── e2e/                   # End-to-end tests
│   ├── ran-knowledge/     # Battle tests, agent workflows
│   ├── optimization/      # Optimization workflows
│   ├── security/          # Security validation
│   └── wasm/              # WASM integration
└── benchmarks/            # Performance benchmarks
    ├── performance/       # Performance testing
    └── load/              # Load testing
```

## Test Commands

### All Tests
```bash
# Run all tests
bun test

# Run with coverage
bun run test:coverage

# Run with UI
bun run test:ui
```

### Test Categories
```bash
# Unit tests only
bun run test:unit

# Integration tests only
bun run test:integration

# E2E tests only
bun run test:e2e

# Coverage watching
bun run test:coverage:watch
```

## Test Coverage Goals

- **Overall Target**: 40% coverage across all source files
- **Critical Domains**: 60%+ coverage for intelligence and knowledge domains
- **Per-File Thresholds**: 30% minimum coverage for individual files
- **Exclusions**: WASM modules, external interfaces, index files

### Priority Coverage Areas

1. **Intelligence Domain** (QTable, TrajectoryBuffer, State Machines)
2. **Knowledge Domain** (Feature Agents, Enhanced Feature Agents)
3. **Coordination Domain** (Event Bus, Swarm Coordination)
4. **Optimization Domain** (CA Optimizer, Handover Optimizer)
5. **Core Domain** (Value Objects, Primitive Types)

## Running Tests

### Development
```bash
# Run tests in watch mode
bun test --watch

# Run only failing tests
bun test --reporter=verbose
```

### CI/CD
```bash
# Full test suite with coverage
bun run test:coverage

# Ensure thresholds are met
coverage-reporter check --threshold 40
```

## Test Templates

Each domain should follow the testing patterns established in the template files:

- **Unit Tests**: Component isolation with mocking
- **Integration Tests**: Component interaction testing
- **E2E Tests**: End-to-end workflow validation

### Example Test Structure
```typescript
describe('[Component]', () => {
  describe('creation', () => {
    it('should create with valid parameters', () => {});
  });

  describe('business logic', () => {
    it('should handle normal operations', () => {});
    it('should validate inputs', () => {});
  });

  describe('edge cases', () => {
    it('should handle invalid inputs gracefully', () => {});
    it('should maintain invariants', () => {});
  });

  describe('persistence', () => {
    it('should serialize/deserialize correctly', () => {});
  });
});
```

## Test Data

Use test factories for consistent test data:

```typescript
// Import test factories
import { createAgent, createQuery, createEvent } from '@/__test__/factories';

// Use in tests
const agent = createAgent({ fajCode: '11CS' });
const query = createQuery({ type: 'information' });
```

## Mocking and Spies

Use Vitest's built-in mocking:

```typescript
import { vi } from 'vitest';

// Mock dependencies
const mockQTable = vi.fn();
vi.mock('@/domains/intelligence/aggregates/q-table', () => ({
  QTable: mockQTable
}));

// Spy on methods
const spy = vi.spyOn(agent, 'handleQuery');
```

## Coverage Reports

Coverage reports are generated in:

- `coverage/` - Detailed HTML report
- `coverage/lcov.info` - LCov format for CI
- Console output for quick review

### Viewing Coverage

```bash
# Open HTML report
open coverage/index.html

# View summary
bun run test:coverage | grep -E "(Total|Lines|Functions)"
```

## Adding New Tests

1. **Create test file** in appropriate directory
2. **Follow naming convention**: `[component].test.ts`
3. **Include all test categories** from template
4. **Ensure coverage** for new functionality
5. **Update coverage thresholds** if needed

## Continuous Integration

Tests are integrated into CI with:

- **Minimum 40% overall coverage**
- **No test failures**
- **Performance benchmarks** for critical paths
- **Security tests** for authentication and authorization

## Debugging

### Running Specific Tests
```bash
# Run specific test file
bun test tests/unit/domains/intelligence/q-table.test.ts

# Run test with matching name
bun test --grep "Q-value updates"
```

### Debug Mode
```bash
# Run with debug flags
bun test --reporter=verbose --no-coverage
```

## Future Enhancements

- **Property-based testing** for edge cases
- **Visual regression testing** for UI components
- **Load testing** for high-throughput scenarios
- **Contract testing** for API integrations

---

*Part of the Repository Deep Cleanup Initiative*