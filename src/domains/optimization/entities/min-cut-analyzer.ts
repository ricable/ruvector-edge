/**
 * MinCutAnalyzer Entity
 *
 * Graph algorithm for identifying critical parameter-counter dependencies.
 * Proactively detects system fragility before KPI degradation occurs.
 */

export interface DependencyEdge {
  readonly sourceId: string;         // Parameter or counter ID
  readonly targetId: string;         // Counter or KPI ID
  readonly weight: number;           // Dependency strength (0-1)
  readonly type: 'parameter-counter' | 'counter-kpi' | 'parameter-kpi';
}

export interface MinCutResult {
  readonly cutEdges: DependencyEdge[];
  readonly cutValue: number;         // Sum of edge weights
  readonly sourcePartition: Set<string>;
  readonly targetPartition: Set<string>;
  readonly fragility: number;        // 0-1, higher = more fragile
}

export interface FragilityReport {
  readonly overallFragility: number;
  readonly criticalPaths: CriticalPath[];
  readonly recommendations: string[];
  readonly timestamp: Date;
}

export interface CriticalPath {
  readonly path: string[];
  readonly weight: number;
  readonly impactedKPIs: string[];
}

export class MinCutAnalyzer {
  readonly id: string;
  private _edges: DependencyEdge[];
  private _nodeMap: Map<string, Set<DependencyEdge>>;
  private _analysisCache: Map<string, MinCutResult>;

  constructor(id: string) {
    this.id = id;
    this._edges = [];
    this._nodeMap = new Map();
    this._analysisCache = new Map();
  }

  /**
   * Add a dependency edge to the graph
   */
  addEdge(edge: DependencyEdge): void {
    this._edges.push(edge);

    // Update adjacency map
    if (!this._nodeMap.has(edge.sourceId)) {
      this._nodeMap.set(edge.sourceId, new Set());
    }
    this._nodeMap.get(edge.sourceId)!.add(edge);

    if (!this._nodeMap.has(edge.targetId)) {
      this._nodeMap.set(edge.targetId, new Set());
    }
    this._nodeMap.get(edge.targetId)!.add(edge);

    // Invalidate cache
    this._analysisCache.clear();
  }

  /**
   * Remove an edge from the graph
   */
  removeEdge(sourceId: string, targetId: string): void {
    this._edges = this._edges.filter(
      e => !(e.sourceId === sourceId && e.targetId === targetId)
    );

    // Update adjacency map
    this._nodeMap.forEach(edges => {
      edges.forEach(edge => {
        if (edge.sourceId === sourceId && edge.targetId === targetId) {
          edges.delete(edge);
        }
      });
    });

    this._analysisCache.clear();
  }

  /**
   * Find minimum cut between a parameter and a KPI
   */
  findMinCut(sourceId: string, targetId: string): MinCutResult {
    const cacheKey = `${sourceId}-${targetId}`;
    if (this._analysisCache.has(cacheKey)) {
      return this._analysisCache.get(cacheKey)!;
    }

    // Simplified min-cut using BFS-based approach
    // For a full implementation, Ford-Fulkerson would be used
    const result = this.computeMinCut(sourceId, targetId);
    this._analysisCache.set(cacheKey, result);
    return result;
  }

  /**
   * Analyze overall system fragility
   */
  analyzeFragility(kpiIds: string[], parameterIds: string[]): FragilityReport {
    const criticalPaths: CriticalPath[] = [];
    let totalFragility = 0;
    let pathCount = 0;

    for (const kpiId of kpiIds) {
      for (const paramId of parameterIds) {
        const minCut = this.findMinCut(paramId, kpiId);
        if (minCut.cutEdges.length > 0) {
          // Low cut value = high fragility (easily severable)
          const pathFragility = 1 / (1 + minCut.cutValue);
          totalFragility += pathFragility;
          pathCount++;

          if (pathFragility > 0.5) {
            criticalPaths.push({
              path: [paramId, ...this.findPath(paramId, kpiId), kpiId],
              weight: minCut.cutValue,
              impactedKPIs: [kpiId]
            });
          }
        }
      }
    }

    const overallFragility = pathCount > 0 ? totalFragility / pathCount : 0;
    const recommendations = this.generateRecommendations(criticalPaths, overallFragility);

    return {
      overallFragility,
      criticalPaths: criticalPaths.sort((a, b) => b.weight - a.weight).slice(0, 10),
      recommendations,
      timestamp: new Date()
    };
  }

