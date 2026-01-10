/**
 * ELEX Edge AI Agent Swarm - Knowledge Loader
 *
 * Loads 593 Ericsson RAN feature definitions from various sources.
 * Supports JSON files, remote APIs, and embedded data.
 */

import type {
  Feature,
  FAJCode,
  ParameterDefinition,
  CounterDefinition,
  KPIDefinition,
  Procedure,
} from '../types/index.js';
import {
  FAJCode as FAJCodeClass,
  Category,
  AccessTechnology,
  CounterCategory,
  DataType,
  createFeatureId,
} from '../types/index.js';
import { FeatureCatalog } from './FeatureCatalog.js';

/**
 * Raw feature data from JSON
 */
export interface RawFeatureData {
  fajCode: string;
  name: string;
  description?: string;
  category?: string;
  accessTechnology?: string;
  parameters?: RawParameterData[];
  counters?: RawCounterData[];
  kpis?: RawKPIData[];
  procedures?: RawProcedureData[];
  dependencies?: string[];
  conflicts?: string[];
  relatedFeatures?: string[];
}

export interface RawParameterData {
  name: string;
  dataType?: string;
  defaultValue?: string | number | boolean;
  min?: number;
  max?: number;
  changeLimit?: number;
  cooldown?: number;
  safeMin?: number;
  safeMax?: number;
  description?: string;
  moClass?: string;
}

export interface RawCounterData {
  name: string;
  category?: string;
  description?: string;
  unit?: string;
  aggregationType?: string;
}

export interface RawKPIData {
  name: string;
  formula?: string;
  thresholdMin?: number;
  thresholdMax?: number;
  unit?: string;
  description?: string;
}

export interface RawProcedureData {
  name: string;
  description?: string;
  steps: Array<{
    order: number;
    description: string;
    command?: string;
    verification?: string;
  }>;
  prerequisites?: string[];
}

/**
 * Loader configuration
 */
export interface KnowledgeLoaderConfig {
  validateFajCodes?: boolean;
  strictMode?: boolean;
  defaultCategory?: Category;
  defaultTechnology?: AccessTechnology;
}

/**
 * Loading result
 */
export interface LoadingResult {
  loaded: number;
  failed: number;
  errors: Array<{ fajCode: string; error: string }>;
  catalog: FeatureCatalog;
}

/**
 * Knowledge Loader
 *
 * Loads and parses feature definitions into the catalog.
 */
export class KnowledgeLoader {
  private readonly config: Required<KnowledgeLoaderConfig>;

  constructor(config: KnowledgeLoaderConfig = {}) {
    this.config = {
      validateFajCodes: config.validateFajCodes ?? true,
      strictMode: config.strictMode ?? false,
      defaultCategory: config.defaultCategory ?? Category.Other,
      defaultTechnology: config.defaultTechnology ?? AccessTechnology.LTE,
    };
  }

  /**
   * Load features from JSON data
   */
  loadFromJSON(data: RawFeatureData[], catalog?: FeatureCatalog): LoadingResult {
    const targetCatalog = catalog ?? new FeatureCatalog();
    const result: LoadingResult = {
      loaded: 0,
      failed: 0,
      errors: [],
      catalog: targetCatalog,
    };

    for (const rawFeature of data) {
      try {
        const feature = this.parseFeature(rawFeature);
        targetCatalog.add(feature);
        result.loaded++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push({
          fajCode: rawFeature.fajCode ?? 'unknown',
          error: errorMessage,
        });
        result.failed++;

        if (this.config.strictMode) {
          throw error;
        }
      }
    }

    return result;
  }

  /**
   * Load features from a JSON file (Node.js only)
   * Note: This method only works in Node.js environments
   */
  async loadFromFile(filePath: string, catalog?: FeatureCatalog): Promise<LoadingResult> {
    // Dynamic import for Node.js fs module
    // This will throw in browser environments
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as RawFeatureData[];
    return this.loadFromJSON(data, catalog);
  }

