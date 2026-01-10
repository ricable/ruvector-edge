/**
 * ELEX Edge AI Agent Swarm - Agent Factory
 *
 * Factory for creating specialized agents by FAJ code.
 * Handles dependency injection and configuration.
 */

import { Agent, type AgentDependencies } from './Agent.js';
import { AgentRegistry } from './AgentRegistry.js';
import type { FeatureCatalog } from '../knowledge/FeatureCatalog.js';
import { VectorMemory } from '../memory/VectorMemory.js';
import { QTable } from '../learning/QTable.js';
import { TrajectoryBuffer } from '../learning/TrajectoryBuffer.js';
import type {
  FAJCode,
  AgentConfig,
  AgentId,
} from '../types/index.js';
import {
  AgentType,
  Category,
  AccessTechnology,
  createAgentId,
} from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Factory configuration
 */
export interface AgentFactoryConfig {
  defaultEmbeddingDimension?: number;
  defaultMaxMemoryVectors?: number;
  defaultQLearningConfig?: {
    gamma?: number;
    alpha?: number;
    epsilon?: number;
    maxTrajectories?: number;
  };
}

/**
 * Internal config with required fields (after defaults applied)
 */
interface InternalFactoryConfig {
  defaultEmbeddingDimension: number;
  defaultMaxMemoryVectors: number;
  defaultQLearningConfig: {
    gamma: number;
    alpha: number;
    epsilon: number;
    maxTrajectories: number;
  };
}

/**
 * Agent creation result
 */
export interface AgentCreationResult {
  agent: Agent;
  initialized: boolean;
  error?: Error;
}

/**
 * Batch creation result
 */
export interface BatchCreationResult {
  created: Agent[];
  failed: Array<{ fajCode: FAJCode; error: Error }>;
  total: number;
  successCount: number;
  failureCount: number;
}

/**
 * Agent Factory
 *
 * Creates and initializes specialized agents with proper dependency injection.
 */
export class AgentFactory {
  private readonly config: InternalFactoryConfig;
  private readonly featureCatalog: FeatureCatalog;
  private readonly registry: AgentRegistry;

  constructor(
    featureCatalog: FeatureCatalog,
    registry: AgentRegistry,
    config: AgentFactoryConfig = {}
  ) {
    this.featureCatalog = featureCatalog;
    this.registry = registry;

    // Set defaults
    this.config = {
      defaultEmbeddingDimension: config.defaultEmbeddingDimension ?? 128,
      defaultMaxMemoryVectors: config.defaultMaxMemoryVectors ?? 10000,
      defaultQLearningConfig: {
        gamma: config.defaultQLearningConfig?.gamma ?? 0.95,
        alpha: config.defaultQLearningConfig?.alpha ?? 0.1,
        epsilon: config.defaultQLearningConfig?.epsilon ?? 0.1,
        maxTrajectories: config.defaultQLearningConfig?.maxTrajectories ?? 1000,
      },
    };
  }

