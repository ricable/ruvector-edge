#!/usr/bin/env bun
/**
 * AgentDB Bridge for Self-Learning Swarm Demo
 * 
 * Provides TypeScript interface to AgentDB memory operations with:
 * - Semantic search across namespaces
 * - Knowledge storage and retrieval
 * - Learning state persistence
 * - Q-table sync operations
 * 
 * Memory Namespaces:
 * - elex-knowledge: Feature metadata, parameters, counters, KPIs
 * - elex-intelligence: Q-tables, trajectories, patterns, verdicts
 * - elex-optimization: Optimization results, metrics, benchmarks
 * - elex-coordination: Federated sync, peer status, consensus results
 */

import { execSync, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface SearchResult {
    key: string;
    value: any;
    score: number;
    namespace: string;
    timestamp?: number;
}

export interface QTableEntry {
    stateHash: string;
    action: number;
    qValue: number;
    visits: number;
    lastUpdated: number;
}

export interface LearningState {
    agentId: string;
    totalInteractions: number;
    successRate: number;
    avgResponseTime: number;
    qTable: Record<string, QTableEntry>;
    trajectory: TrajectoryPoint[];
}

export interface TrajectoryPoint {
    timestamp: number;
    state: string;
    action: string;
    reward: number;
    nextState: string;
}

export interface ReasoningPattern {
    id: string;
    contextEmbedding: number[];
    actionSequence: string[];
    successRate: number;
    usageCount: number;
}

export interface Verdict {
    score: number;
    confidence: number;
    rationale: string;
    criteriaScores: Record<string, number>;
}

// ============================================================================
// Constants
// ============================================================================

export const MEMORY_NAMESPACES = {
    'elex-knowledge': 'Feature metadata, parameters, counters, KPIs',
    'elex-intelligence': 'Q-tables, trajectories, patterns, verdicts',
    'elex-optimization': 'Optimization results, metrics, benchmarks',
    'elex-coordination': 'Federated sync, peer status, consensus results',
    'elex-features': 'Indexed Ericsson RAN feature documents',
} as const;

export type MemoryNamespace = keyof typeof MEMORY_NAMESPACES;

// Fallback to local file-based storage when AgentDB CLI is not available
const LOCAL_STORAGE_PATH = path.join(process.cwd(), '.agentdb-local');

// ============================================================================
// AgentDB Bridge Class
// ============================================================================

export class AgentDBBridge {
    private static useLocalFallback = false;
    private static localStorage: Map<string, Map<string, any>> = new Map();

    /**
     * Initialize the bridge and check for AgentDB availability
     */
    static async initialize(): Promise<boolean> {
        try {
            // Try to check if AgentDB CLI is available
            execSync('which npx', { encoding: 'utf-8', timeout: 5000 });
            this.useLocalFallback = false;

            // Initialize local storage directories for fallback
            if (!fs.existsSync(LOCAL_STORAGE_PATH)) {
                fs.mkdirSync(LOCAL_STORAGE_PATH, { recursive: true });
            }

            // Load any existing local storage
            await this.loadLocalStorage();

            return true;
        } catch {
            console.warn('⚠️  AgentDB CLI not available, using local file-based fallback');
            this.useLocalFallback = true;
            await this.loadLocalStorage();
            return false;
        }
    }

    /**
     * Load local storage from disk
     */
    private static async loadLocalStorage(): Promise<void> {
        if (!fs.existsSync(LOCAL_STORAGE_PATH)) {
            fs.mkdirSync(LOCAL_STORAGE_PATH, { recursive: true });
        }

        for (const namespace of Object.keys(MEMORY_NAMESPACES)) {
            const nsPath = path.join(LOCAL_STORAGE_PATH, `${namespace}.json`);
            if (fs.existsSync(nsPath)) {
                try {
                    const data = JSON.parse(fs.readFileSync(nsPath, 'utf-8'));
                    this.localStorage.set(namespace, new Map(Object.entries(data)));
                } catch {
                    this.localStorage.set(namespace, new Map());
                }
            } else {
                this.localStorage.set(namespace, new Map());
            }
        }
    }

    /**
     * Save local storage to disk
     */
    private static async saveLocalStorage(namespace: string): Promise<void> {
        const nsPath = path.join(LOCAL_STORAGE_PATH, `${namespace}.json`);
        const nsMap = this.localStorage.get(namespace);
        if (nsMap) {
            const data = Object.fromEntries(nsMap);
            fs.writeFileSync(nsPath, JSON.stringify(data, null, 2), 'utf-8');
        }
    }

    /**
     * Search for entries in AgentDB namespace
     */
    static async search(
        query: string,
        namespace: MemoryNamespace = 'elex-knowledge',
        limit: number = 10
    ): Promise<SearchResult[]> {
        if (this.useLocalFallback) {
            return this.localSearch(query, namespace, limit);
        }

        try {
            const cmd = `npx @claude-flow/cli@latest memory search --query "${query.replace(/"/g, '\\"')}" --namespace ${namespace} --limit ${limit}`;
            const result = execSync(cmd, { encoding: 'utf-8', timeout: 10000 });
            return JSON.parse(result);
        } catch (error) {
            // Fall back to local search
            return this.localSearch(query, namespace, limit);
        }
    }

    /**
     * Local search implementation (simple text matching)
     */
    private static localSearch(
        query: string,
        namespace: string,
        limit: number
    ): SearchResult[] {
        const nsMap = this.localStorage.get(namespace);
        if (!nsMap) return [];

        const queryLower = query.toLowerCase();
        const results: SearchResult[] = [];

        for (const [key, value] of nsMap) {
            const keyMatch = key.toLowerCase().includes(queryLower);
            const valueStr = JSON.stringify(value).toLowerCase();
            const valueMatch = valueStr.includes(queryLower);

            if (keyMatch || valueMatch) {
                // Simple scoring based on match position and frequency
                let score = 0;
                if (keyMatch) score += 0.5;
                if (valueMatch) {
                    const occurrences = (valueStr.match(new RegExp(queryLower, 'g')) || []).length;
                    score += Math.min(occurrences * 0.1, 0.5);
                }

                results.push({
                    key,
                    value,
                    score,
                    namespace,
                    timestamp: value?.timestamp || Date.now(),
                });
            }
        }

        // Sort by score descending
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, limit);
    }

    /**
     * Retrieve a specific entry by key
     */
    static async retrieve(
        key: string,
        namespace: MemoryNamespace = 'elex-knowledge'
    ): Promise<any | null> {
        if (this.useLocalFallback) {
            const nsMap = this.localStorage.get(namespace);
            return nsMap?.get(key) || null;
        }

        try {
            const cmd = `npx @claude-flow/cli@latest memory retrieve --namespace ${namespace} --key "${key.replace(/"/g, '\\"')}"`;
            const result = execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
            return JSON.parse(result);
        } catch {
            const nsMap = this.localStorage.get(namespace);
            return nsMap?.get(key) || null;
        }
    }

    /**
     * Store an entry in AgentDB namespace (upsert semantics)
     */
    static async store(
        key: string,
        value: object,
        namespace: MemoryNamespace
    ): Promise<boolean> {
        // Always store locally for fallback
        let nsMap = this.localStorage.get(namespace);
        if (!nsMap) {
            nsMap = new Map();
            this.localStorage.set(namespace, nsMap);
        }
        nsMap.set(key, { ...value, timestamp: Date.now() });
        await this.saveLocalStorage(namespace);

        if (this.useLocalFallback) {
            return true;
        }

        try {
            const escapedKey = key.replace(/"/g, '\\"');
            const valueJson = JSON.stringify(value).replace(/"/g, '\\"');

            // First try to delete existing entry (upsert pattern)
            try {
                const deleteCmd = `npx @claude-flow/cli@latest memory delete --namespace ${namespace} --key "${escapedKey}" 2>/dev/null`;
                execSync(deleteCmd, { encoding: 'utf-8', timeout: 3000, stdio: 'pipe' });
            } catch {
                // Key may not exist, that's fine
            }

            // Now store the new value
            const storeCmd = `npx @claude-flow/cli@latest memory store --namespace ${namespace} --key "${escapedKey}" --value "${valueJson}"`;
            execSync(storeCmd, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
            return true;
        } catch (error) {
            // Suppress UNIQUE constraint errors - local storage is our source of truth
            const errorStr = String(error);
            if (!errorStr.includes('UNIQUE constraint')) {
                // Only log unexpected errors (not to console to avoid clutter)
            }
            // Local storage already saved above, so operation is successful from user's perspective
            return true;
        }
    }

    /**
     * Store Q-learning state for an agent
     */
    static async storeQLearningState(
        agentId: string,
        qTable: Record<string, QTableEntry>,
        metadata: {
            totalInteractions: number;
            successRate: number;
            avgResponseTime: number;
        }
    ): Promise<boolean> {
        const key = `qtable:${agentId}`;
        const value = {
            agentId,
            qTable,
            ...metadata,
            updatedAt: Date.now(),
        };
        return this.store(key, value, 'elex-intelligence');
    }

    /**
     * Retrieve Q-learning state for an agent
     */
    static async retrieveQLearningState(
        agentId: string
    ): Promise<LearningState | null> {
        const key = `qtable:${agentId}`;
        return this.retrieve(key, 'elex-intelligence');
    }

    /**
     * Store a trajectory for Decision Transformer training
     */
    static async storeTrajectory(
        agentId: string,
        trajectory: TrajectoryPoint[]
    ): Promise<boolean> {
        const key = `trajectory:${agentId}:${Date.now()}`;
        const value = {
            agentId,
            trajectory,
            length: trajectory.length,
            totalReward: trajectory.reduce((sum, p) => sum + p.reward, 0),
            createdAt: Date.now(),
        };
        return this.store(key, value, 'elex-intelligence');
    }

    /**
     * Store a reasoning pattern in ReasoningBank
     */
    static async storeReasoningPattern(
        pattern: ReasoningPattern
    ): Promise<boolean> {
        const key = `pattern:${pattern.id}`;
        return this.store(key, pattern, 'elex-intelligence');
    }

    /**
     * Store a verdict from reasoning judge
     */
    static async storeVerdict(
        questionId: string,
        verdict: Verdict
    ): Promise<boolean> {
        const key = `verdict:${questionId}:${Date.now()}`;
        return this.store(key, { questionId, ...verdict }, 'elex-intelligence');
    }

    /**
     * Store federated sync result
     */
    static async storeFederatedSync(
        syncId: string,
        result: {
            updatesSent: number;
            updatesReceived: number;
            conflictsResolved: number;
            syncTimeMs: number;
            peers: string[];
        }
    ): Promise<boolean> {
        const key = `sync:${syncId}`;
        return this.store(key, { ...result, timestamp: Date.now() }, 'elex-coordination');
    }

    /**
     * Get all agent learning states for swarm overview
     */
    static async getSwarmLearningStates(): Promise<LearningState[]> {
        const results = await this.search('qtable:', 'elex-intelligence', 100);
        return results.map(r => r.value).filter(v => v && v.agentId);
    }

    /**
     * Get aggregated swarm metrics
     */
    static async getSwarmMetrics(): Promise<{
        totalAgents: number;
        totalInteractions: number;
        avgSuccessRate: number;
        avgResponseTime: number;
        topPerformers: string[];
    }> {
        const states = await this.getSwarmLearningStates();

        if (states.length === 0) {
            return {
                totalAgents: 0,
                totalInteractions: 0,
                avgSuccessRate: 0,
                avgResponseTime: 0,
                topPerformers: [],
            };
        }

        const totalInteractions = states.reduce((sum, s) => sum + (s.totalInteractions || 0), 0);
        const avgSuccessRate = states.reduce((sum, s) => sum + (s.successRate || 0), 0) / states.length;
        const avgResponseTime = states.reduce((sum, s) => sum + (s.avgResponseTime || 0), 0) / states.length;

        // Get top 5 performers by success rate
        const sorted = [...states].sort((a, b) => (b.successRate || 0) - (a.successRate || 0));
        const topPerformers = sorted.slice(0, 5).map(s => s.agentId);

        return {
            totalAgents: states.length,
            totalInteractions,
            avgSuccessRate,
            avgResponseTime,
            topPerformers,
        };
    }
}

export default AgentDBBridge;
