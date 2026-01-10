/**
 * TopologyManager Entity
 *
 * Manages swarm topology configurations including mesh, hierarchical,
 * sharded, and hybrid topologies.
 */

export type TopologyType = 'mesh' | 'hierarchical' | 'sharded' | 'hybrid';

export interface TopologyNode {
  readonly id: string;
  readonly type: 'coordinator' | 'agent' | 'gateway';
  readonly shard?: string;
  readonly connections: Set<string>;
  readonly metadata: Map<string, unknown>;
}

export interface TopologyConfig {
  readonly type: TopologyType;
  readonly maxNodesPerShard: number;
  readonly maxConnections: number;
  readonly replicationFactor: number;
}

export interface TopologyStats {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly avgDegree: number;
  readonly diameter: number;      // Longest shortest path
  readonly density: number;       // Actual edges / possible edges
}

/**
 * TopologyManager Entity
 */
export class TopologyManager {
  readonly id: string;
  private _config: TopologyConfig;
  private _nodes: Map<string, TopologyNode>;
  private _shards: Map<string, Set<string>>;
  private _coordinators: Set<string>;

  constructor(
    id: string,
    config: TopologyConfig = {
      type: 'hybrid',
      maxNodesPerShard: 100,
      maxConnections: 50,
      replicationFactor: 3
    }
  ) {
    this.id = id;
    this._config = config;
    this._nodes = new Map();
    this._shards = new Map();
    this._coordinators = new Set();
  }

  /**
   * Add a node to the topology
   */
  addNode(
    nodeId: string,
    type: 'coordinator' | 'agent' | 'gateway',
    shard?: string
  ): TopologyNode {
    const node: TopologyNode = {
      id: nodeId,
      type,
      shard,
      connections: new Set(),
      metadata: new Map()
    };

    this._nodes.set(nodeId, node);

    if (type === 'coordinator') {
      this._coordinators.add(nodeId);
    }

    if (shard) {
      if (!this._shards.has(shard)) {
        this._shards.set(shard, new Set());
      }
      this._shards.get(shard)!.add(nodeId);
    }

    // Auto-connect based on topology
    this.autoConnect(node);

    return node;
  }

  /**
   * Remove a node from the topology
   */
  removeNode(nodeId: string): void {
    const node = this._nodes.get(nodeId);
    if (!node) return;

    // Remove all connections to this node
    for (const peerId of node.connections) {
      const peer = this._nodes.get(peerId);
      if (peer) {
        peer.connections.delete(nodeId);
      }
    }

    // Remove from shard
    if (node.shard) {
      this._shards.get(node.shard)?.delete(nodeId);
    }

    // Remove from coordinators
    this._coordinators.delete(nodeId);

    this._nodes.delete(nodeId);
  }

  /**
   * Connect two nodes
   */
  connect(nodeId1: string, nodeId2: string): boolean {
    const node1 = this._nodes.get(nodeId1);
    const node2 = this._nodes.get(nodeId2);

    if (!node1 || !node2) return false;
    if (node1.connections.size >= this._config.maxConnections) return false;
    if (node2.connections.size >= this._config.maxConnections) return false;

    node1.connections.add(nodeId2);
    node2.connections.add(nodeId1);
    return true;
  }

  /**
   * Disconnect two nodes
   */
  disconnect(nodeId1: string, nodeId2: string): void {
    const node1 = this._nodes.get(nodeId1);
    const node2 = this._nodes.get(nodeId2);

    if (node1) node1.connections.delete(nodeId2);
    if (node2) node2.connections.delete(nodeId1);
  }

  /**
   * Get neighbors of a node
   */
  getNeighbors(nodeId: string): string[] {
    const node = this._nodes.get(nodeId);
    return node ? Array.from(node.connections) : [];
  }

