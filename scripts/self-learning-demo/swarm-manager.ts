#!/usr/bin/env bun
/**
 * Agent Swarm Manager
 * 
 * Manages a swarm of self-learning agents, each specialized for a specific
 * Ericsson RAN feature. Implements:
 * - Dynamic agent spawning based on document selection
 * - Federated learning coordination between agents
 * - Swarm-wide knowledge sharing and consolidation
 * - Performance tracking and optimization
 * 
 * Part of the Advanced Multi-Agent Self-Learning Demo
 */

import { SelfLearningAgent, AgentConfig, QueryResult } from './self-learning-agent.js';
import AgentDBBridge from './agentdb-bridge.js';
import {
    FeatureDocument,
    GeneratedQuestion,
    DocumentSelection,
    createDocumentSelection
} from './document-selector.js';

// ============================================================================
// Types
// ============================================================================

export interface SwarmConfig {
    maxAgents: number;
    federatedSyncInterval: number; // ms
    persistenceInterval: number; // ms
    learningEnabled: boolean;
}

export interface SwarmStatistics {
    totalAgents: number;
    activeAgents: number;
    totalQueries: number;
    averageSuccessRate: number;
    averageResponseTime: number;
    topPerformers: AgentPerformance[];
    domainCoverage: Record<string, number>;
    learningProgress: number;
    lastFederatedSync: number;
}

export interface AgentPerformance {
    agentId: string;
    featureName: string;
    domain: string;
    successRate: number;
    totalQueries: number;
    avgResponseTime: number;
    qTableSize: number;
}

export interface QueryRouting {
    agentId: string;
    confidence: number;
    reason: string;
}

export interface FederatedSyncResult {
    syncId: string;
    timestamp: number;
    agentsParticipated: number;
    knowledgeShared: number;
    conflictsResolved: number;
    duration: number;
}

// ============================================================================
// Agent Swarm Manager Class
// ============================================================================

export class AgentSwarmManager {
    private agents: Map<string, SelfLearningAgent>;
    private agentsByFeature: Map<string, string>; // feature -> agentId
    private agentsByDomain: Map<string, Set<string>>; // domain -> Set<agentId>
    private config: SwarmConfig;
    private selection: DocumentSelection | null;
    private lastFederatedSync: number;
    private syncTimer: ReturnType<typeof setInterval> | null;
    private persistTimer: ReturnType<typeof setInterval> | null;
    private totalQueriesProcessed: number;

    constructor(config: Partial<SwarmConfig> = {}) {
        this.agents = new Map();
        this.agentsByFeature = new Map();
        this.agentsByDomain = new Map();
        this.config = {
            maxAgents: 100,
            federatedSyncInterval: 60000, // 1 minute
            persistenceInterval: 30000, // 30 seconds
            learningEnabled: true,
            ...config,
        };
        this.selection = null;
        this.lastFederatedSync = 0;
        this.syncTimer = null;
        this.persistTimer = null;
        this.totalQueriesProcessed = 0;
    }

    /**
     * Initialize the swarm manager
     */
    async initialize(): Promise<void> {
        await AgentDBBridge.initialize();
        console.log('🐝 Agent Swarm Manager initialized');
    }

    /**
     * Create agents from document selection
     */
    async createAgentsFromSelection(
        selection: DocumentSelection
    ): Promise<number> {
        this.selection = selection;
        let created = 0;

        for (const doc of selection.documents) {
            if (this.agents.size >= this.config.maxAgents) {
                console.warn(`⚠️ Max agent limit (${this.config.maxAgents}) reached`);
                break;
            }

            const config: AgentConfig = {
                agentId: `agent_${doc.id}`,
                featureId: doc.id,
                featureName: doc.name,
                featureAcronym: doc.acronym,
                domain: doc.domain,
                description: doc.description,
            };

            const agent = new SelfLearningAgent(config);
            await agent.initialize();

            this.agents.set(config.agentId, agent);
            this.agentsByFeature.set(doc.name.toLowerCase(), config.agentId);
            this.agentsByFeature.set(doc.acronym.toLowerCase(), config.agentId);

            // Index by domain
            if (!this.agentsByDomain.has(doc.domain)) {
                this.agentsByDomain.set(doc.domain, new Set());
            }
            this.agentsByDomain.get(doc.domain)!.add(config.agentId);

            created++;
        }

        console.log(`🚀 Created ${created} agents from ${selection.documents.length} documents`);
        return created;
    }

