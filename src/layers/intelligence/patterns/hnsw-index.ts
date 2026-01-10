/**
 * HNSW Index
 * Hierarchical Navigable Small World graph for fast approximate nearest neighbor search
 * Optimized for pattern retrieval in < 1ms
 */

/** Vector type */
export type Vector = Float32Array;

/** HNSW node structure */
interface HNSWNode {
  id: string;
  vector: Vector;
  level: number;
  connections: Map<number, Set<string>>; // level -> connected node IDs
  metadata?: Record<string, unknown>;
}

/** Search result */
export interface SearchResult {
  id: string;
  distance: number;
  metadata?: Record<string, unknown>;
}

/** HNSW configuration */
export interface HNSWConfig {
  M: number;              // Max connections per node per layer
  efConstruction: number; // Size of dynamic candidate list during construction
  efSearch: number;       // Size of dynamic candidate list during search
  mL: number;             // Level multiplier (1/ln(M))
  metric: 'cosine' | 'euclidean' | 'dot';
}

const DEFAULT_CONFIG: HNSWConfig = {
  M: 16,
  efConstruction: 200,
  efSearch: 50,
  mL: 1 / Math.log(16),
  metric: 'cosine',
};

/**
 * HNSWIndex provides fast approximate nearest neighbor search
 * Typical search time: < 1ms for 10,000+ vectors
 */
export class HNSWIndex {
  private readonly config: HNSWConfig;
  private readonly nodes: Map<string, HNSWNode>;
  private entryPoint: string | null;
  private maxLevel: number;
  private readonly dimension: number;

  constructor(dimension: number, config: Partial<HNSWConfig> = {}) {
    this.dimension = dimension;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.nodes = new Map();
    this.entryPoint = null;
    this.maxLevel = 0;
  }

  /**
   * Insert a vector into the index
   */
  insert(id: string, vector: Vector, metadata?: Record<string, unknown>): void {
    if (vector.length !== this.dimension) {
      throw new Error(`Vector dimension mismatch: expected ${this.dimension}, got ${vector.length}`);
    }

    // Assign random level
    const level = this.randomLevel();

    const node: HNSWNode = {
      id,
      vector: new Float32Array(vector),
      level,
      connections: new Map(),
      metadata,
    };

    // Initialize connection maps for each level
    for (let l = 0; l <= level; l++) {
      node.connections.set(l, new Set());
    }

    if (this.entryPoint === null) {
      // First node
      this.nodes.set(id, node);
      this.entryPoint = id;
      this.maxLevel = level;
      return;
    }

    // Find entry point at max level and descend
    let current = this.entryPoint;

    // Search from top level to node's level + 1
    for (let l = this.maxLevel; l > level; l--) {
      current = this.searchLayer(vector, current, 1, l)[0]?.id ?? current;
    }

    // Insert at each level from node's level down to 0
    for (let l = Math.min(level, this.maxLevel); l >= 0; l--) {
      const neighbors = this.searchLayer(vector, current, this.config.efConstruction, l);

      // Select M best neighbors
      const selectedNeighbors = this.selectNeighbors(vector, neighbors, this.config.M);

      // Connect node to neighbors
      const nodeConnections = node.connections.get(l)!;
      for (const neighbor of selectedNeighbors) {
        nodeConnections.add(neighbor.id);

        // Connect neighbor back to node
        const neighborNode = this.nodes.get(neighbor.id);
        if (neighborNode) {
          const neighborConnections = neighborNode.connections.get(l);
          if (neighborConnections) {
            neighborConnections.add(id);

            // Prune if over limit
            if (neighborConnections.size > this.config.M) {
              this.pruneConnections(neighborNode, l);
            }
          }
        }
      }

      if (neighbors.length > 0) {
        current = neighbors[0].id;
      }
    }

    this.nodes.set(id, node);

    // Update entry point if new node has higher level
    if (level > this.maxLevel) {
      this.entryPoint = id;
      this.maxLevel = level;
    }
  }

