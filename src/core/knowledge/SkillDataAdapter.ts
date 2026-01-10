/**
 * ELEX Edge AI Agent Swarm - Skill Data Adapter
 *
 * Transforms Ericsson RAN features from the Claude skill format
 * (.claude/skills/ericsson-ran-features/) to the KnowledgeLoader format.
 *
 * The skill contains 593 features with:
 * - 9,432 parameters
 * - 3,368 counters
 * - 752 MO classes
 * - 199 KPIs
 * - 118 technical documents
 * - 49 releases
 */

import type {
  RawFeatureData,
  RawParameterData,
  RawCounterData,
  RawKPIData,
  RawProcedureData,
} from './KnowledgeLoader.js';

/**
 * Skill feature format from features.json
 */
export interface SkillFeature {
  name: string;
  acronym?: string;
  summary?: string;
  faj: string;
  cxc?: string;
  access?: string[];
  license?: boolean;
  value_package?: {
    name: string;
    faj: string;
  };
  file?: string;
  metadata?: {
    complexity_score?: number;
    quality_score?: number;
    tables_extracted?: number;
    images_extracted?: number;
    source_file?: string;
  };
  params?: string[];
  param_details?: Array<{
    name: string;
    type?: string;
    description?: string;
  }>;
  counters?: string[];
  activation?: {
    prerequisites?: string[];
    steps?: string[];
    after?: string[];
  };
  deactivation?: {
    prerequisites?: string[];
    steps?: string[];
    after?: string[];
  };
}

/**
 * Skill counter format from counters.json
 */
export interface SkillCounter {
  name: string;
  mo_class: string;
  description?: string | null;
  unit?: string | null;
  counter_type?: string | null;
  features: string[];
}

/**
 * Skill KPI format from kpis.json
 */
export interface SkillKPI {
  description?: string;
  features: string[];
  keywords?: string[];
}

/**
 * Dependency graph format from dependency_graph.json
 */
export interface SkillDependencyGraph {
  nodes: Record<string, {
    name: string;
    acronym?: string;
    cxc?: string;
    in_degree: number;
    out_degree: number;
  }>;
  edges: {
    prerequisite?: Array<{
      from: string;
      to: string;
      label: string;
    }>;
    related?: Array<{
      from: string;
      to: string;
      label: string;
    }>;
    conflicting?: Array<{
      from: string;
      to: string;
      label: string;
    }>;
  };
}

/**
 * Category mapping from index_categories.json
 */
export type SkillCategoryIndex = Record<string, string[]>;

/**
 * Skill data sources
 */
export interface SkillData {
  features: Record<string, SkillFeature>;
  counters: Record<string, SkillCounter>;
  kpis: Record<string, SkillKPI>;
  dependencyGraph: SkillDependencyGraph;
  categories: SkillCategoryIndex;
}

/**
 * Default skill path relative to project root
 */
export const DEFAULT_SKILL_PATH = '.claude/skills/ericsson-ran-features/references';

/**
 * Adapter configuration
 */
export interface SkillDataAdapterConfig {
  /** Path to skill references directory */
  skillPath?: string;
  /** Include counters from counters.json */
  includeCounters?: boolean;
  /** Include KPIs from kpis.json */
  includeKpis?: boolean;
  /** Include dependencies from dependency_graph.json */
  includeDependencies?: boolean;
  /** Include category from index_categories.json */
  includeCategories?: boolean;
}

/**
 * SkillDataAdapter transforms Claude skill data to KnowledgeLoader format
 */
export class SkillDataAdapter {
  private readonly config: Required<SkillDataAdapterConfig>;

  constructor(config: SkillDataAdapterConfig = {}) {
    this.config = {
      skillPath: config.skillPath ?? DEFAULT_SKILL_PATH,
      includeCounters: config.includeCounters ?? true,
      includeKpis: config.includeKpis ?? true,
      includeDependencies: config.includeDependencies ?? true,
      includeCategories: config.includeCategories ?? true,
    };
  }

