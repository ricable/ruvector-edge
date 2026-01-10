/**
 * ELEX Edge AI Agent Swarm - Knowledge Module
 *
 * Exports knowledge-related classes and functions.
 *
 * The knowledge module loads 593 Ericsson RAN features from:
 * - Skill data: .claude/skills/ericsson-ran-features/references/
 * - JSON files or remote APIs
 *
 * @example
 * ```typescript
 * import { loadSkillCatalog, FeatureCatalog } from './core/knowledge';
 *
 * // Load from skill (593 real features)
 * const catalog = await loadSkillCatalog('/path/to/project');
 *
 * // Query features
 * const iflb = catalog.search('IFLB')[0];
 * const lteFeatures = catalog.getByTechnology(AccessTechnology.LTE);
 * ```
 */

export {
  FeatureCatalog,
  getGlobalCatalog,
  resetGlobalCatalog,
  type CatalogStats,
  type FeatureSearchOptions,
} from './FeatureCatalog.js';

export {
  KnowledgeLoader,
  loadDefaultCatalog,
  type RawFeatureData,
  type RawParameterData,
  type RawCounterData,
  type RawKPIData,
  type RawProcedureData,
  type KnowledgeLoaderConfig,
  type LoadingResult,
} from './KnowledgeLoader.js';

export {
  SkillDataAdapter,
  loadFromSkill,
  DEFAULT_SKILL_PATH,
  type SkillFeature,
  type SkillCounter,
  type SkillKPI,
  type SkillDependencyGraph,
  type SkillCategoryIndex,
  type SkillData,
  type SkillDataAdapterConfig,
} from './SkillDataAdapter.js';

/**
 * Load feature catalog from the Ericsson RAN skill
 *
 * This is the recommended way to load the full 593 feature catalog
 * from the skill at .claude/skills/ericsson-ran-features/
 *
 * @param projectRoot - Path to project root containing .claude/skills/
 * @returns Populated FeatureCatalog with 593 features
 */
export async function loadSkillCatalog(projectRoot: string): Promise<import('./FeatureCatalog.js').FeatureCatalog> {
  const { SkillDataAdapter } = await import('./SkillDataAdapter.js');
  const { KnowledgeLoader } = await import('./KnowledgeLoader.js');
  const { FeatureCatalog } = await import('./FeatureCatalog.js');

  // Load from skill
  const adapter = new SkillDataAdapter();
  const rawData = await adapter.loadFromSkill(projectRoot);

  // Transform and load into catalog
  const loader = new KnowledgeLoader({ validateFajCodes: false });
  const result = loader.loadFromJSON(rawData);

  if (result.failed > 0) {
    console.warn(`Failed to load ${result.failed} features:`, result.errors.slice(0, 5));
  }

  console.log(`Loaded ${result.loaded} features from Ericsson RAN skill`);
  return result.catalog;
}
