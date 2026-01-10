/**
 * Feature Entity
 *
 * Represents a single Ericsson RAN feature identified by a unique FAJ code.
 * Features contain configurable parameters, measurable counters, and derived KPIs.
 */

import { FAJCode } from '../value-objects/faj-code';
import { Parameter } from '../value-objects/parameter';
import { Counter } from '../value-objects/counter';
import { KPI } from '../value-objects/kpi';

export type AccessTechnology = 'LTE' | 'NR' | 'CrossRAT';

export type Category =
  | 'CA' | 'RRM' | 'MIMO' | 'Mobility' | 'NR' | 'Coverage'
  | 'Transport' | 'Voice' | 'Interference' | 'QoS' | 'Timing'
  | 'Security' | 'Energy' | 'UE' | 'Other';

export interface Procedure {
  readonly name: string;
  readonly description: string;
  readonly steps: string[];
  readonly prerequisites: string[];
  readonly verificationSteps: string[];
}

export interface FeatureProps {
  readonly id: string;
  readonly fajCode: FAJCode;
  readonly name: string;
  readonly description: string;
  readonly category: Category;
  readonly accessTechnology: AccessTechnology;
  readonly parameters: Parameter[];
  readonly counters: Counter[];
  readonly kpis: KPI[];
  readonly procedures: Procedure[];
  readonly dependencies: string[];
  readonly conflicts: string[];
  readonly relatedFeatures: string[];
}

export class Feature {
  readonly id: string;
  readonly fajCode: FAJCode;
  readonly name: string;
  readonly description: string;
  readonly category: Category;
  readonly accessTechnology: AccessTechnology;
  readonly parameters: ReadonlyArray<Parameter>;
  readonly counters: ReadonlyArray<Counter>;
  readonly kpis: ReadonlyArray<KPI>;
  readonly procedures: ReadonlyArray<Procedure>;
  readonly dependencies: ReadonlyArray<string>;
  readonly conflicts: ReadonlyArray<string>;
  readonly relatedFeatures: ReadonlyArray<string>;

  constructor(props: FeatureProps) {
    this.id = props.id;
    this.fajCode = props.fajCode;
    this.name = props.name;
    this.description = props.description;
    this.category = props.category;
    this.accessTechnology = props.accessTechnology;
    this.parameters = Object.freeze([...props.parameters]);
    this.counters = Object.freeze([...props.counters]);
    this.kpis = Object.freeze([...props.kpis]);
    this.procedures = Object.freeze([...props.procedures]);
    this.dependencies = Object.freeze([...props.dependencies]);
    this.conflicts = Object.freeze([...props.conflicts]);
    this.relatedFeatures = Object.freeze([...props.relatedFeatures]);
    Object.freeze(this);
  }

  /**
   * Find a parameter by name
   */
  getParameter(name: string): Parameter | undefined {
    return this.parameters.find(p => p.name === name);
  }

  /**
   * Find a counter by name
   */
  getCounter(name: string): Counter | undefined {
    return this.counters.find(c => c.name === name);
  }

  /**
   * Find a KPI by name
   */
  getKpi(name: string): KPI | undefined {
    return this.kpis.find(k => k.name === name);
  }

  /**
   * Get all primary counters
   */
  getPrimaryCounters(): Counter[] {
    return this.counters.filter(c => c.category === 'Primary');
  }

  /**
   * Check if this feature conflicts with another
   */
  conflictsWith(featureId: string): boolean {
    return this.conflicts.includes(featureId);
  }

  /**
   * Check if this feature depends on another
   */
  dependsOn(featureId: string): boolean {
    return this.dependencies.includes(featureId);
  }

  /**
   * Identity equality (by id)
   */
  equals(other: Feature): boolean {
    return this.id === other.id;
  }

  /**
   * Check if FAJ codes match
   */
  hasSameFajCode(other: Feature): boolean {
    return this.fajCode.equals(other.fajCode);
  }

  toString(): string {
    return `${this.name} (${this.fajCode.toString()})`;
  }

  toJSON(): object {
    return {
      id: this.id,
      fajCode: this.fajCode.toString(),
      name: this.name,
      description: this.description,
      category: this.category,
      accessTechnology: this.accessTechnology,
      parameterCount: this.parameters.length,
      counterCount: this.counters.length,
      kpiCount: this.kpis.length,
      procedureCount: this.procedures.length,
      dependencies: [...this.dependencies],
      conflicts: [...this.conflicts],
      relatedFeatures: [...this.relatedFeatures]
    };
  }
}
