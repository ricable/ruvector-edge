/**
 * @fileoverview Claude-Flow Integration Layer
 * 
 * Integrates @claude-flow packages with ELEX Edge AI Agent Swarm
 * for enhanced WASM SIMD edge deployment.
 * 
 * @module infrastructure/claude-flow
 */

// Re-export claude-flow packages for unified access
export * as memory from '@claude-flow/memory';
export * as swarm from '@claude-flow/swarm';
export * as embeddings from '@claude-flow/embeddings';
export * as shared from '@claude-flow/shared';
export * as neural from '@claude-flow/neural';
export * as hooks from '@claude-flow/hooks';
export * as performance from '@claude-flow/performance';

// Re-export ruvector integration packages
// Note: @ruvector/agentic-integration may need type declarations
// export * as agenticIntegration from '@ruvector/agentic-integration';
export * as burstScaling from '@ruvector/burst-scaling';

/**
 * ELEX-specific integration configuration
 */
export interface ElexClaudeFlowConfig {
    /** Enable HNSW indexing via @claude-flow/memory */
    enableHNSW: boolean;

    /** Configure swarm topology for 593 agents */
    swarmTopology: 'mesh' | 'hierarchical' | 'hierarchical-mesh' | 'sharded';

    /** Maximum agents in active cache */
    maxCachedAgents: number;

    /** Memory budget in MB */
    memoryBudgetMB: number;

    /** Enable neural (SONA) learning integration */
    enableNeuralLearning: boolean;

    /** SIMD mode: 'auto' detects at runtime */
    simdMode: 'auto' | 'simd128' | 'scalar';
}

/**
 * Default configuration optimized for 593-agent swarm
 */
export const DEFAULT_CONFIG: ElexClaudeFlowConfig = {
    enableHNSW: true,
    swarmTopology: 'hierarchical-mesh',
    maxCachedAgents: 50,
    memoryBudgetMB: 500,
    enableNeuralLearning: true,
    simdMode: 'auto',
};

/**
 * ESP32-optimized configuration for edge deployment
 */
export const ESP32_CONFIG: ElexClaudeFlowConfig = {
    enableHNSW: true,
    swarmTopology: 'hierarchical',
    maxCachedAgents: 5,
    memoryBudgetMB: 4, // ~4MB PSRAM limit
    enableNeuralLearning: false,
    simdMode: 'scalar', // ESP32 base has no SIMD; ESP32-S3 can use 'auto'
};

/**
 * Raspberry Pi 4/5 configuration
 */
export const RASPBERRY_PI_CONFIG: ElexClaudeFlowConfig = {
    enableHNSW: true,
    swarmTopology: 'hierarchical-mesh',
    maxCachedAgents: 30,
    memoryBudgetMB: 512,
    enableNeuralLearning: true,
    simdMode: 'auto', // ARM NEON supported via WASM SIMD
};
