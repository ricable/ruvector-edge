/**
 * ELEX Edge AI Agent Swarm - Agent Registry
 *
 * Central registry for managing 593 specialized feature agents.
 * Provides O(1) lookup by agent ID and FAJ code.
 */

import type { Agent, PeerAgent } from './Agent.js';
import type {
  AgentId,
  FAJCode,
  HealthScore,
  Query,
  Response,
} from '../types/index.js';
import { AgentStatus, Category, AgentType } from '../types/index.js';

/**
 * Registry statistics
 */
export interface RegistryStats {
  totalAgents: number;
  readyAgents: number;
  busyAgents: number;
  offlineAgents: number;
  errorAgents: number;
  byCategory: Record<Category, number>;
  byType: Record<AgentType, number>;
  averageHealth: HealthScore;
}

/**
 * Agent filter criteria
 */
export interface AgentFilter {
  status?: AgentStatus;
  category?: Category;
  type?: AgentType;
  minHealth?: HealthScore;
  maxAgents?: number;
}

/**
 * Agent Registry
 *
 * Manages the full population of 593 specialized agents with:
 * - O(1) lookup by ID and FAJ code
 * - Category-based filtering
 * - Health monitoring
 * - Peer resolution for agent consultation
 */
export class AgentRegistry {
  // Primary storage: AgentId -> Agent
  private readonly agents = new Map<AgentId, Agent>();

  // Index: FAJCode string -> AgentId
  private readonly fajCodeIndex = new Map<string, AgentId>();

  // Index: Category -> Set<AgentId>
  private readonly categoryIndex = new Map<Category, Set<AgentId>>();

  // Index: AgentType -> Set<AgentId>
  private readonly typeIndex = new Map<AgentType, Set<AgentId>>();

  constructor() {
    // Initialize category index
    for (const category of Object.values(Category)) {
      this.categoryIndex.set(category, new Set());
    }

    // Initialize type index
    for (const type of Object.values(AgentType)) {
      this.typeIndex.set(type, new Set());
    }
  }