  /**
   * Load features from a remote URL
   */
  async loadFromURL(url: string, catalog?: FeatureCatalog): Promise<LoadingResult> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch features from ${url}: ${response.status}`);
    }
    const data = await response.json() as RawFeatureData[];
    return this.loadFromJSON(data, catalog);
  }

  /**
   * Parse a single raw feature into a Feature object
   */
  parseFeature(raw: RawFeatureData): Feature {
    // Validate and create FAJ code
    let fajCode: FAJCode;
    if (this.config.validateFajCodes) {
      fajCode = FAJCodeClass.create(raw.fajCode);
    } else {
      fajCode = FAJCodeClass.unsafe(raw.fajCode);
    }

    // Generate feature ID from FAJ code
    const id = createFeatureId(`feature-${fajCode.numericId}`);

    // Parse category
    const category = this.parseCategory(raw.category);

    // Parse access technology
    const accessTechnology = this.parseAccessTechnology(raw.accessTechnology);

    // Parse parameters
    const parameters = (raw.parameters ?? []).map(p => this.parseParameter(p));

    // Parse counters
    const counters = (raw.counters ?? []).map(c => this.parseCounter(c));

    // Parse KPIs
    const kpis = (raw.kpis ?? []).map(k => this.parseKPI(k));

    // Parse procedures
    const procedures = (raw.procedures ?? []).map(p => this.parseProcedure(p));

    // Parse dependencies (convert FAJ codes to feature IDs)
    const dependencies = (raw.dependencies ?? []).map(d =>
      createFeatureId(`feature-${d.replace(/\s+/g, '')}`)
    );

    // Parse conflicts
    const conflicts = (raw.conflicts ?? []).map(c =>
      createFeatureId(`feature-${c.replace(/\s+/g, '')}`)
    );

    // Parse related features
    const relatedFeatures = (raw.relatedFeatures ?? []).map(r =>
      createFeatureId(`feature-${r.replace(/\s+/g, '')}`)
    );

    return {
      id,
      fajCode,
      name: raw.name,
      description: raw.description,
      category,
      accessTechnology,
      parameters,
      counters,
      kpis,
      procedures,
      dependencies,
      conflicts,
      relatedFeatures,
    };
  }

  /**
   * Parse category string to enum
   */
  private parseCategory(value?: string): Category {
    if (!value) {
      return this.config.defaultCategory;
    }

    const normalized = value.toUpperCase().replace(/[^A-Z]/g, '');

    // Map common variations (including skill category names from index_categories.json)
    const categoryMap: Record<string, Category> = {
      // Short codes
      CA: Category.CarrierAggregation,
      RRM: Category.RadioResourceManagement,
      MIMO: Category.MIMO,
      NR: Category.NR,
      QOS: Category.QoS,
      UE: Category.UEHandling,

      // Skill categories (normalized from index_categories.json)
      CARRIERAGGREGATION: Category.CarrierAggregation,
      COVERAGECAPACITY: Category.Coverage,
      ENERGYSAVING: Category.EnergySaving,
      INTERFERENCEMANAGEMENT: Category.Interference,
      MIMOANTENNA: Category.MIMO,
      MOBILITYHANDOVER: Category.Mobility,
      NR5G: Category.NR,
      POSITIONING: Category.Other, // No specific enum, map to Other
      QOSSCHEDULING: Category.QoS,
      RADIORESOURCEMANAGEMENT: Category.RadioResourceManagement,
      SECURITY: Category.Security,
      TIMINGSYNC: Category.Timing,
      TRANSPORTCONNECTIVITY: Category.Transport,
      UEHANDLING: Category.UEHandling,
      VOICEIMS: Category.Voice,
      OTHER: Category.Other,

      // Additional variations
      MOBILITY: Category.Mobility,
      HANDOVER: Category.Mobility,
      '5G': Category.NR,
      COVERAGE: Category.Coverage,
      CAPACITY: Category.Coverage,
      TRANSPORT: Category.Transport,
      VOICE: Category.Voice,
      IMS: Category.Voice,
      INTERFERENCE: Category.Interference,
      SCHEDULING: Category.QoS,
      TIMING: Category.Timing,
      SYNC: Category.Timing,
      ENERGY: Category.EnergySaving,
    };

    return categoryMap[normalized] ?? this.config.defaultCategory;
  }

  /**
   * Parse access technology string to enum
   */
  private parseAccessTechnology(value?: string): AccessTechnology {
    if (!value) {
      return this.config.defaultTechnology;
    }

    const normalized = value.toUpperCase();

    switch (normalized) {
      case 'LTE':
      case '4G':
      case 'EUTRAN':
        return AccessTechnology.LTE;
      case 'NR':
      case '5G':
      case 'NGNB':
        return AccessTechnology.NR;
      case 'GSM':
      case '2G':
        return AccessTechnology.GSM;
      case 'CROSSRAT':
      case 'CROSS-RAT':
      case 'MULTI-RAT':
        return AccessTechnology.CrossRAT;
      default:
        return this.config.defaultTechnology;
    }
  }

  /**
   * Parse parameter definition
   */
  private parseParameter(raw: RawParameterData): ParameterDefinition {
    const constraints = raw.min !== undefined || raw.max !== undefined || raw.changeLimit !== undefined
      ? {
          min: raw.min,
          max: raw.max,
          changeLimit: raw.changeLimit,
          cooldown: raw.cooldown,
        }
      : undefined;

    const safeZone = raw.safeMin !== undefined && raw.safeMax !== undefined
      ? {
          min: raw.safeMin,
          max: raw.safeMax,
          changeLimit: raw.changeLimit ?? 15,
          cooldown: raw.cooldown ?? 60 * 60 * 1000, // 1 hour default
        }
      : undefined;

    return {
      name: raw.name,
      dataType: this.parseDataType(raw.dataType),
      defaultValue: raw.defaultValue,
      constraints,
      safeZone,
      description: raw.description,
      moClass: raw.moClass,
    };
  }

  /**
   * Parse data type string to enum
   */
  private parseDataType(value?: string): DataType {
    if (!value) {
      return DataType.String;
    }

    const normalized = value.toLowerCase();

    switch (normalized) {
      case 'integer':
      case 'int':
      case 'long':
        return DataType.Integer;
      case 'float':
      case 'double':
      case 'decimal':
      case 'number':
        return DataType.Float;
      case 'boolean':
      case 'bool':
        return DataType.Boolean;
      case 'enum':
      case 'enumeration':
        return DataType.Enum;
      default:
        return DataType.String;
    }
  }

  /**
   * Parse counter definition
   */
  private parseCounter(raw: RawCounterData): CounterDefinition {
    return {
      name: raw.name,
      category: this.parseCounterCategory(raw.category),
      description: raw.description,
      unit: raw.unit,
      aggregationType: (raw.aggregationType as CounterDefinition['aggregationType']) ?? 'sum',
    };
  }

  /**
   * Parse counter category string to enum
   */
  private parseCounterCategory(value?: string): CounterCategory {
    if (!value) {
      return CounterCategory.Contextual;
    }

    const normalized = value.toLowerCase();

    switch (normalized) {
      case 'primary':
      case 'main':
      case 'kpi':
        return CounterCategory.Primary;
      case 'contributing':
      case 'secondary':
        return CounterCategory.Contributing;
      default:
        return CounterCategory.Contextual;
    }
  }

  /**
   * Parse KPI definition
   */
  private parseKPI(raw: RawKPIData): KPIDefinition {
    return {
      name: raw.name,
      formula: raw.formula,
      thresholdMin: raw.thresholdMin,
      thresholdMax: raw.thresholdMax,
      unit: raw.unit,
      description: raw.description,
    };
  }

  /**
   * Parse procedure definition
   */
  private parseProcedure(raw: RawProcedureData): Procedure {
    return {
      name: raw.name,
      description: raw.description,
      steps: raw.steps.map(s => ({
        order: s.order,
        description: s.description,
        command: s.command,
        verification: s.verification,
      })),
      prerequisites: raw.prerequisites,
    };
  }

  /**
   * Create sample feature data for testing
   */
  static createSampleFeatures(): RawFeatureData[] {
    return [
      // Carrier Aggregation features
      {
        fajCode: 'FAJ 121 3001',
        name: 'Carrier Aggregation 2CC',
        description: 'Two Component Carrier aggregation for increased bandwidth',
        category: 'CA',
        accessTechnology: 'LTE',
        parameters: [
          { name: 'caCombinationMode', dataType: 'enum', defaultValue: 'auto' },
          { name: 'maxUePerCell', dataType: 'integer', min: 1, max: 1000, defaultValue: 100 },
        ],
        counters: [
          { name: 'pmCaUeAttach', category: 'primary', description: 'CA UE attach attempts' },
        ],
        kpis: [
          { name: 'CA Activation Rate', formula: 'pmCaActivated / pmCaAttempted * 100', unit: '%' },
        ],
      },
      {
        fajCode: 'FAJ 121 3002',
        name: 'Carrier Aggregation 3CC',
        description: 'Three Component Carrier aggregation',
        category: 'CA',
        accessTechnology: 'LTE',
      },
      // MIMO features
      {
        fajCode: 'FAJ 121 3094',
        name: 'MIMO Sleep Mode',
        description: 'Energy saving feature for MIMO antennas',
        category: 'MIMO',
        accessTechnology: 'LTE',
        parameters: [
          { name: 'mimoSleepEnabled', dataType: 'boolean', defaultValue: false },
          { name: 'sleepThreshold', dataType: 'integer', min: 0, max: 100, safeMin: 20, safeMax: 80 },
        ],
        procedures: [
          {
            name: 'Enable MIMO Sleep',
            description: 'Steps to enable MIMO sleep mode',
            steps: [
              { order: 1, description: 'Verify cell load is below threshold' },
              { order: 2, description: 'Set mimoSleepEnabled=true', command: 'cmedit set $cell mimoSleepEnabled=true' },
              { order: 3, description: 'Monitor KPIs for 30 minutes' },
            ],
          },
        ],
      },
      // RRM features
      {
        fajCode: 'FAJ 121 4001',
        name: 'Inter-Frequency Load Balancing',
        description: 'Balance load between frequency layers',
        category: 'RRM',
        accessTechnology: 'LTE',
        parameters: [
          { name: 'iflbEnabled', dataType: 'boolean', defaultValue: false },
          { name: 'lbActivationThreshold', dataType: 'integer', min: 10, max: 100, safeMin: 50, safeMax: 90, changeLimit: 15 },
        ],
        counters: [
          { name: 'pmIflbUeMoved', category: 'primary', description: 'UEs moved by IFLB' },
          { name: 'pmIflbAttempts', category: 'contributing' },
        ],
        kpis: [
          { name: 'IFLB Success Rate', formula: 'pmIflbUeMoved / pmIflbAttempts * 100', unit: '%' },
        ],
      },
      // NR features
      {
        fajCode: 'FAJ 121 5001',
        name: 'EN-DC (E-UTRAN NR Dual Connectivity)',
        description: 'Dual connectivity between LTE and NR',
        category: 'NR',
        accessTechnology: 'NR',
        parameters: [
          { name: 'endcEnabled', dataType: 'boolean', defaultValue: false },
          { name: 'splitBearerMode', dataType: 'enum', defaultValue: 'MCG_SPLIT' },
        ],
        counters: [
          { name: 'pmEndcSetupAtt', category: 'primary' },
          { name: 'pmEndcSetupSucc', category: 'primary' },
        ],
        kpis: [
          { name: 'EN-DC Setup Success Rate', formula: 'pmEndcSetupSucc / pmEndcSetupAtt * 100', unit: '%' },
        ],
      },
      {
        fajCode: 'FAJ 121 5002',
        name: 'Dynamic Spectrum Sharing',
        description: 'Share spectrum between LTE and NR dynamically',
        category: 'NR',
        accessTechnology: 'CrossRAT',
        parameters: [
          { name: 'dssEnabled', dataType: 'boolean', defaultValue: false },
          { name: 'nrAllocationRatio', dataType: 'float', min: 0.0, max: 1.0, defaultValue: 0.5 },
        ],
      },
    ];
  }
}

/**
 * Load the default feature catalog with sample data
 */
export async function loadDefaultCatalog(): Promise<FeatureCatalog> {
  const loader = new KnowledgeLoader({ validateFajCodes: false });
  const sampleData = KnowledgeLoader.createSampleFeatures();
  const result = loader.loadFromJSON(sampleData);
  return result.catalog;
}