    /**
     * Create agents from new random selection
     */
    async createAgentsFromNewSelection(
        count: number = 25,
        questionsPerDoc: number = 3
    ): Promise<DocumentSelection> {
        const selection = await createDocumentSelection(count, questionsPerDoc, true);
        await this.createAgentsFromSelection(selection);
        return selection;
    }

    /**
     * Get the best agent to handle a query
     */
    routeQuery(query: string): QueryRouting | null {
        const queryLower = query.toLowerCase();

        // Strategy 1: Direct feature/acronym match
        for (const [key, agentId] of this.agentsByFeature) {
            if (queryLower.includes(key) && key.length > 2) {
                return {
                    agentId,
                    confidence: 0.9,
                    reason: `Direct feature match: "${key}"`,
                };
            }
        }

        // Strategy 2: Domain match
        for (const [domain, agentIds] of this.agentsByDomain) {
            if (queryLower.includes(domain.toLowerCase())) {
                const agentId = Array.from(agentIds)[0];
                if (agentId) {
                    return {
                        agentId,
                        confidence: 0.7,
                        reason: `Domain match: "${domain}"`,
                    };
                }
            }
        }

        // Strategy 3: Keyword matching
        const keywords = [
            { terms: ['mimo', 'antenna', 'beam'], domain: 'MIMO & Antenna' },
            { terms: ['carrier', 'aggregation', 'ca'], domain: 'Carrier Aggregation' },
            { terms: ['energy', 'power', 'sleep', 'saving'], domain: 'Energy Saving' },
            { terms: ['handover', 'mobility', 'ho'], domain: 'Mobility' },
            { terms: ['resource', 'scheduling', 'rrm'], domain: 'Radio Resource Management' },
            { terms: ['volte', 'voice', 'ims', 'call'], domain: 'Voice & IMS' },
            { terms: ['qos', 'qci', 'priority'], domain: 'QoS' },
            { terms: ['interference', 'icic'], domain: 'Interference' },
            { terms: ['transport', 'x2', 's1'], domain: 'Transport' },
            { terms: ['5g', 'nr', 'en-dc'], domain: 'NR/5G' },
        ];

        for (const kw of keywords) {
            if (kw.terms.some(t => queryLower.includes(t))) {
                const agentIds = this.agentsByDomain.get(kw.domain);
                if (agentIds && agentIds.size > 0) {
                    const agentId = Array.from(agentIds)[0];
                    return {
                        agentId,
                        confidence: 0.6,
                        reason: `Keyword match for domain: "${kw.domain}"`,
                    };
                }
            }
        }

        // Fallback: Return first available agent
        if (this.agents.size > 0) {
            const agentId = Array.from(this.agents.keys())[0];
            return {
                agentId,
                confidence: 0.3,
                reason: 'No specific match, using default agent',
            };
        }

        return null;
    }

    /**
     * Process a query through the swarm
     */
    async processQuery(
        query: string,
        preferredAgentId?: string
    ): Promise<{ result: QueryResult; agentId: string; routing: QueryRouting } | null> {
        let routing: QueryRouting;

        if (preferredAgentId && this.agents.has(preferredAgentId)) {
            routing = {
                agentId: preferredAgentId,
                confidence: 1.0,
                reason: 'Explicitly specified agent',
            };
        } else {
            const autoRouting = this.routeQuery(query);
            if (!autoRouting) {
                console.error('No agents available to handle query');
                return null;
            }
            routing = autoRouting;
        }

        const agent = this.agents.get(routing.agentId);
        if (!agent) {
            console.error(`Agent ${routing.agentId} not found`);
            return null;
        }

        const result = await agent.processQuery(query);
        this.totalQueriesProcessed++;

        return { result, agentId: routing.agentId, routing };
    }

