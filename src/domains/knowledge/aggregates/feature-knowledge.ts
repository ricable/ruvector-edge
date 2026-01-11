/**
 * FeatureKnowledge Aggregate Root
 *
 * Represents the knowledge aggregate for a single RAN feature.
 * This aggregate manages feature metadata, parameters, counters, and KPIs.
 *
 * Implements:
 * - Event sourcing for knowledge updates
 * - Invariants preservation (feature data integrity, parameter validation)
 * - Domain event publishing
 * - Proper encapsulation
 */

import { FAJCode } from '../value-objects/faj-code';
import { Feature, FeatureProps } from '../entities/feature';
import { Parameter } from '../entities/parameter';
import { Counter } from '../entities/counter';
import { FeatureCategory } from '../value-objects/feature-category';

/**
 * Knowledge domain events
 */
export interface KnowledgeLoadedEvent {
  readonly type: 'KnowledgeLoaded';
  readonly aggregateId: string;
  readonly featureId: string;
  readonly fajCode: string;
  readonly timestamp: Date;
}

export interface ParameterAddedEvent {
  readonly type: 'ParameterAdded';
  readonly aggregateId: string;
  readonly parameterId: string;
  readonly parameterName: string;
  readonly timestamp: Date;
}

export interface CounterAddedEvent {
  readonly type: 'CounterAdded';
  readonly aggregateId: string;
  readonly counterId: string;
  readonly counterName: string;
  readonly timestamp: Date;
}

export interface KnowledgeUpdatedEvent {
  readonly type: 'KnowledgeUpdated';
  readonly aggregateId: string;
  readonly updateType: 'parameter' | 'counter' | 'kpi' | 'metadata';
  readonly timestamp: Date;
}

export type FeatureKnowledgeEvent =
  | KnowledgeLoadedEvent
  | ParameterAddedEvent
  | CounterAddedEvent
  | KnowledgeUpdatedEvent;

/**
 * FeatureKnowledge configuration
 */
export interface FeatureKnowledgeConfig {
  readonly fajCode: string;
  readonly name: string;
  readonly description: string;
  readonly category: FeatureCategory;
  readonly accessTechnology: 'LTE' | 'NR' | 'Both';
}

/**
 * Knowledge statistics
 */
export interface KnowledgeStats {
  readonly parameterCount: number;
  readonly counterCount: number;
  readonly kpiCount: number;
  readonly lastUpdated: Date;
}

/**
 * FeatureKnowledge Aggregate Root
 *
 * Manages the knowledge for a single RAN feature.
 */
export class FeatureKnowledge {
  readonly id: string;

  // Aggregate state
  private _feature: Feature;
  private _parameters: Map<string, Parameter>;
  private _counters: Map<string, Counter>;
  private _kpis: Map<string, unknown>;
  private _loaded: boolean;
  private _lastUpdated: Date;

  // Event sourcing
  private _events: FeatureKnowledgeEvent[];
  private _version: number;

  private constructor(
    id: string,
    feature: Feature
  ) {
    this.id = id;
    this._feature = feature;
    this._parameters = new Map();
    this._counters = new Map();
    this._kpis = new Map();
    this._loaded = false;
    this._lastUpdated = new Date();
    this._events = [];
    this._version = 0;
  }

  // ===========================================================================
  // FACTORY METHODS
  // ===========================================================================

  /**
   * Factory method to create new FeatureKnowledge
   */
  static create(config: FeatureKnowledgeConfig): FeatureKnowledge {
    // Validate FAJ code
    const fajCode = FAJCode.create(config.fajCode);

    // Create feature entity
    const featureProps: FeatureProps = {
      id: `feature-${fajCode.code.replace(/\s+/g, '-').toLowerCase()}`,
      fajCode,
      name: config.name,
      description: config.description,
      category: config.category,
      accessTechnology: config.accessTechnology,
      parameters: [],
      counters: [],
      procedures: [],
      kpis: []
    };

    const feature = new Feature(
      featureProps.id,
      featureProps.fajCode,
      featureProps.name,
      featureProps.description,
      featureProps.category,
      featureProps.accessTechnology
    );

    const id = `knowledge-${feature.id}`;
    const knowledge = new FeatureKnowledge(id, feature);

    return knowledge;
  }

  // ===========================================================================
  // PUBLIC API - Knowledge Management
  // ===========================================================================

  /**
   * Load knowledge from feature data
   */
  loadKnowledge(featureData: FeatureProps): void {
    if (this._loaded) {
      throw new Error('Knowledge already loaded');
    }

    // Validate FAJ code matches
    if (!this._feature.fajCode.equals(featureData.fajCode)) {
      throw new Error('FAJ code mismatch');
    }

    // Update feature data
    this._feature = new Feature(
      featureData.id,
      featureData.fajCode,
      featureData.name,
      featureData.description,
      featureData.category,
      featureData.accessTechnology
    );

    // Add parameters
    for (const param of featureData.parameters) {
      this.addParameterInternal(param);
    }

    // Add counters
    for (const counter of featureData.counters) {
      this.addCounterInternal(counter);
    }

    // Add KPIs
    for (const kpi of featureData.kpis) {
      this._kpis.set(kpi.id, kpi);
    }

    this._loaded = true;
    this._lastUpdated = new Date();

    // Raise event
    this.raise({
      type: 'KnowledgeLoaded',
      aggregateId: this.id,
      featureId: this._feature.id,
      fajCode: this._feature.fajCode.code,
      timestamp: new Date()
    });
  }