  /**
   * Find all paths between two nodes
   */
  private findPath(sourceId: string, targetId: string): string[] {
    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = (current: string): boolean => {
      if (current === targetId) return true;
      if (visited.has(current)) return false;

      visited.add(current);
      const edges = this._nodeMap.get(current) ?? new Set();

      for (const edge of edges) {
        const next = edge.sourceId === current ? edge.targetId : edge.sourceId;
        if (dfs(next)) {
          path.push(next);
          return true;
        }
      }

      return false;
    };

    dfs(sourceId);
    return path.reverse();
  }

  /**
   * Compute minimum cut using simplified algorithm
   */
  private computeMinCut(sourceId: string, targetId: string): MinCutResult {
    // Find edges on all paths from source to target
    const pathEdges = this.findPathEdges(sourceId, targetId);

    if (pathEdges.length === 0) {
      return {
        cutEdges: [],
        cutValue: Infinity,
        sourcePartition: new Set([sourceId]),
        targetPartition: new Set([targetId]),
        fragility: 0
      };
    }

    // Sort by weight to find minimum cut
    const sortedEdges = [...pathEdges].sort((a, b) => a.weight - b.weight);

    // Simple heuristic: weakest edges form the cut
    const cutEdges = sortedEdges.slice(0, Math.ceil(sortedEdges.length / 3));
    const cutValue = cutEdges.reduce((sum, e) => sum + e.weight, 0);

    // Determine partitions
    const sourcePartition = new Set<string>();
    const targetPartition = new Set<string>();

    this.partitionNodes(sourceId, cutEdges, sourcePartition);
    this.partitionNodes(targetId, cutEdges, targetPartition);

    const fragility = cutValue > 0 ? 1 / (1 + cutValue) : 1;

    return {
      cutEdges,
      cutValue,
      sourcePartition,
      targetPartition,
      fragility
    };
  }

  /**
   * Find all edges on paths between source and target
   */
  private findPathEdges(sourceId: string, targetId: string): DependencyEdge[] {
    const pathEdges: DependencyEdge[] = [];
    const visited = new Set<string>();

    const dfs = (current: string): boolean => {
      if (current === targetId) return true;
      if (visited.has(current)) return false;

      visited.add(current);
      const edges = this._nodeMap.get(current) ?? new Set();

      for (const edge of edges) {
        const next = edge.sourceId === current ? edge.targetId : edge.sourceId;
        if (dfs(next)) {
          pathEdges.push(edge);
          return true;
        }
      }

      return false;
    };

    dfs(sourceId);
    return pathEdges;
  }

  /**
   * Partition nodes reachable from source without crossing cut edges
   */
  private partitionNodes(
    startId: string,
    cutEdges: DependencyEdge[],
    partition: Set<string>
  ): void {
    const cutSet = new Set(cutEdges.map(e => `${e.sourceId}-${e.targetId}`));
    const queue = [startId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (partition.has(current)) continue;

      partition.add(current);
      const edges = this._nodeMap.get(current) ?? new Set();

      for (const edge of edges) {
        const key = `${edge.sourceId}-${edge.targetId}`;
        if (!cutSet.has(key)) {
          const next = edge.sourceId === current ? edge.targetId : edge.sourceId;
          queue.push(next);
        }
      }
    }
  }

  /**
   * Generate recommendations based on fragility analysis
   */
  private generateRecommendations(
    criticalPaths: CriticalPath[],
    overallFragility: number
  ): string[] {
    const recommendations: string[] = [];

    if (overallFragility > 0.7) {
      recommendations.push('HIGH FRAGILITY: System dependencies are critical. Consider adding redundancy.');
    } else if (overallFragility > 0.4) {
      recommendations.push('MODERATE FRAGILITY: Some dependencies are tightly coupled.');
    }

    if (criticalPaths.length > 5) {
      recommendations.push(`${criticalPaths.length} critical paths identified. Review parameter interdependencies.`);
    }

    const lowWeightPaths = criticalPaths.filter(p => p.weight < 0.3);
    if (lowWeightPaths.length > 0) {
      recommendations.push(`${lowWeightPaths.length} paths have weak dependencies. Consider strengthening monitoring.`);
    }

    return recommendations;
  }

  // Getters
  get edgeCount(): number { return this._edges.length; }
  get nodeCount(): number { return this._nodeMap.size; }
  get edges(): ReadonlyArray<DependencyEdge> { return this._edges; }

  equals(other: MinCutAnalyzer): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return `MinCutAnalyzer(${this.id}, nodes=${this.nodeCount}, edges=${this.edgeCount})`;
  }
}
