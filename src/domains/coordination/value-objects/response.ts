/**
 * Response Value Object
 *
 * The agent's response to a query including confidence, sources, and related information.
 */

import { FAJCode } from '../../knowledge/value-objects/faj-code';
import { CmeditCommand } from '../../optimization/value-objects/cmedit-command';

export interface Source {
  readonly type: 'knowledge_base' | 'vector_memory' | 'peer_agent' | 'external';
  readonly reference: string;
  readonly confidence: number;
}

export interface AgentId {
  readonly value: string;
}

export class Response {
  constructor(
    public readonly queryId: string,
    public readonly agentId: AgentId,
    public readonly featureFaj: FAJCode,
    public readonly content: string,
    public readonly confidence: number, // 0.0 - 1.0
    public readonly sources: ReadonlyArray<Source>,
    public readonly cmeditCommands: ReadonlyArray<CmeditCommand>,
    public readonly relatedFeatures: ReadonlyArray<FAJCode>,
    public readonly consultedAgents: ReadonlyArray<AgentId>,
    public readonly latencyMs: number
  ) {
    Object.freeze(this);
    Object.freeze(this.sources);
    Object.freeze(this.cmeditCommands);
    Object.freeze(this.relatedFeatures);
    Object.freeze(this.consultedAgents);
  }

  /**
   * Check if response is high confidence
   */
  isHighConfidence(): boolean {
    return this.confidence >= 0.8;
  }

  /**
   * Check if response required peer consultation
   */
  usedPeerConsultation(): boolean {
    return this.consultedAgents.length > 0;
  }

  /**
   * Check if response includes actionable commands
   */
  hasCommands(): boolean {
    return this.cmeditCommands.length > 0;
  }

  /**
   * Get primary source type
   */
  getPrimarySourceType(): string {
    if (this.sources.length === 0) {
      return 'unknown';
    }
    return this.sources.reduce((best, s) =>
      s.confidence > best.confidence ? s : best
    ).type;
  }

  /**
   * Value equality
   */
  equals(other: Response): boolean {
    return this.queryId === other.queryId && this.agentId.value === other.agentId.value;
  }

  toString(): string {
    return `Response(query=${this.queryId}, agent=${this.agentId.value}, conf=${(this.confidence * 100).toFixed(1)}%)`;
  }

  toJSON(): object {
    return {
      queryId: this.queryId,
      agentId: this.agentId.value,
      featureFaj: this.featureFaj.toString(),
      contentLength: this.content.length,
      confidence: this.confidence,
      sourceCount: this.sources.length,
      commandCount: this.cmeditCommands.length,
      relatedFeatureCount: this.relatedFeatures.length,
      consultedAgentCount: this.consultedAgents.length,
      latencyMs: this.latencyMs
    };
  }
}