  /**
   * Load and transform all skill data
   * Note: This method only works in Node.js environments
   */
  async loadFromSkill(projectRoot: string): Promise<RawFeatureData[]> {
    const skillPath = `${projectRoot}/${this.config.skillPath}`;

    // Load all JSON files
    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    const featuresPath = path.join(skillPath, 'features.json');
    const featuresContent = await fs.readFile(featuresPath, 'utf-8');
    const features = JSON.parse(featuresContent) as Record<string, SkillFeature>;

    let counters: Record<string, SkillCounter> = {};
    let kpis: Record<string, SkillKPI> = {};
    let dependencyGraph: SkillDependencyGraph = { nodes: {}, edges: {} };
    let categories: SkillCategoryIndex = {};

    if (this.config.includeCounters) {
      try {
        const countersPath = path.join(skillPath, 'counters.json');
        const countersContent = await fs.readFile(countersPath, 'utf-8');
        counters = JSON.parse(countersContent);
      } catch {
        // Counters file optional
      }
    }

    if (this.config.includeKpis) {
      try {
        const kpisPath = path.join(skillPath, 'kpis.json');
        const kpisContent = await fs.readFile(kpisPath, 'utf-8');
        kpis = JSON.parse(kpisContent);
      } catch {
        // KPIs file optional
      }
    }

    if (this.config.includeDependencies) {
      try {
        const depsPath = path.join(skillPath, 'dependency_graph.json');
        const depsContent = await fs.readFile(depsPath, 'utf-8');
        dependencyGraph = JSON.parse(depsContent);
      } catch {
        // Dependency graph optional
      }
    }

    if (this.config.includeCategories) {
      try {
        const catsPath = path.join(skillPath, 'index_categories.json');
        const catsContent = await fs.readFile(catsPath, 'utf-8');
        categories = JSON.parse(catsContent);
      } catch {
        // Categories file optional
      }
    }

    return this.transform({
      features,
      counters,
      kpis,
      dependencyGraph,
      categories,
    });
  }

  /**
   * Transform already-loaded skill data to RawFeatureData format
   */
  transform(skillData: SkillData): RawFeatureData[] {
    const { features, counters, kpis, dependencyGraph, categories } = skillData;

    // Build reverse category lookup
    const categoryByFaj = this.buildCategoryLookup(categories);

    // Build dependency lookups
    const { prerequisites, conflicts, related } = this.buildDependencyLookups(dependencyGraph);

    // Build counter lookup by feature
    const countersByFeature = this.buildCounterLookup(counters);

    // Build KPI lookup by feature
    const kpisByFeature = this.buildKpiLookup(kpis);

    // Transform each feature
    const result: RawFeatureData[] = [];

    for (const [fajKey, feature] of Object.entries(features)) {
      try {
        const transformed = this.transformFeature(
          fajKey,
          feature,
          categoryByFaj,
          prerequisites,
          conflicts,
          related,
          countersByFeature,
          kpisByFeature
        );
        result.push(transformed);
      } catch (error) {
        console.warn(`Failed to transform feature ${fajKey}:`, error);
      }
    }

    return result;
  }

  /**
   * Build reverse category lookup (FAJ -> category name)
   */
  private buildCategoryLookup(categories: SkillCategoryIndex): Map<string, string> {
    const lookup = new Map<string, string>();

    for (const [category, fajs] of Object.entries(categories)) {
      for (const faj of fajs) {
        lookup.set(faj, category);
      }
    }

    return lookup;
  }

  /**
   * Build dependency lookups from graph
   */
  private buildDependencyLookups(graph: SkillDependencyGraph): {
    prerequisites: Map<string, string[]>;
    conflicts: Map<string, string[]>;
    related: Map<string, string[]>;
  } {
    const prerequisites = new Map<string, string[]>();
    const conflicts = new Map<string, string[]>();
    const related = new Map<string, string[]>();

    // Prerequisites: "from" requires "to"
    for (const edge of graph.edges.prerequisite ?? []) {
      const existing = prerequisites.get(edge.from) ?? [];
      existing.push(edge.to);
      prerequisites.set(edge.from, existing);
    }

    // Conflicts
    for (const edge of graph.edges.conflicting ?? []) {
      const existing = conflicts.get(edge.from) ?? [];
      existing.push(edge.to);
      conflicts.set(edge.from, existing);
    }

    // Related
    for (const edge of graph.edges.related ?? []) {
      const existing = related.get(edge.from) ?? [];
      existing.push(edge.to);
      related.set(edge.from, existing);
    }

    return { prerequisites, conflicts, related };
  }

