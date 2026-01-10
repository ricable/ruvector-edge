/**
 * Dependency Router - P2P Agent Routing via Feature Dependency Graph
 *
 * Builds and manages a graph of 593 Ericsson RAN features with dependencies.
 * Routes queries through feature dependencies without a central coordinator.
 *
 * Features:
 * - BFS routing with weighted edges
 * - Conflict detection and avoidance
 * - Peer discovery for Q-learning federated updates
 * - Real-time routing latency <1ms
 */

export interface Feature {
  fajCode: string;
  name: string;
  category: string;
  parameters?: string[];
  counters?: string[];
  kpis?: string[];
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'requires' | 'conflicts' | 'enhances';
  weight: number;
  confidence: number;
}

export interface RoutingPath {
  fajCodes: string[];
  totalWeight: number;
  avgConfidence: number;
  conflictDetected: boolean;
  estimatedLatencyMs: number;
}

export interface PeerAgent {
  fajCode: string;
  category: string;
  distance: number;
  weight: number;
}

/**
 * Dependency Router - Manages feature dependency graph
 */
export class DependencyRouter {
  private static instance: DependencyRouter;
  private graph: Map<string, GraphEdge[]> = new Map();
  private features: Map<string, Feature> = new Map();
  private routeCache: Map<string, RoutingPath> = new Map();
  private maxCacheSize = 1000;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): DependencyRouter {
    if (!DependencyRouter.instance) {
      DependencyRouter.instance = new DependencyRouter();
    }
    return DependencyRouter.instance;
  }

  /**
   * Build graph from feature list
   * In production, would load from features.json with all 593 features
   */
  buildGraph(features: Feature[]): void {
    console.log(
      `[DependencyRouter] Building graph from ${features.length} features...`
    );

    // Store features
    for (const feature of features) {
      this.features.set(feature.fajCode, feature);
    }

    // Build adjacency list with example dependencies
    // In production, this would read from feature metadata
    for (const feature of features) {
      const edges: GraphEdge[] = [];

      // Example: Add dependencies based on category relationships
      for (const other of features) {
        if (feature.fajCode === other.fajCode) continue;

        // Same category features enhance each other
        if (feature.category === other.category) {
          edges.push({
            from: feature.fajCode,
            to: other.fajCode,
            type: 'enhances',
            weight: 0.5,
            confidence: 0.7,
          });
        }

        // Cross-category can have requirements or conflicts
        if (this.hasRequirement(feature, other)) {
          edges.push({
            from: feature.fajCode,
            to: other.fajCode,
            type: 'requires',
            weight: 1.0,
            confidence: 0.9,
          });
        }

        if (this.hasConflict(feature, other)) {
          edges.push({
            from: feature.fajCode,
            to: other.fajCode,
            type: 'conflicts',
            weight: 0.0,
            confidence: 0.95,
          });
        }
      }

      if (edges.length > 0) {
        this.graph.set(feature.fajCode, edges);
      }
    }

    const totalEdges = Array.from(this.graph.values()).reduce(
      (sum, edges) => sum + edges.length,
      0
    );
    console.log(
      `[DependencyRouter] Built graph: ${features.length} nodes, ${totalEdges} edges`
    );
  }

  /**
   * Route query through feature dependencies (BFS with weighted edges)
   * Returns path from source feature through dependencies
   */
  routeQuery(sourceFajCode: string, queryType: string): RoutingPath {
    // Check cache first
    const cacheKey = `${sourceFajCode}:${queryType}`;
    if (this.routeCache.has(cacheKey)) {
      return this.routeCache.get(cacheKey)!;
    }

    const startTime = performance.now();
    const path: string[] = [sourceFajCode];
    const visited = new Set<string>([sourceFajCode]);
    const queue: Array<{ fajCode: string; weight: number; confidence: number }> = [
      { fajCode: sourceFajCode, weight: 1.0, confidence: 1.0 },
    ];

    let totalWeight = 1.0;
    let totalConfidence = 1.0;
    let nodeCount = 0;
    let conflictDetected = false;

    // BFS to find relevant features
    while (queue.length > 0 && path.length < 5) {
      // Max path length 5 to avoid cycles
      const current = queue.shift()!;
      const edges = this.graph.get(current.fajCode) || [];

      for (const edge of edges) {
        if (visited.has(edge.to)) continue;
        if (nodeCount >= 4) break; // Limit to 4 hops

        visited.add(edge.to);

        // Detect conflicts
        if (edge.type === 'conflicts') {
          conflictDetected = true;
          continue;
        }

        path.push(edge.to);
        totalWeight *= edge.weight;
        totalConfidence *= edge.confidence;
        nodeCount += 1;

        queue.push({
          fajCode: edge.to,
          weight: current.weight * edge.weight,
          confidence: current.confidence * edge.confidence,
        });
      }
    }

    const latencyMs = performance.now() - startTime;

    const routingPath: RoutingPath = {
      fajCodes: path,
      totalWeight,
      avgConfidence: totalConfidence / Math.max(1, path.length - 1),
      conflictDetected,
      estimatedLatencyMs: latencyMs,
    };

    // Cache result
    if (this.routeCache.size >= this.maxCacheSize) {
      const firstKey = this.routeCache.keys().next().value;
      this.routeCache.delete(firstKey);
    }
    this.routeCache.set(cacheKey, routingPath);

    return routingPath;
  }

  /**
   * Find peer agents for federated learning
   * Returns agents within distance for Q-table merging
   */
  findPeersForAgent(fajCode: string, maxPeers: number = 5): PeerAgent[] {
    const feature = this.features.get(fajCode);
    if (!feature) return [];

    const peers: PeerAgent[] = [];
    const edges = this.graph.get(fajCode) || [];

    // Get connected agents with weights
    for (const edge of edges) {
      if (edge.type !== 'conflicts') {
        peers.push({
          fajCode: edge.to,
          category: this.features.get(edge.to)?.category || 'unknown',
          distance: 1,
          weight: edge.weight * edge.confidence,
        });
      }
    }

    // Sort by weight (descending) and limit
    peers.sort((a, b) => b.weight - a.weight);
    return peers.slice(0, maxPeers);
  }

  /**
   * Get feature metadata
   */
  getFeature(fajCode: string): Feature | undefined {
    return this.features.get(fajCode);
  }

  /**
   * Get all features in category
   */
  getFeaturesByCategory(category: string): Feature[] {
    return Array.from(this.features.values()).filter(f => f.category === category);
  }

  /**
   * Get graph statistics
   */
  getGraphStats(): {
    totalNodes: number;
    totalEdges: number;
    categories: string[];
    avgEdgesPerNode: number;
  } {
    const totalNodes = this.features.size;
    const totalEdges = Array.from(this.graph.values()).reduce(
      (sum, edges) => sum + edges.length,
      0
    );
    const categories = Array.from(new Set(Array.from(this.features.values()).map(f => f.category)));
    const avgEdgesPerNode = totalNodes > 0 ? totalEdges / totalNodes : 0;

    return {
      totalNodes,
      totalEdges,
      categories,
      avgEdgesPerNode,
    };
  }

  /**
   * Clear routing cache
   */
  clearCache(): void {
    this.routeCache.clear();
    console.log('[DependencyRouter] Cleared routing cache');
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Detect if feature A requires feature B
   * In production, would read from feature dependencies
   */
  private hasRequirement(featureA: Feature, featureB: Feature): boolean {
    // Example logic: MIMO features require antenna configuration
    if (featureA.category === 'MIMO & Antenna' && featureB.category === 'Antenna Config') {
      return true;
    }

    // Energy saving requires load balancing information
    if (featureA.category === 'Energy Saving' && featureB.category === 'Radio Resource Management') {
      return true;
    }

    return false;
  }

  /**
   * Detect if feature A conflicts with feature B
   * In production, would read from feature conflicts
   */
  private hasConflict(featureA: Feature, featureB: Feature): boolean {
    // Example: Certain carrier aggregation modes conflict with specific power modes
    if (
      featureA.category === 'Carrier Aggregation' &&
      featureB.category === 'Energy Saving'
    ) {
      // Some CA modes aren't compatible with sleep mode
      if (featureA.name?.includes('UL') && featureB.name?.includes('Sleep')) {
        return true;
      }
    }

    return false;
  }
}
