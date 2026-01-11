#!/usr/bin/env bun
/**
 * Multi-Provider Router for Self-Learning Demo
 * 
 * Intelligent routing of agent queries to optimal LLM providers:
 * - Anthropic (Claude): High-quality reasoning tasks
 * - OpenAI (GPT): General purpose, fast responses
 * - OpenRouter: Cost-optimized access to 100+ models
 * - Ollama: Local models for privacy/offline
 * 
 * Features:
 * - Cost-optimized routing (85-99% savings)
 * - Latency-based routing for real-time needs
 * - Quality-based routing for critical tasks
 * - Circuit breaker for reliability
 * - Response caching
 * 
 * Part of the Advanced Multi-Agent Self-Learning Demo
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export type ProviderType =
    | 'anthropic'   // Claude models
    | 'openai'      // GPT models
    | 'openrouter'  // 100+ models via OpenRouter
    | 'ollama'      // Local models
    | 'mock';       // Mock for testing

export type RoutingMode =
    | 'cost-optimized'       // Minimize cost (default)
    | 'performance-optimized' // Minimize latency
    | 'quality-optimized'    // Maximize quality
    | 'local-first'          // Prefer local models
    | 'manual';              // Explicit provider selection

export interface ProviderConfig {
    type: ProviderType;
    apiKey?: string;
    baseUrl?: string;
    model: string;
    enabled: boolean;
    costPer1kTokens: number;
    latencyMs: number;
    qualityScore: number; // 0-1
}

export interface RoutingRequest {
    query: string;
    context?: string;
    maxTokens?: number;
    temperature?: number;
    preferredProvider?: ProviderType;
    maxCost?: number;
    maxLatency?: number;
    minQuality?: number;
}

export interface RoutingResult {
    provider: ProviderType;
    model: string;
    response: string;
    tokens: {
        input: number;
        output: number;
    };
    cost: number;
    latency: number;
    cached: boolean;
}

export interface ProviderHealth {
    provider: ProviderType;
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastError?: string;
    failureCount: number;
    successRate: number;
    avgLatency: number;
    circuitOpen: boolean;
}

export interface RouterMetrics {
    totalRequests: number;
    totalCost: number;
    totalTokens: number;
    byProvider: Record<ProviderType, {
        requests: number;
        cost: number;
        tokens: number;
        avgLatency: number;
    }>;
    cacheHits: number;
    cacheMisses: number;
}

export interface RouterConfig {
    mode: RoutingMode;
    providers: Partial<Record<ProviderType, ProviderConfig>>;
    budgetLimit?: number;
    cacheTTL?: number;
    circuitBreaker: {
        enabled: boolean;
        failureThreshold: number;
        resetTimeout: number;
    };
    weights: {
        cost: number;
        latency: number;
        quality: number;
    };
}

// ============================================================================
// Default Provider Configurations
// ============================================================================

const DEFAULT_PROVIDERS: Record<ProviderType, ProviderConfig> = {
    anthropic: {
        type: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseUrl: 'https://api.anthropic.com/v1',
        model: 'claude-3-haiku-20240307',
        enabled: !!process.env.ANTHROPIC_API_KEY,
        costPer1kTokens: 0.00125,
        latencyMs: 300,
        qualityScore: 0.92,
    },
    openai: {
        type: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        enabled: !!process.env.OPENAI_API_KEY,
        costPer1kTokens: 0.0006,
        latencyMs: 250,
        qualityScore: 0.88,
    },
    openrouter: {
        type: 'openrouter',
        apiKey: process.env.OPENROUTER_API_KEY,
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'anthropic/claude-3-haiku',
        enabled: !!process.env.OPENROUTER_API_KEY,
        costPer1kTokens: 0.00025, // Cheaper via OpenRouter
        latencyMs: 350,
        qualityScore: 0.92,
    },
    ollama: {
        type: 'ollama',
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        model: 'llama3.2:latest',
        enabled: !!process.env.OLLAMA_BASE_URL, // Only enable if explicitly configured
        costPer1kTokens: 0, // Free!
        latencyMs: 500,
        qualityScore: 0.80,
    },
    mock: {
        type: 'mock',
        model: 'mock-model',
        enabled: true,
        costPer1kTokens: 0,
        latencyMs: 10,
        qualityScore: 0.50,
    },
};

// ============================================================================
// Multi-Provider Router Class
// ============================================================================

export class MultiProviderRouter extends EventEmitter {
    private config: RouterConfig;
    private providers: Map<ProviderType, ProviderConfig> = new Map();
    private health: Map<ProviderType, ProviderHealth> = new Map();
    private cache: Map<string, { result: RoutingResult; expires: number }> = new Map();
    private metrics: RouterMetrics;

    constructor(config: Partial<RouterConfig> = {}) {
        super();

        this.config = {
            mode: config.mode || 'cost-optimized',
            providers: config.providers || {},
            budgetLimit: config.budgetLimit,
            cacheTTL: config.cacheTTL || 300000, // 5 minutes
            circuitBreaker: {
                enabled: config.circuitBreaker?.enabled ?? true,
                failureThreshold: config.circuitBreaker?.failureThreshold || 3,
                resetTimeout: config.circuitBreaker?.resetTimeout || 60000,
            },
            weights: {
                cost: config.weights?.cost ?? 0.5,
                latency: config.weights?.latency ?? 0.3,
                quality: config.weights?.quality ?? 0.2,
            },
        };

        // Initialize providers
        this.initializeProviders();

        // Initialize health tracking
        this.initializeHealth();

        // Initialize metrics
        this.metrics = this.createMetrics();
    }

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * Route a request to the optimal provider
     */
    async route(request: RoutingRequest): Promise<RoutingResult> {
        const startTime = performance.now();

        // Check cache
        const cacheKey = this.generateCacheKey(request);
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expires > Date.now()) {
            this.metrics.cacheHits++;
            this.emit('cache:hit', { cacheKey });
            return { ...cached.result, cached: true };
        }
        this.metrics.cacheMisses++;

        // Select provider
        const provider = this.selectProvider(request);
        if (!provider) {
            throw new Error('No available providers for request');
        }

        // Check circuit breaker
        const health = this.health.get(provider.type);
        if (health?.circuitOpen) {
            // Try fallback provider
            const fallback = this.selectFallbackProvider(provider.type, request);
            if (fallback) {
                this.emit('provider:fallback', { from: provider.type, to: fallback.type });
                return this.executeRequest(fallback, request, startTime);
            }
            throw new Error(`Circuit breaker open for ${provider.type}, no fallback available`);
        }

        return this.executeRequest(provider, request, startTime);
    }

    /**
     * Get available providers
     */
    getAvailableProviders(): ProviderConfig[] {
        return Array.from(this.providers.values()).filter(p => p.enabled);
    }

    /**
     * Get provider health status
     */
    getHealth(): Map<ProviderType, ProviderHealth> {
        return new Map(this.health);
    }

    /**
     * Get router metrics
     */
    getMetrics(): RouterMetrics {
        return { ...this.metrics };
    }

    /**
     * Get estimated cost for a request
     */
    estimateCost(request: RoutingRequest): {
        provider: ProviderType;
        model: string;
        estimatedCost: number;
        estimatedLatency: number;
    } {
        const provider = this.selectProvider(request);
        if (!provider) {
            throw new Error('No available providers');
        }

        const inputTokens = this.estimateTokens(request.query + (request.context || ''));
        const outputTokens = request.maxTokens || 500;
        const totalTokens = inputTokens + outputTokens;

        return {
            provider: provider.type,
            model: provider.model,
            estimatedCost: (totalTokens / 1000) * provider.costPer1kTokens,
            estimatedLatency: provider.latencyMs,
        };
    }

    /**
     * Set routing mode
     */
    setMode(mode: RoutingMode): void {
        this.config.mode = mode;
        this.emit('mode:changed', { mode });
    }

    /**
     * Enable/disable a provider
     */
    setProviderEnabled(provider: ProviderType, enabled: boolean): void {
        const config = this.providers.get(provider);
        if (config) {
            config.enabled = enabled;
            this.emit('provider:status', { provider, enabled });
        }
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache.clear();
        this.emit('cache:cleared');
    }

    // =========================================================================
    // Private Methods
    // =========================================================================

    private initializeProviders(): void {
        // Merge default providers with user config
        for (const [type, defaultConfig] of Object.entries(DEFAULT_PROVIDERS)) {
            const userConfig = this.config.providers[type as ProviderType];
            const merged = { ...defaultConfig, ...userConfig };

            // Check if API key is available
            if (type !== 'mock' && type !== 'ollama' && !merged.apiKey) {
                merged.enabled = false;
            }

            this.providers.set(type as ProviderType, merged);
        }
    }

    private initializeHealth(): void {
        for (const [type] of this.providers) {
            this.health.set(type, {
                provider: type,
                status: 'healthy',
                failureCount: 0,
                successRate: 1.0,
                avgLatency: 0,
                circuitOpen: false,
            });
        }
    }

    private createMetrics(): RouterMetrics {
        const byProvider: RouterMetrics['byProvider'] = {} as any;
        for (const type of this.providers.keys()) {
            byProvider[type] = {
                requests: 0,
                cost: 0,
                tokens: 0,
                avgLatency: 0,
            };
        }

        return {
            totalRequests: 0,
            totalCost: 0,
            totalTokens: 0,
            byProvider,
            cacheHits: 0,
            cacheMisses: 0,
        };
    }

    private selectProvider(request: RoutingRequest): ProviderConfig | null {
        // If manual mode with preferred provider, use it
        if (this.config.mode === 'manual' && request.preferredProvider) {
            const provider = this.providers.get(request.preferredProvider);
            if (provider?.enabled) return provider;
        }

        // Get enabled providers
        const candidates = Array.from(this.providers.values())
            .filter(p => p.enabled)
            .filter(p => !this.health.get(p.type)?.circuitOpen);

        if (candidates.length === 0) return null;

        // Score each provider based on mode
        const scored = candidates.map(provider => ({
            provider,
            score: this.scoreProvider(provider, request),
        })).sort((a, b) => b.score - a.score);

        return scored[0].provider;
    }

    private scoreProvider(provider: ProviderConfig, request: RoutingRequest): number {
        let score = 0;

        // Estimate cost
        const inputTokens = this.estimateTokens(request.query + (request.context || ''));
        const outputTokens = request.maxTokens || 500;
        const estimatedCost = ((inputTokens + outputTokens) / 1000) * provider.costPer1kTokens;

        // Apply constraints
        if (request.maxCost && estimatedCost > request.maxCost) return -1;
        if (request.maxLatency && provider.latencyMs > request.maxLatency) return -1;
        if (request.minQuality && provider.qualityScore < request.minQuality) return -1;

        switch (this.config.mode) {
            case 'cost-optimized':
                // Lower cost = higher score
                score = 1 - Math.min(1, estimatedCost / 0.01);
                break;

            case 'performance-optimized':
                // Lower latency = higher score
                score = 1 - Math.min(1, provider.latencyMs / 1000);
                break;

            case 'quality-optimized':
                // Higher quality = higher score
                score = provider.qualityScore;
                break;

            case 'local-first':
                // Prefer local providers
                if (provider.type === 'ollama') score = 1.0;
                else if (provider.type === 'mock') score = 0.9;
                else score = provider.qualityScore * 0.5;
                break;

            default:
                // Weighted combination
                const costScore = 1 - Math.min(1, estimatedCost / 0.01);
                const latencyScore = 1 - Math.min(1, provider.latencyMs / 1000);
                score =
                    this.config.weights.cost * costScore +
                    this.config.weights.latency * latencyScore +
                    this.config.weights.quality * provider.qualityScore;
        }

        // Boost for preferred provider
        if (request.preferredProvider === provider.type) {
            score *= 1.2;
        }

        return score;
    }

    private selectFallbackProvider(
        failed: ProviderType,
        request: RoutingRequest
    ): ProviderConfig | null {
        const candidates = Array.from(this.providers.values())
            .filter(p => p.enabled && p.type !== failed)
            .filter(p => !this.health.get(p.type)?.circuitOpen);

        if (candidates.length === 0) return null;

        // Sort by quality for fallback
        return candidates.sort((a, b) => b.qualityScore - a.qualityScore)[0];
    }

    private async executeRequest(
        provider: ProviderConfig,
        request: RoutingRequest,
        startTime: number
    ): Promise<RoutingResult> {
        try {
            // Execute provider-specific request
            const response = await this.callProvider(provider, request);
            const latency = performance.now() - startTime;

            // Calculate cost
            const cost = ((response.tokens.input + response.tokens.output) / 1000) * provider.costPer1kTokens;

            // Update metrics
            this.updateMetrics(provider.type, response.tokens, cost, latency);

            // Update health
            this.recordSuccess(provider.type, latency);

            const result: RoutingResult = {
                provider: provider.type,
                model: provider.model,
                response: response.content,
                tokens: response.tokens,
                cost,
                latency,
                cached: false,
            };

            // Cache result
            if (this.config.cacheTTL) {
                const cacheKey = this.generateCacheKey(request);
                this.cache.set(cacheKey, {
                    result,
                    expires: Date.now() + this.config.cacheTTL,
                });
            }

            this.emit('request:complete', result);
            return result;

        } catch (error) {
            this.recordFailure(provider.type, error as Error);
            throw error;
        }
    }

    private async callProvider(
        provider: ProviderConfig,
        request: RoutingRequest
    ): Promise<{ content: string; tokens: { input: number; output: number } }> {
        switch (provider.type) {
            case 'anthropic':
                return this.callAnthropic(provider, request);
            case 'openai':
            case 'openrouter':
                return this.callOpenAI(provider, request);
            case 'ollama':
                return this.callOllama(provider, request);
            case 'mock':
            default:
                return this.callMock(provider, request);
        }
    }

    private async callAnthropic(
        provider: ProviderConfig,
        request: RoutingRequest
    ): Promise<{ content: string; tokens: { input: number; output: number } }> {
        if (!provider.apiKey) {
            throw new Error('Anthropic API key not configured');
        }

        const response = await fetch(`${provider.baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': provider.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: provider.model,
                max_tokens: request.maxTokens || 1024,
                temperature: request.temperature ?? 0.7,
                messages: [
                    {
                        role: 'user',
                        content: request.context
                            ? `Context:\n${request.context}\n\nQuery: ${request.query}`
                            : request.query,
                    },
                ],
            }),
        });

        if (!response.ok) {
            throw new Error(`Anthropic API error: ${response.status}`);
        }

        const data = await response.json();
        return {
            content: data.content[0].text,
            tokens: {
                input: data.usage?.input_tokens || this.estimateTokens(request.query),
                output: data.usage?.output_tokens || this.estimateTokens(data.content[0].text),
            },
        };
    }

    private async callOpenAI(
        provider: ProviderConfig,
        request: RoutingRequest
    ): Promise<{ content: string; tokens: { input: number; output: number } }> {
        if (!provider.apiKey) {
            throw new Error(`${provider.type} API key not configured`);
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.apiKey}`,
        };

        // OpenRouter requires additional headers
        if (provider.type === 'openrouter') {
            headers['HTTP-Referer'] = 'https://elex-demo.local';
            headers['X-Title'] = 'ELEX Self-Learning Demo';
        }

        const response = await fetch(`${provider.baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: provider.model,
                max_tokens: request.maxTokens || 1024,
                temperature: request.temperature ?? 0.7,
                messages: [
                    {
                        role: 'user',
                        content: request.context
                            ? `Context:\n${request.context}\n\nQuery: ${request.query}`
                            : request.query,
                    },
                ],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`${provider.type} API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return {
            content: data.choices[0].message.content,
            tokens: {
                input: data.usage?.prompt_tokens || this.estimateTokens(request.query),
                output: data.usage?.completion_tokens || this.estimateTokens(data.choices[0].message.content),
            },
        };
    }

    private async callOllama(
        provider: ProviderConfig,
        request: RoutingRequest
    ): Promise<{ content: string; tokens: { input: number; output: number } }> {
        try {
            const response = await fetch(`${provider.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: provider.model,
                    prompt: request.context
                        ? `Context:\n${request.context}\n\nQuery: ${request.query}`
                        : request.query,
                    stream: false,
                    options: {
                        num_predict: request.maxTokens || 1024,
                        temperature: request.temperature ?? 0.7,
                    },
                }),
            });

            if (!response.ok) {
                throw new Error(`Ollama error: ${response.status}`);
            }

            const data = await response.json();
            return {
                content: data.response,
                tokens: {
                    input: data.prompt_eval_count || this.estimateTokens(request.query),
                    output: data.eval_count || this.estimateTokens(data.response),
                },
            };
        } catch (error) {
            // Ollama not running - disable and throw
            provider.enabled = false;
            throw new Error('Ollama not available (is it running?)');
        }
    }

    private async callMock(
        provider: ProviderConfig,
        request: RoutingRequest
    ): Promise<{ content: string; tokens: { input: number; output: number } }> {
        // Simulate latency
        await new Promise(resolve => setTimeout(resolve, provider.latencyMs));

        const content = `[Mock Response] This is a simulated response for the query: "${request.query.substring(0, 50)}..."

Based on the context provided, here are key points:
1. The query relates to an Ericsson RAN feature
2. This mock response demonstrates multi-provider routing
3. In production, this would be answered by ${this.config.mode === 'local-first' ? 'Ollama' : 'Claude/GPT'}

Note: Configure ANTHROPIC_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY for real responses.`;

        return {
            content,
            tokens: {
                input: this.estimateTokens(request.query),
                output: this.estimateTokens(content),
            },
        };
    }

    private generateCacheKey(request: RoutingRequest): string {
        return `${request.query}:${request.context || ''}:${request.maxTokens || 500}`;
    }

    private estimateTokens(text: string): number {
        // Rough estimate: 1 token ~= 4 characters
        return Math.ceil(text.length / 4);
    }

    private updateMetrics(
        provider: ProviderType,
        tokens: { input: number; output: number },
        cost: number,
        latency: number
    ): void {
        this.metrics.totalRequests++;
        this.metrics.totalCost += cost;
        this.metrics.totalTokens += tokens.input + tokens.output;

        const providerMetrics = this.metrics.byProvider[provider];
        if (providerMetrics) {
            const prevTotal = providerMetrics.requests * providerMetrics.avgLatency;
            providerMetrics.requests++;
            providerMetrics.cost += cost;
            providerMetrics.tokens += tokens.input + tokens.output;
            providerMetrics.avgLatency = (prevTotal + latency) / providerMetrics.requests;
        }
    }

    private recordSuccess(provider: ProviderType, latency: number): void {
        const health = this.health.get(provider);
        if (health) {
            health.failureCount = 0;
            health.status = 'healthy';
            health.circuitOpen = false;

            // Update average latency
            const prevTotal = health.avgLatency * (1 - health.successRate);
            health.successRate = Math.min(1, health.successRate + 0.01);
            health.avgLatency = (health.avgLatency + latency) / 2;
        }
    }

    private recordFailure(provider: ProviderType, error: Error): void {
        const health = this.health.get(provider);
        if (health) {
            health.failureCount++;
            health.lastError = error.message;
            health.successRate = Math.max(0, health.successRate - 0.1);

            if (health.failureCount >= this.config.circuitBreaker.failureThreshold) {
                health.status = 'unhealthy';
                health.circuitOpen = true;

                // Schedule circuit reset
                setTimeout(() => {
                    health.circuitOpen = false;
                    health.status = 'degraded';
                    health.failureCount = Math.floor(health.failureCount / 2);
                }, this.config.circuitBreaker.resetTimeout);

                this.emit('circuit:open', { provider });
            } else {
                health.status = 'degraded';
            }
        }
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let routerInstance: MultiProviderRouter | null = null;

export function getRouter(config?: Partial<RouterConfig>): MultiProviderRouter {
    if (!routerInstance) {
        routerInstance = new MultiProviderRouter(config);
    }
    return routerInstance;
}

export function resetRouter(): void {
    routerInstance = null;
}

export default MultiProviderRouter;