  /**
   * Add a parameter to the knowledge base
   */
  addParameter(parameter: Parameter): void {
    if (!this._loaded) {
      throw new Error('Knowledge not loaded');
    }

    // Check for duplicate
    if (this._parameters.has(parameter.id)) {
      throw new Error(`Parameter ${parameter.id} already exists`);
    }

    this.addParameterInternal(parameter);
    this._lastUpdated = new Date();

    // Raise event
    this.raise({
      type: 'ParameterAdded',
      aggregateId: this.id,
      parameterId: parameter.id,
      parameterName: parameter.name,
      timestamp: new Date()
    });
  }

  /**
   * Add a counter to the knowledge base
   */
  addCounter(counter: Counter): void {
    if (!this._loaded) {
      throw new Error('Knowledge not loaded');
    }

    // Check for duplicate
    if (this._counters.has(counter.id)) {
      throw new Error(`Counter ${counter.id} already exists`);
    }

    this.addCounterInternal(counter);
    this._lastUpdated = new Date();

    // Raise event
    this.raise({
      type: 'CounterAdded',
      aggregateId: this.id,
      counterId: counter.id,
      counterName: counter.name,
      timestamp: new Date()
    });
  }

  /**
   * Get parameter by ID
   */
  getParameter(parameterId: string): Parameter | undefined {
    return this._parameters.get(parameterId);
  }

  /**
   * Get counter by ID
   */
  getCounter(counterId: string): Counter | undefined {
    return this._counters.get(counterId);
  }

  /**
   * Find parameters by name pattern
   */
  findParametersByName(pattern: string): Parameter[] {
    const regex = new RegExp(pattern, 'i');
    return Array.from(this._parameters.values()).filter(p => regex.test(p.name));
  }

  /**
   * Find counters by name pattern
   */
  findCountersByName(pattern: string): Counter[] {
    const regex = new RegExp(pattern, 'i');
    return Array.from(this._counters.values()).filter(c => regex.test(c.name));
  }

  /**
   * Get knowledge statistics
   */
  getStats(): KnowledgeStats {
    return {
      parameterCount: this._parameters.size,
      counterCount: this._counters.size,
      kpiCount: this._kpis.size,
      lastUpdated: this._lastUpdated
    };
  }

  // ===========================================================================
  // GETTERS
  // ===========================================================================

  get feature(): Feature {
    return this._feature;
  }

  get parameters(): Parameter[] {
    return Array.from(this._parameters.values());
  }

  get counters(): Counter[] {
    return Array.from(this._counters.values());
  }

  get kpis(): Map<string, unknown> {
    return new Map(this._kpis);
  }

  get loaded(): boolean {
    return this._loaded;
  }

  get lastUpdated(): Date {
    return this._lastUpdated;
  }

  get version(): number {
    return this._version;
  }

  // ===========================================================================
  // EVENT SOURCING
  // ===========================================================================

  /**
   * Get uncommitted domain events
   */
  getUncommittedEvents(): FeatureKnowledgeEvent[] {
    return [...this._events];
  }

  /**
   * Clear uncommitted events
   */
  markEventsAsCommitted(): void {
    this._events = [];
  }

  /**
   * Rebuild aggregate from event history
   */
  static fromHistory(events: FeatureKnowledgeEvent[]): FeatureKnowledge {
    if (events.length === 0) {
      throw new Error('Cannot rebuild from empty event history');
    }

    // Find KnowledgeLoaded event
    const knowledgeLoadedEvent = events.find(
      (e): e is KnowledgeLoadedEvent => e.type === 'KnowledgeLoaded'
    );

    if (!knowledgeLoadedEvent) {
      throw new Error('Event history must start with KnowledgeLoaded event');
    }

    // Create aggregate
    const fajCode = FAJCode.create(knowledgeLoadedEvent.fajCode);
    const config: FeatureKnowledgeConfig = {
      fajCode: fajCode.code,
      name: 'Feature',
      description: 'RAN Feature',
      category: fajCode.category,
      accessTechnology: 'Both'
    };

    const knowledge = FeatureKnowledge.create(config);
    knowledge._events = [];

    // Replay events (simplified - in real implementation would track state changes)
    for (const event of events) {
      knowledge._version++;
      knowledge._lastUpdated = event.timestamp;

      if (event.type === 'KnowledgeLoaded') {
        knowledge._loaded = true;
      }
    }

    return knowledge;
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Internal method to add parameter without raising event
   */
  private addParameterInternal(parameter: Parameter): void {
    this._parameters.set(parameter.id, parameter);
  }

  /**
   * Internal method to add counter without raising event
   */
  private addCounterInternal(counter: Counter): void {
    this._counters.set(counter.id, counter);
  }

  /**
   * Raise domain event
   */
  private raise(event: FeatureKnowledgeEvent): void {
    this._events.push(event);
    this._version++;
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Value equality
   */
  equals(other: FeatureKnowledge): boolean {
    return this.id === other.id;
  }

  /**
   * String representation
   */
  toString(): string {
    return `FeatureKnowledge(${this._feature.fajCode.code}, params=${this._parameters.size}, counters=${this._counters.size})`;
  }

  /**
   * JSON representation
   */
  toJSON(): object {
    return {
      id: this.id,
      feature: this._feature.id,
      fajCode: this._feature.fajCode.code,
      parameterCount: this._parameters.size,
      counterCount: this._counters.size,
      kpiCount: this._kpis.size,
      loaded: this._loaded,
      lastUpdated: this._lastUpdated,
      version: this._version
    };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export type {
  FeatureKnowledgeConfig,
  KnowledgeStats
};

export default FeatureKnowledge;
