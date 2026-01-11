import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/**/*.test.{js,ts,jsx,tsx}',
      'tests/**/*.spec.{js,ts,jsx,tsx}'
    ],
    exclude: [
      'node_modules',
      'dist',
      'claude-flow-v3',
      '**/*.d.ts',
      '**/index.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/**/*.ts'
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/wasm/**', // Separate WASM testing
        'src/@agentdb/**' // External AgentDB interfaces
      ],
      thresholds: {
        lines: 40,
        functions: 40,
        branches: 40,
        statements: 40,
        // Per-file thresholds for critical modules
        perFile: {
          lines: 30,
          functions: 30,
          branches: 30,
          statements: 30
        }
      },
      // Skip coverage for node_modules and external dependencies
      skipFull: true
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@core': resolve(__dirname, './src/core'),
      '@domains': resolve(__dirname, './src/domains'),
      '@layers': resolve(__dirname, './src/layers'),
      '@infrastructure': resolve(__dirname, './src/infrastructure'),
      '@security': resolve(__dirname, './src/security'),
      '@wasm': resolve(__dirname, './src/wasm')
    }
  }
});