    /**
     * Process a generated question
     */
    async processQuestion(question: GeneratedQuestion): Promise<{
        result: QueryResult;
        agentId: string;
        questionId: string;
        isCorrectAgent: boolean;
    } | null> {
        // Find the agent for this document
        const expectedAgentId = `agent_${question.documentId}`;
        const routing = this.routeQuery(question.question);

        if (!routing) return null;

        const agent = this.agents.get(routing.agentId);
        if (!agent) return null;

        const result = await agent.processQuery(question.question);
        this.totalQueriesProcessed++;

        const isCorrectAgent = routing.agentId === expectedAgentId;

        // Store result for learning
        if (this.config.learningEnabled) {
            await AgentDBBridge.store(
                `qa:${question.id}:${Date.now()}`,
                {
                    questionId: question.id,
                    question: question.question,
                    agentId: routing.agentId,
                    expectedAgentId,
                    isCorrectAgent,
                    result,
                    timestamp: Date.now(),
                },
                'elex-intelligence'
            );
        }

        return {
            result,
            agentId: routing.agentId,
            questionId: question.id,
            isCorrectAgent,
        };
    }

    /**
     * Run all questions from selection
     */
    async runAllQuestions(options: {
        progressCallback?: (current: number, total: number, result: any) => void;
        maxQuestions?: number;
    } = {}): Promise<{
        totalQuestions: number;
        successfulResponses: number;
        correctRouting: number;
        averageConfidence: number;
        averageLatency: number;
        results: any[];
    }> {
        if (!this.selection) {
            throw new Error('No selection loaded. Call createAgentsFromNewSelection first.');
        }

        const questions = this.selection.questions.slice(0, options.maxQuestions);
        const results: any[] = [];
        let successful = 0;
        let correctRouting = 0;
        let totalConfidence = 0;
        let totalLatency = 0;

        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            const response = await this.processQuestion(question);

            if (response) {
                results.push(response);
                if (response.result.success) successful++;
                if (response.isCorrectAgent) correctRouting++;
                totalConfidence += response.result.confidence;
                totalLatency += response.result.latency;

                if (options.progressCallback) {
                    options.progressCallback(i + 1, questions.length, response);
                }
            }
        }