  /**
   * Find shortest path between two nodes (BFS)
   */
  findPath(fromId: string, toId: string): string[] | null {
    if (!this._nodes.has(fromId) || !this._nodes.has(toId)) {
      return null;
    }

    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }];

    while (queue.length > 0) {
      const { id, path } = queue.shift()!;

      if (id === toId) {
        return path;
      }

      if (visited.has(id)) continue;
      visited.add(id);

      const node = this._nodes.get(id);
      if (!node) continue;

      for (const neighborId of node.connections) {
        if (!visited.has(neighborId)) {
          queue.push({ id: neighborId, path: [...path, neighborId] });
        }
      }
    }

    return null;
  }

  /**
   * Get nodes in a shard
   */
  getShardNodes(shardId: string): string[] {
    const shard = this._shards.get(shardId);
    return shard ? Array.from(shard) : [];
  }

  /**
   * Get all coordinators
   */
  getCoordinators(): string[] {
    return Array.from(this._coordinators);
  }

  /**
   * Auto-connect node based on topology type
   */
  private autoConnect(node: TopologyNode): void {
    switch (this._config.type) {
      case 'mesh':
        this.connectMesh(node);
        break;
      case 'hierarchical':
        this.connectHierarchical(node);
        break;
      case 'sharded':
        this.connectSharded(node);
        break;
      case 'hybrid':
        this.connectHybrid(node);
        break;
    }
  }

  /**
   * Mesh topology: connect to all existing nodes (up to max)
   */
  private connectMesh(node: TopologyNode): void {
    for (const [peerId, peer] of this._nodes) {
      if (peerId !== node.id) {
        if (!this.connect(node.id, peerId)) break;
      }
    }
  }

  /**
   * Hierarchical topology: connect agents to coordinators
   */
  private connectHierarchical(node: TopologyNode): void {
    if (node.type === 'agent') {
      // Connect to a coordinator
      for (const coordId of this._coordinators) {
        if (this.connect(node.id, coordId)) break;
      }
    } else if (node.type === 'coordinator') {
      // Connect coordinators to each other
      for (const coordId of this._coordinators) {
        if (coordId !== node.id) {
          this.connect(node.id, coordId);
        }
      }
    }
  }

  /**
   * Sharded topology: connect within shard
   */
  private connectSharded(node: TopologyNode): void {
    if (!node.shard) return;

    const shardNodes = this._shards.get(node.shard);
    if (!shardNodes) return;

    for (const peerId of shardNodes) {
      if (peerId !== node.id) {
        if (!this.connect(node.id, peerId)) break;
      }
    }
  }

  /**
   * Hybrid topology: Raft for coordinators, gossip within shards
   */
  private connectHybrid(node: TopologyNode): void {
    if (node.type === 'coordinator') {
      // Full mesh among coordinators
      for (const coordId of this._coordinators) {
        if (coordId !== node.id) {
          this.connect(node.id, coordId);
        }
      }
    } else {
      // Connect to shard peers and one coordinator
      this.connectSharded(node);

      // Connect to a coordinator
      for (const coordId of this._coordinators) {
        if (this.connect(node.id, coordId)) break;
      }
    }
  }

  /**
   * Calculate topology statistics
   */
  getStats(): TopologyStats {
    let edgeCount = 0;
    let totalDegree = 0;

    for (const node of this._nodes.values()) {
      edgeCount += node.connections.size;
      totalDegree += node.connections.size;
    }

    edgeCount /= 2; // Each edge counted twice

    const nodeCount = this._nodes.size;
    const avgDegree = nodeCount > 0 ? totalDegree / nodeCount : 0;
    const maxPossibleEdges = (nodeCount * (nodeCount - 1)) / 2;
    const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;

    // Calculate diameter (simplified - sample-based)
    let diameter = 0;
    const nodeIds = Array.from(this._nodes.keys());
    for (let i = 0; i < Math.min(10, nodeIds.length); i++) {
      for (let j = i + 1; j < Math.min(10, nodeIds.length); j++) {
        const path = this.findPath(nodeIds[i], nodeIds[j]);
        if (path && path.length - 1 > diameter) {
          diameter = path.length - 1;
        }
      }
    }

    return {
      nodeCount,
      edgeCount,
      avgDegree,
      diameter,
      density
    };
  }

  /**
   * Change topology type (rebuilds connections)
   */
  changeTopology(newType: TopologyType): void {
    // Clear all connections
    for (const node of this._nodes.values()) {
      node.connections.clear();
    }

    this._config = { ...this._config, type: newType };

    // Rebuild connections
    for (const node of this._nodes.values()) {
      this.autoConnect(node);
    }
  }

  // Getters
  get config(): TopologyConfig { return this._config; }
  get nodeCount(): number { return this._nodes.size; }
  get shardCount(): number { return this._shards.size; }

  getNode(nodeId: string): TopologyNode | undefined {
    return this._nodes.get(nodeId);
  }

  equals(other: TopologyManager): boolean {
    return this.id === other.id;
  }

  toString(): string {
    const stats = this.getStats();
    return `TopologyManager(${this.id}, ${this._config.type}, nodes=${stats.nodeCount}, edges=${stats.edgeCount})`;
  }
}