  /**
   * Search for k nearest neighbors
   */
  search(query: Vector, k: number): SearchResult[] {
    if (this.entryPoint === null) {
      return [];
    }

    if (query.length !== this.dimension) {
      throw new Error(`Query dimension mismatch: expected ${this.dimension}, got ${query.length}`);
    }

    // Traverse from top to bottom
    let current = this.entryPoint;

    for (let l = this.maxLevel; l > 0; l--) {
      const result = this.searchLayer(query, current, 1, l);
      if (result.length > 0) {
        current = result[0].id;
      }
    }

    // Search at layer 0 with efSearch
    const candidates = this.searchLayer(query, current, Math.max(k, this.config.efSearch), 0);

    return candidates.slice(0, k);
  }

  /**
   * Search within a single layer
   */
  private searchLayer(
    query: Vector,
    entryId: string,
    ef: number,
    level: number
  ): SearchResult[] {
    const visited = new Set<string>([entryId]);
    const candidates: SearchResult[] = [];
    const results: SearchResult[] = [];

    const entryNode = this.nodes.get(entryId);
    if (!entryNode) {
      return [];
    }

    const entryDist = this.distance(query, entryNode.vector);
    candidates.push({ id: entryId, distance: entryDist, metadata: entryNode.metadata });
    results.push({ id: entryId, distance: entryDist, metadata: entryNode.metadata });

    while (candidates.length > 0) {
      // Sort candidates by distance (ascending)
      candidates.sort((a, b) => a.distance - b.distance);
      const current = candidates.shift()!;

      // Sort results by distance (descending for furthest)
      results.sort((a, b) => b.distance - a.distance);
      const furthestResult = results[0];

      if (current.distance > furthestResult.distance && results.length >= ef) {
        break;
      }

      const currentNode = this.nodes.get(current.id);
      if (!currentNode) continue;

      const connections = currentNode.connections.get(level);
      if (!connections) continue;

      for (const neighborId of connections) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const neighborNode = this.nodes.get(neighborId);
        if (!neighborNode) continue;

        const dist = this.distance(query, neighborNode.vector);

        results.sort((a, b) => b.distance - a.distance);
        if (results.length < ef || dist < results[0].distance) {
          candidates.push({ id: neighborId, distance: dist, metadata: neighborNode.metadata });
          results.push({ id: neighborId, distance: dist, metadata: neighborNode.metadata });

          if (results.length > ef) {
            results.sort((a, b) => b.distance - a.distance);
            results.pop();
          }
        }
      }
    }