  /**
   * Build counter lookup by feature FAJ
   */
  private buildCounterLookup(counters: Record<string, SkillCounter>): Map<string, RawCounterData[]> {
    const lookup = new Map<string, RawCounterData[]>();

    for (const [fullName, counter] of Object.entries(counters)) {
      const rawCounter: RawCounterData = {
        name: fullName, // e.g., "EUtranCellFDD.pmMimoSleepTime"
        category: this.inferCounterCategory(counter.name),
        description: counter.description ?? undefined,
        unit: counter.unit ?? undefined,
      };

      for (const fajKey of counter.features) {
        const existing = lookup.get(fajKey) ?? [];
        existing.push(rawCounter);
        lookup.set(fajKey, existing);
      }
    }

    return lookup;
  }

  /**
   * Build KPI lookup by feature FAJ
   */
  private buildKpiLookup(kpis: Record<string, SkillKPI>): Map<string, RawKPIData[]> {
    const lookup = new Map<string, RawKPIData[]>();

    for (const [name, kpi] of Object.entries(kpis)) {
      const rawKpi: RawKPIData = {
        name,
        description: kpi.description ?? undefined,
      };

      for (const fajKey of kpi.features) {
        const existing = lookup.get(fajKey) ?? [];
        existing.push(rawKpi);
        lookup.set(fajKey, existing);
      }
    }

    return lookup;
  }

  /**
   * Infer counter category from name pattern
   */
  private inferCounterCategory(name: string): string {
    const lowerName = name.toLowerCase();

    if (lowerName.includes('att') || lowerName.includes('succ') || lowerName.includes('fail')) {
      return 'primary';
    }
    if (lowerName.includes('time') || lowerName.includes('duration')) {
      return 'contributing';
    }

    return 'contextual';
  }

  /**
   * Transform a single skill feature to RawFeatureData
   */
  private transformFeature(
    fajKey: string,
    feature: SkillFeature,
    categoryByFaj: Map<string, string>,
    prerequisites: Map<string, string[]>,
    conflicts: Map<string, string[]>,
    related: Map<string, string[]>,
    countersByFeature: Map<string, RawCounterData[]>,
    kpisByFeature: Map<string, RawKPIData[]>
  ): RawFeatureData {
    // Convert FAJ key (FAJ_121_3094) to FAJ code (FAJ 121 3094)
    const fajCode = this.fajKeyToCode(fajKey);

    // Transform parameters
    const parameters = this.transformParameters(feature);

    // Get counters for this feature
    const counters = countersByFeature.get(fajKey) ?? [];

    // Get KPIs for this feature
    const kpis = kpisByFeature.get(fajKey) ?? [];

    // Transform procedures
    const procedures = this.transformProcedures(feature);

    // Get dependencies
    const deps = (prerequisites.get(fajKey) ?? []).map(this.fajKeyToCode);
    const conf = (conflicts.get(fajKey) ?? []).map(this.fajKeyToCode);
    const rel = (related.get(fajKey) ?? []).map(this.fajKeyToCode);

    // Determine category
    const category = categoryByFaj.get(fajKey) ?? this.inferCategory(feature);

    // Determine access technology
    const accessTechnology = this.inferAccessTechnology(feature.access);

    return {
      fajCode,
      name: feature.name,
      description: feature.summary,
      category,
      accessTechnology,
      parameters,
      counters,
      kpis,
      procedures,
      dependencies: deps,
      conflicts: conf,
      relatedFeatures: rel,
    };
  }

  /**
   * Convert FAJ key (FAJ_121_3094) to FAJ code (FAJ 121 3094)
   */
  private fajKeyToCode(fajKey: string): string {
    // Handle both formats: FAJ_121_3094 or direct FAJ 121 3094
    if (fajKey.includes('_')) {
      return fajKey.replace(/_/g, ' ');
    }
    return fajKey;
  }

  /**
   * Transform parameters from skill format
   */
  private transformParameters(feature: SkillFeature): RawParameterData[] {
    const params: RawParameterData[] = [];

    // Use param_details if available for richer data
    if (feature.param_details) {
      for (const detail of feature.param_details) {
        const [moClass, attrName] = this.splitMoAttribute(detail.name);
        params.push({
          name: detail.name,
          description: detail.description ?? undefined,
          moClass,
          dataType: this.inferDataType(attrName),
        });
      }
    } else if (feature.params) {
      // Fall back to params array
      for (const param of feature.params) {
        const [moClass, attrName] = this.splitMoAttribute(param);
        params.push({
          name: param,
          moClass,
          dataType: this.inferDataType(attrName),
        });
      }
    }

    return params;
  }