  /**
   * Create an agent for a specific FAJ code
   */
  async createAgent(fajCode: FAJCode): Promise<AgentCreationResult> {
    try {
      // Get feature definition
      const feature = this.featureCatalog.getByFajCode(fajCode);
      if (!feature) {
        throw new Error(`Feature not found for FAJ code: ${fajCode}`);
      }

      // Check if agent already exists
      if (this.registry.hasFajCode(fajCode)) {
        throw new Error(`Agent already exists for FAJ code: ${fajCode}`);
      }

      // Determine agent type and category
      const type = this.determineAgentType(feature.accessTechnology);
      const category = feature.category;

      // Create dependencies
      const deps = this.createDependencies();

      // Create agent configuration
      const agentConfig: AgentConfig = {
        id: createAgentId(uuidv4()),
        fajCode,
        type,
        category,
        maxMemoryVectors: this.config.defaultMaxMemoryVectors,
        embeddingDimension: this.config.defaultEmbeddingDimension,
        qLearningConfig: {
          gamma: this.config.defaultQLearningConfig.gamma,
          alpha: this.config.defaultQLearningConfig.alpha,
          epsilon: this.config.defaultQLearningConfig.epsilon,
          maxTrajectories: this.config.defaultQLearningConfig.maxTrajectories,
        },
      };

      // Create agent
      const agent = new Agent(agentConfig, deps);

      // Initialize agent with feature knowledge
      await agent.initialize(feature);

      // Register agent
      this.registry.register(agent);

      return {
        agent,
        initialized: true,
      };
    } catch (error) {
      return {
        agent: null as never,
        initialized: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Create agents for multiple FAJ codes
   */
  async createAgents(fajCodes: FAJCode[]): Promise<BatchCreationResult> {
    const result: BatchCreationResult = {
      created: [],
      failed: [],
      total: fajCodes.length,
      successCount: 0,
      failureCount: 0,
    };

    // Create agents in parallel batches for better performance
    const batchSize = 50;
    for (let i = 0; i < fajCodes.length; i += batchSize) {
      const batch = fajCodes.slice(i, i + batchSize);
      const promises = batch.map(fajCode => this.createAgent(fajCode));
      const results = await Promise.all(promises);

      for (let j = 0; j < results.length; j++) {
        const { agent, initialized, error } = results[j];
        const fajCode = batch[j];

        if (initialized && agent) {
          result.created.push(agent);
          result.successCount++;
        } else {
          result.failed.push({
            fajCode,
            error: error ?? new Error('Unknown error'),
          });
          result.failureCount++;
        }
      }
    }

    return result;
  }

  /**
   * Create all agents from the feature catalog
   */
  async createAllAgents(): Promise<BatchCreationResult> {
    const allFajCodes = this.featureCatalog.getAllFajCodes();
    return this.createAgents(allFajCodes);
  }

  /**
   * Create agents for a specific category
   */
  async createAgentsByCategory(category: Category): Promise<BatchCreationResult> {
    const features = this.featureCatalog.getByCategory(category);
    const fajCodes = features.map(f => f.fajCode);
    return this.createAgents(fajCodes);
  }

  /**
   * Create agents for a specific access technology
   */
  async createAgentsByTechnology(technology: AccessTechnology): Promise<BatchCreationResult> {
    const features = this.featureCatalog.getByAccessTechnology(technology);
    const fajCodes = features.map(f => f.fajCode);
    return this.createAgents(fajCodes);
  }

  /**
   * Create LTE agents (307 total)
   */
  async createLTEAgents(): Promise<BatchCreationResult> {
    return this.createAgentsByTechnology(AccessTechnology.LTE);
  }

  /**
   * Create NR/5G agents (284 total)
   */
  async createNRAgents(): Promise<BatchCreationResult> {
    return this.createAgentsByTechnology(AccessTechnology.NR);
  }

  /**
   * Create Cross-RAT agents (2 total)
   */
  async createCrossRATAgents(): Promise<BatchCreationResult> {
    return this.createAgentsByTechnology(AccessTechnology.CrossRAT);
  }

  /**
   * Get an existing agent or create a new one
   */
  async getOrCreateAgent(fajCode: FAJCode): Promise<Agent> {
    const existing = this.registry.getByFajCode(fajCode);
    if (existing) {
      return existing;
    }

    const result = await this.createAgent(fajCode);
    if (!result.initialized || !result.agent) {
      throw result.error ?? new Error(`Failed to create agent for ${fajCode}`);
    }

    return result.agent;
  }

  /**
   * Destroy an agent and unregister it
   */
  async destroyAgent(agentId: AgentId): Promise<boolean> {
    const agent = this.registry.getById(agentId);
    if (!agent) {
      return false;
    }

    await agent.shutdown();
    return this.registry.unregister(agentId);
  }

  /**
   * Destroy all agents
   */
  async destroyAllAgents(): Promise<void> {
    await this.registry.shutdownAll();
    this.registry.clear();
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  /**
   * Create agent dependencies
   */
  private createDependencies(): AgentDependencies {
    const vectorMemory = new VectorMemory({
      maxVectors: this.config.defaultMaxMemoryVectors,
      dimension: this.config.defaultEmbeddingDimension,
    });

    const qTable = new QTable({
      gamma: this.config.defaultQLearningConfig.gamma,
      alpha: this.config.defaultQLearningConfig.alpha,
      epsilon: this.config.defaultQLearningConfig.epsilon,
    });

    const trajectoryBuffer = new TrajectoryBuffer({
      maxTrajectories: this.config.defaultQLearningConfig.maxTrajectories,
    });

    return {
      vectorMemory,
      qTable,
      trajectoryBuffer,
      peerResolver: this.registry.createPeerResolver(),
    };
  }

  /**
   * Determine agent type from access technology
   */
  private determineAgentType(technology: AccessTechnology): AgentType {
    switch (technology) {
      case AccessTechnology.LTE:
        return AgentType.LTE;
      case AccessTechnology.NR:
        return AgentType.NR;
      case AccessTechnology.CrossRAT:
        return AgentType.CrossRAT;
      case AccessTechnology.GSM:
        return AgentType.LTE; // Fallback
      default:
        return AgentType.LTE;
    }
  }
}

/**
 * Create a pre-configured factory with a feature catalog
 */
export function createAgentFactory(
  featureCatalog: FeatureCatalog,
  registry?: AgentRegistry,
  config?: AgentFactoryConfig
): AgentFactory {
  return new AgentFactory(
    featureCatalog,
    registry ?? new AgentRegistry(),
    config
  );
}