  /**
   * Register a new agent in the registry
   */
  register(agent: Agent): void {
    // Check for duplicates
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent already registered: ${agent.id}`);
    }

    const fajKey = agent.fajCode.toString();
    if (this.fajCodeIndex.has(fajKey)) {
      throw new Error(`Agent with FAJ code already registered: ${fajKey}`);
    }

    // Register in primary storage
    this.agents.set(agent.id, agent);

    // Update indices
    this.fajCodeIndex.set(fajKey, agent.id);

    const categorySet = this.categoryIndex.get(agent.category);
    if (categorySet) {
      categorySet.add(agent.id);
    }

    const typeSet = this.typeIndex.get(agent.type);
    if (typeSet) {
      typeSet.add(agent.id);
    }
  }

  /**
   * Unregister an agent from the registry
   */
  unregister(agentId: AgentId): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    // Remove from primary storage
    this.agents.delete(agentId);

    // Update indices
    this.fajCodeIndex.delete(agent.fajCode.toString());

    const categorySet = this.categoryIndex.get(agent.category);
    if (categorySet) {
      categorySet.delete(agentId);
    }

    const typeSet = this.typeIndex.get(agent.type);
    if (typeSet) {
      typeSet.delete(agentId);
    }

    return true;
  }

  /**
   * Get agent by ID - O(1)
   */
  getById(agentId: AgentId): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get agent by FAJ code - O(1)
   */
  getByFajCode(fajCode: FAJCode): Agent | undefined {
    const agentId = this.fajCodeIndex.get(fajCode.toString());
    if (!agentId) {
      return undefined;
    }
    return this.agents.get(agentId);
  }

  /**
   * Check if an agent exists
   */
  has(agentId: AgentId): boolean {
    return this.agents.has(agentId);
  }

  /**
   * Check if a FAJ code is registered
   */
  hasFajCode(fajCode: FAJCode): boolean {
    return this.fajCodeIndex.has(fajCode.toString());
  }

  /**
   * Get all agents matching a filter
   */
  filter(criteria: AgentFilter): Agent[] {
    let candidates: Set<AgentId>;

    // Start with category or type filter if specified (smaller sets)
    if (criteria.category) {
      candidates = this.categoryIndex.get(criteria.category) ?? new Set();
    } else if (criteria.type) {
      candidates = this.typeIndex.get(criteria.type) ?? new Set();
    } else {
      candidates = new Set(this.agents.keys());
    }

    // Filter candidates
    const results: Agent[] = [];
    for (const agentId of candidates) {
      if (criteria.maxAgents && results.length >= criteria.maxAgents) {
        break;
      }

      const agent = this.agents.get(agentId);
      if (!agent) continue;

      // Apply filters
      if (criteria.status && agent.status !== criteria.status) continue;
      if (criteria.type && agent.type !== criteria.type) continue;
      if (criteria.category && agent.category !== criteria.category) continue;
      if (criteria.minHealth !== undefined && agent.health < criteria.minHealth) continue;

      results.push(agent);
    }

    return results;
  }

  /**
   * Get all agents by category
   */
  getByCategory(category: Category): Agent[] {
    const agentIds = this.categoryIndex.get(category);
    if (!agentIds) {
      return [];
    }

    return Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter((agent): agent is Agent => agent !== undefined);
  }

  /**
   * Get all agents by type
   */
  getByType(type: AgentType): Agent[] {
    const agentIds = this.typeIndex.get(type);
    if (!agentIds) {
      return [];
    }

    return Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter((agent): agent is Agent => agent !== undefined);
  }

  /**
   * Get all ready agents
   */
  getReadyAgents(): Agent[] {
    return this.filter({ status: AgentStatus.Ready });
  }

  /**
   * Get all registered agents
   */
  getAll(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get total number of registered agents
   */
  get size(): number {
    return this.agents.size;
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const stats: RegistryStats = {
      totalAgents: this.agents.size,
      readyAgents: 0,
      busyAgents: 0,
      offlineAgents: 0,
      errorAgents: 0,
      byCategory: {} as Record<Category, number>,
      byType: {} as Record<AgentType, number>,
      averageHealth: 0,
    };

    // Initialize category counts
    for (const category of Object.values(Category)) {
      stats.byCategory[category] = 0;
    }

    // Initialize type counts
    for (const type of Object.values(AgentType)) {
      stats.byType[type] = 0;
    }

    let totalHealth = 0;

    for (const agent of this.agents.values()) {
      // Count by status
      switch (agent.status) {
        case AgentStatus.Ready:
          stats.readyAgents++;
          break;
        case AgentStatus.Busy:
          stats.busyAgents++;
          break;
        case AgentStatus.Offline:
          stats.offlineAgents++;
          break;
        case AgentStatus.Error:
          stats.errorAgents++;
          break;
      }

      // Count by category
      stats.byCategory[agent.category]++;

      // Count by type
      stats.byType[agent.type]++;

      // Accumulate health
      totalHealth += agent.health;
    }

    // Calculate average health
    stats.averageHealth = this.agents.size > 0
      ? totalHealth / this.agents.size
      : 0;

    return stats;
  }

  /**
   * Create a peer resolver function for agent consultation
   */
  createPeerResolver(): (peerId: AgentId) => Promise<PeerAgent | null> {
    return async (peerId: AgentId): Promise<PeerAgent | null> => {
      const agent = this.getById(peerId);
      if (!agent || agent.status !== AgentStatus.Ready) {
        return null;
      }

      return {
        id: agent.id,
        fajCode: agent.fajCode,
        handleQuery: async (query: Query): Promise<Response> => {
          return agent.handleQuery(query);
        },
      };
    };
  }

  /**
   * Find agents related to a given agent (by related features)
   */
  findRelatedAgents(agentId: AgentId): Agent[] {
    const agent = this.getById(agentId);
    if (!agent || !agent.feature) {
      return [];
    }

    // Note: relatedFeatures stores FeatureIds, but we need FAJCodes
    // In a real implementation, we'd have a feature catalog to resolve this
    // For now, we'll return agents from the same category

    // Fallback: return agents from the same category
    return this.getByCategory(agent.category)
      .filter(a => a.id !== agentId)
      .slice(0, 5);
  }

  /**
   * Route a query to the best matching agent
   * This is a simple implementation - the real routing uses HNSW semantic search
   */
  routeQuery(query: Query): Agent | undefined {
    // Get all ready agents
    const readyAgents = this.getReadyAgents();
    if (readyAgents.length === 0) {
      return undefined;
    }

    // Simple heuristic: find agent whose feature name matches query content
    const lowerContent = query.content.toLowerCase();

    // First, try exact FAJ code match
    const fajMatch = lowerContent.match(/faj\s*(\d{3})\s*(\d{4})/i);
    if (fajMatch) {
      const fajCode = `FAJ ${fajMatch[1]} ${fajMatch[2]}`;
      const agent = Array.from(this.fajCodeIndex.entries()).find(
        ([key]) => key === fajCode
      );
      if (agent) {
        const matchedAgent = this.agents.get(agent[1]);
        if (matchedAgent?.status === AgentStatus.Ready) {
          return matchedAgent;
        }
      }
    }

    // Then, try feature name match
    for (const agent of readyAgents) {
      if (agent.feature) {
        const featureName = agent.feature.name.toLowerCase();
        if (lowerContent.includes(featureName) || featureName.includes(lowerContent)) {
          return agent;
        }
      }
    }

    // Fallback: return first ready agent in matching category based on query type
    return readyAgents[0];
  }

  /**
   * Shutdown all agents
   */
  async shutdownAll(): Promise<void> {
    const shutdownPromises: Promise<void>[] = [];

    for (const agent of this.agents.values()) {
      shutdownPromises.push(agent.shutdown());
    }

    await Promise.all(shutdownPromises);
  }

  /**
   * Clear all registered agents
   */
  clear(): void {
    this.agents.clear();
    this.fajCodeIndex.clear();

    for (const set of this.categoryIndex.values()) {
      set.clear();
    }

    for (const set of this.typeIndex.values()) {
      set.clear();
    }
  }
}

/**
 * Singleton registry instance
 */
let globalRegistry: AgentRegistry | null = null;

/**
 * Get the global agent registry instance
 */
export function getGlobalRegistry(): AgentRegistry {
  if (!globalRegistry) {
    globalRegistry = new AgentRegistry();
  }
  return globalRegistry;
}

/**
 * Reset the global registry (for testing)
 */
export function resetGlobalRegistry(): void {
  if (globalRegistry) {
    globalRegistry.clear();
  }
  globalRegistry = null;
}