    // Sort by distance ascending
    results.sort((a, b) => a.distance - b.distance);
    return results;
  }

  /**
   * Select best neighbors using simple heuristic
   */
  private selectNeighbors(
    _query: Vector,
    candidates: SearchResult[],
    M: number
  ): SearchResult[] {
    // Simple selection: take M closest
    return candidates
      .sort((a, b) => a.distance - b.distance)
      .slice(0, M);
  }

  /**
   * Prune connections to stay within limit
   */
  private pruneConnections(node: HNSWNode, level: number): void {
    const connections = node.connections.get(level);
    if (!connections || connections.size <= this.config.M) {
      return;
    }

    // Calculate distances to all neighbors
    const neighbors: Array<{ id: string; distance: number }> = [];
    for (const neighborId of connections) {
      const neighbor = this.nodes.get(neighborId);
      if (neighbor) {
        neighbors.push({
          id: neighborId,
          distance: this.distance(node.vector, neighbor.vector),
        });
      }
    }

    // Keep M closest
    neighbors.sort((a, b) => a.distance - b.distance);
    const toKeep = new Set(neighbors.slice(0, this.config.M).map(n => n.id));

    // Remove others
    for (const neighborId of connections) {
      if (!toKeep.has(neighborId)) {
        connections.delete(neighborId);
      }
    }
  }

  /**
   * Generate random level for new node
   */
  private randomLevel(): number {
    let level = 0;
    while (Math.random() < this.config.mL && level < 16) {
      level++;
    }
    return level;
  }

  /**
   * Calculate distance between vectors
   */
  private distance(a: Vector, b: Vector): number {
    switch (this.config.metric) {
      case 'cosine':
        return this.cosineDistance(a, b);
      case 'euclidean':
        return this.euclideanDistance(a, b);
      case 'dot':
        return -this.dotProduct(a, b); // Negative for similarity
      default:
        return this.cosineDistance(a, b);
    }
  }

  private cosineDistance(a: Vector, b: Vector): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
    return 1 - similarity;
  }

  private euclideanDistance(a: Vector, b: Vector): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  private dotProduct(a: Vector, b: Vector): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  /**
   * Remove a vector from the index
   */
  delete(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) {
      return false;
    }

    // Remove connections to this node from all neighbors
    for (const [level, connections] of node.connections) {
      for (const neighborId of connections) {
        const neighbor = this.nodes.get(neighborId);
        if (neighbor) {
          const neighborConnections = neighbor.connections.get(level);
          if (neighborConnections) {
            neighborConnections.delete(id);
          }
        }
      }
    }

    this.nodes.delete(id);

    // Update entry point if deleted
    if (this.entryPoint === id) {
      if (this.nodes.size > 0) {
        // Find new entry point with highest level
        let newEntry: string | null = null;
        let maxLevel = -1;
        for (const [nodeId, n] of this.nodes) {
          if (n.level > maxLevel) {
            maxLevel = n.level;
            newEntry = nodeId;
          }
        }
        this.entryPoint = newEntry;
        this.maxLevel = maxLevel;
      } else {
        this.entryPoint = null;
        this.maxLevel = 0;
      }
    }

    return true;
  }

  /**
   * Get node by ID
   */
  get(id: string): { vector: Vector; metadata?: Record<string, unknown> } | null {
    const node = this.nodes.get(id);
    if (!node) {
      return null;
    }
    return { vector: node.vector, metadata: node.metadata };
  }

  /**
   * Check if ID exists
   */
  has(id: string): boolean {
    return this.nodes.has(id);
  }

  /**
   * Get index size
   */
  size(): number {
    return this.nodes.size;
  }

  /**
   * Get index statistics
   */
  getStats(): {
    size: number;
    dimension: number;
    maxLevel: number;
    avgConnections: number;
    config: HNSWConfig;
  } {
    let totalConnections = 0;
    for (const node of this.nodes.values()) {
      for (const connections of node.connections.values()) {
        totalConnections += connections.size;
      }
    }

    return {
      size: this.nodes.size,
      dimension: this.dimension,
      maxLevel: this.maxLevel,
      avgConnections: this.nodes.size > 0 ? totalConnections / this.nodes.size : 0,
      config: this.config,
    };
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.nodes.clear();
    this.entryPoint = null;
    this.maxLevel = 0;
  }

  /**
   * Export index for persistence
   */
  export(): {
    dimension: number;
    config: HNSWConfig;
    nodes: Array<{
      id: string;
      vector: number[];
      level: number;
      connections: Array<[number, string[]]>;
      metadata?: Record<string, unknown>;
    }>;
    entryPoint: string | null;
    maxLevel: number;
  } {
    const nodes = Array.from(this.nodes.values()).map(node => ({
      id: node.id,
      vector: Array.from(node.vector),
      level: node.level,
      connections: Array.from(node.connections.entries()).map(
        ([level, connections]) => [level, Array.from(connections)] as [number, string[]]
      ),
      metadata: node.metadata,
    }));

    return {
      dimension: this.dimension,
      config: this.config,
      nodes,
      entryPoint: this.entryPoint,
      maxLevel: this.maxLevel,
    };
  }

  /**
   * Import index from exported data
   */
  static import(data: ReturnType<HNSWIndex['export']>): HNSWIndex {
    const index = new HNSWIndex(data.dimension, data.config);

    for (const nodeData of data.nodes) {
      const node: HNSWNode = {
        id: nodeData.id,
        vector: new Float32Array(nodeData.vector),
        level: nodeData.level,
        connections: new Map(
          nodeData.connections.map(([level, ids]) => [level, new Set(ids)])
        ),
        metadata: nodeData.metadata,
      };
      index.nodes.set(node.id, node);
    }

    index.entryPoint = data.entryPoint;
    index.maxLevel = data.maxLevel;

    return index;
  }
}