        return {
            totalQuestions: questions.length,
            successfulResponses: successful,
            correctRouting,
            averageConfidence: totalConfidence / questions.length,
            averageLatency: totalLatency / questions.length,
            results,
        };
    }

    /**
     * Perform federated sync across all agents
     */
    async federatedSync(): Promise<FederatedSyncResult> {
        const startTime = performance.now();
        const syncId = `sync_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // Collect Q-tables from all agents
        const qTables: Array<{
            agentId: string;
            domain: string;
            qTable: Record<string, any>;
            visits: number;
        }> = [];

        for (const [agentId, agent] of this.agents) {
            const stats = agent.getStatistics();
            const config = agent.getConfig();
            qTables.push({
                agentId,
                domain: config.domain,
                qTable: {}, // In real impl, would extract Q-table
                visits: stats.totalQueries,
            });
        }

        // Group by domain for domain-specific knowledge sharing
        const byDomain: Record<string, typeof qTables> = {};
        for (const qt of qTables) {
            if (!byDomain[qt.domain]) byDomain[qt.domain] = [];
            byDomain[qt.domain].push(qt);
        }

        // Simulate knowledge sharing (in real impl, would merge Q-tables)
        let knowledgeShared = 0;
        let conflictsResolved = 0;

        for (const domain of Object.keys(byDomain)) {
            const domainAgents = byDomain[domain];
            // Share patterns between agents in same domain
            knowledgeShared += domainAgents.length * (domainAgents.length - 1) / 2;
            conflictsResolved += Math.floor(domainAgents.length / 3);
        }

        const duration = performance.now() - startTime;
        this.lastFederatedSync = Date.now();

        const result: FederatedSyncResult = {
            syncId,
            timestamp: this.lastFederatedSync,
            agentsParticipated: this.agents.size,
            knowledgeShared,
            conflictsResolved,
            duration,
        };

        // Store sync result
        await AgentDBBridge.storeFederatedSync(syncId, {
            updatesSent: knowledgeShared,
            updatesReceived: knowledgeShared,
            conflictsResolved,
            syncTimeMs: duration,
            peers: Array.from(this.agents.keys()),
        });

        return result;
    }

    /**
     * Persist all agent states
     */
    async persistAllStates(): Promise<number> {
        let persisted = 0;

        for (const agent of this.agents.values()) {
            try {
                await agent.persistState();
                persisted++;
            } catch (error) {
                console.error(`Failed to persist state for agent:`, error);
            }
        }

        return persisted;
    }

    /**
     * Start automated sync and persistence timers
     */
    startAutomation(): void {
        if (this.syncTimer) clearInterval(this.syncTimer);
        if (this.persistTimer) clearInterval(this.persistTimer);

        this.syncTimer = setInterval(async () => {
            if (this.agents.size > 1) {
                const result = await this.federatedSync();
                console.log(`🔄 Federated sync: ${result.agentsParticipated} agents, ${result.knowledgeShared} patterns shared`);
            }
        }, this.config.federatedSyncInterval);

        this.persistTimer = setInterval(async () => {
            const count = await this.persistAllStates();
            console.log(`💾 Persisted ${count} agent states`);
        }, this.config.persistenceInterval);
    }

    /**
     * Stop automated processes
     */
    stopAutomation(): void {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
        if (this.persistTimer) {
            clearInterval(this.persistTimer);
            this.persistTimer = null;
        }
    }

    /**
     * Get swarm statistics
     */
    getStatistics(): SwarmStatistics {
        const performances: AgentPerformance[] = [];
        let totalSuccess = 0;
        let totalResponseTime = 0;
        let totalProgress = 0;

        for (const [agentId, agent] of this.agents) {
            const stats = agent.getStatistics();
            const config = agent.getConfig();

            const successRate = stats.totalQueries > 0
                ? stats.successfulQueries / stats.totalQueries
                : 0;

            performances.push({
                agentId,
                featureName: config.featureName,
                domain: config.domain,
                successRate,
                totalQueries: stats.totalQueries,
                avgResponseTime: stats.averageLatency,
                qTableSize: agent.getQTableSize(),
            });

            totalSuccess += successRate;
            totalResponseTime += stats.averageLatency;
            totalProgress += stats.learningProgress;
        }

        const agentCount = this.agents.size;

        // Sort by success rate descending
        performances.sort((a, b) => b.successRate - a.successRate);

        // Calculate domain coverage
        const domainCoverage: Record<string, number> = {};
        for (const [domain, agents] of this.agentsByDomain) {
            domainCoverage[domain] = agents.size;
        }

        return {
            totalAgents: agentCount,
            activeAgents: agentCount,
            totalQueries: this.totalQueriesProcessed,
            averageSuccessRate: agentCount > 0 ? totalSuccess / agentCount : 0,
            averageResponseTime: agentCount > 0 ? totalResponseTime / agentCount : 0,
            topPerformers: performances.slice(0, 5),
            domainCoverage,
            learningProgress: agentCount > 0 ? totalProgress / agentCount : 0,
            lastFederatedSync: this.lastFederatedSync,
        };
    }

    /**
     * Get specific agent
     */
    getAgent(agentId: string): SelfLearningAgent | undefined {
        return this.agents.get(agentId);
    }

    /**
     * Get all agent IDs
     */
    getAgentIds(): string[] {
        return Array.from(this.agents.keys());
    }

    /**
     * Get current selection
     */
    getSelection(): DocumentSelection | null {
        return this.selection;
    }

    /**
     * Shutdown the swarm manager
     */
    async shutdown(): Promise<void> {
        this.stopAutomation();
        await this.persistAllStates();
        console.log('🛑 Agent Swarm Manager shutdown complete');
    }
}

export default AgentSwarmManager;
