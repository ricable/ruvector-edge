/**
 * @fileoverview Memory Integration
 * 
 * Bridges @claude-flow/memory with ELEX HNSW and Q-learning memory layers.
 */

import { memory, type ElexClaudeFlowConfig, DEFAULT_CONFIG } from './index.js';

/**
 * HNSW configuration per ADR-005 and PRD
 */
export interface HNSWConfig {
    /** Vector dimensions (128 for ELEX embeddings) */
    dimensions: number;

    /** Connections per node (M parameter) */
    M: number;

    /** Build-time accuracy (efConstruction) */
    efConstruction: number;

    /** Query-time accuracy (efSearch) */
    efSearch: number;

    /** Maximum vectors per agent */
    maxElements: number;

    /** Distance metric */
    distance: 'cosine' | 'euclidean' | 'dot';
}

/**
 * ELEX HNSW configuration per PRD specifications
 */
export const ELEX_HNSW_CONFIG: HNSWConfig = {
    dimensions: 128,
    M: 16,
    efConstruction: 200,
    efSearch: 50,
    maxElements: 10_000,
    distance: 'cosine',
};

/**
 * Memory budget allocation per PRD
 */
export interface MemoryBudget {
    sharedHNSWIndex: number; // MB
    cachedAgents: number;    // MB
    staticKnowledge: number; // MB
    runtimeOverhead: number; // MB
    total: number;           // MB
}

export const DEFAULT_MEMORY_BUDGET: MemoryBudget = {
    sharedHNSWIndex: 100,
    cachedAgents: 350, // 50 agents × ~7MB each
    staticKnowledge: 3.2,
    runtimeOverhead: 47,
    total: 500,
};

/**
 * ESP32 memory budget (extremely constrained)
 */
export const ESP32_MEMORY_BUDGET: MemoryBudget = {
    sharedHNSWIndex: 1,
    cachedAgents: 2,
    staticKnowledge: 0.5,
    runtimeOverhead: 0.5,
    total: 4, // ~4MB PSRAM
};

/**
 * Initialize memory layer with HNSW indexing
 */
export async function initializeMemory(
    config: Partial<HNSWConfig> = {}
): Promise<void> {
    const finalConfig = { ...ELEX_HNSW_CONFIG, ...config };

    console.log(`[ELEX Memory] Initializing HNSW index`);
    console.log(`[ELEX Memory] Dimensions: ${finalConfig.dimensions}, M: ${finalConfig.M}`);
    console.log(`[ELEX Memory] Max elements per agent: ${finalConfig.maxElements}`);

    // Initialize via @claude-flow/memory when configured
    // Placeholder for actual memory initialization
}