  /**
   * Split MO.attribute into [moClass, attribute]
   */
  private splitMoAttribute(fullName: string): [string | undefined, string] {
    const dotIndex = fullName.indexOf('.');
    if (dotIndex === -1) {
      return [undefined, fullName];
    }
    return [fullName.substring(0, dotIndex), fullName.substring(dotIndex + 1)];
  }

  /**
   * Infer data type from parameter name
   */
  private inferDataType(name: string): string {
    const lowerName = name.toLowerCase();

    if (lowerName.includes('enabled') || lowerName.includes('active') ||
        lowerName.startsWith('is') || lowerName.startsWith('use')) {
      return 'boolean';
    }
    if (lowerName.includes('threshold') || lowerName.includes('timer') ||
        lowerName.includes('offset') || lowerName.includes('max') ||
        lowerName.includes('min') || lowerName.includes('count')) {
      return 'integer';
    }
    if (lowerName.includes('ratio') || lowerName.includes('factor')) {
      return 'float';
    }
    if (lowerName.includes('mode') || lowerName.includes('state') ||
        lowerName.includes('type') || lowerName.includes('method')) {
      return 'enum';
    }

    return 'string';
  }

  /**
   * Transform activation/deactivation procedures
   */
  private transformProcedures(feature: SkillFeature): RawProcedureData[] {
    const procedures: RawProcedureData[] = [];

    if (feature.activation) {
      procedures.push({
        name: 'Activation',
        description: `Activate ${feature.name}`,
        steps: (feature.activation.steps ?? []).map((step, i) => ({
          order: i + 1,
          description: step,
        })),
        prerequisites: feature.activation.prerequisites,
      });
    }

    if (feature.deactivation) {
      procedures.push({
        name: 'Deactivation',
        description: `Deactivate ${feature.name}`,
        steps: (feature.deactivation.steps ?? []).map((step, i) => ({
          order: i + 1,
          description: step,
        })),
        prerequisites: feature.deactivation.prerequisites,
      });
    }

    return procedures;
  }

  /**
   * Infer category from feature data
   */
  private inferCategory(feature: SkillFeature): string {
    const name = feature.name.toLowerCase();
    const summary = (feature.summary ?? '').toLowerCase();
    const text = `${name} ${summary}`;

    if (text.includes('carrier aggregation') || text.includes(' ca ')) {
      return 'Carrier Aggregation';
    }
    if (text.includes('mimo') || text.includes('beamforming') || text.includes('antenna')) {
      return 'MIMO & Antenna';
    }
    if (text.includes('handover') || text.includes('mobility') || text.includes('anr')) {
      return 'Mobility';
    }
    if (text.includes('load') || text.includes('scheduling') || text.includes('admission')) {
      return 'Radio Resource Management';
    }
    if (text.includes('nr ') || text.includes('5g') || text.includes('en-dc') || text.includes('nsa')) {
      return 'NR/5G';
    }
    if (text.includes('energy') || text.includes('sleep') || text.includes('power saving')) {
      return 'Energy Saving';
    }
    if (text.includes('voice') || text.includes('volte') || text.includes('ims')) {
      return 'Voice & IMS';
    }
    if (text.includes('transport') || text.includes('fronthaul') || text.includes('backhaul')) {
      return 'Transport';
    }
    if (text.includes('coverage') || text.includes('capacity')) {
      return 'Coverage & Capacity';
    }

    return 'Other';
  }

  /**
   * Infer access technology from array
   */
  private inferAccessTechnology(access?: string[]): string {
    if (!access || access.length === 0) {
      return 'LTE';
    }

    if (access.includes('NR') && access.includes('LTE')) {
      return 'CrossRAT';
    }
    if (access.includes('NR')) {
      return 'NR';
    }
    if (access.includes('GSM')) {
      return 'GSM';
    }

    return 'LTE';
  }
}

/**
 * Load features from the Ericsson RAN skill
 *
 * @param projectRoot - Path to project root containing .claude/skills/
 * @param config - Optional adapter configuration
 */
export async function loadFromSkill(
  projectRoot: string,
  config?: SkillDataAdapterConfig
): Promise<RawFeatureData[]> {
  const adapter = new SkillDataAdapter(config);
  return adapter.loadFromSkill(projectRoot);
}
