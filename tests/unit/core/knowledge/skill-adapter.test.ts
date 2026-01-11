/**
 * Tests for SkillDataAdapter
 *
 * Verifies that the adapter correctly transforms skill data from
 * .claude/skills/ericsson-ran-features/ to the KnowledgeLoader format.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

import {
  SkillDataAdapter,
  loadFromSkill,
  DEFAULT_SKILL_PATH,
} from '../../../src/core/knowledge/SkillDataAdapter.js';
import { KnowledgeLoader } from '../../../src/core/knowledge/KnowledgeLoader.js';
import { loadSkillCatalog } from '../../../src/core/knowledge/index.js';

// Get project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../../..');

describe('SkillDataAdapter', () => {
  // Check if skill is available
  const skillPath = resolve(PROJECT_ROOT, DEFAULT_SKILL_PATH);
  const skillAvailable = existsSync(resolve(skillPath, 'features.json'));

  describe.runIf(skillAvailable)('with skill data', () => {
    let adapter: SkillDataAdapter;
    let rawFeatures: Awaited<ReturnType<typeof loadFromSkill>>;

    beforeAll(async () => {
      adapter = new SkillDataAdapter();
      rawFeatures = await adapter.loadFromSkill(PROJECT_ROOT);
    });

    it('should load all features from skill', () => {
      // Skill has 593 features (530 indexed according to SKILL.md)
      expect(rawFeatures.length).toBeGreaterThan(500);
    });

    it('should transform FAJ codes correctly', () => {
      const msmFeature = rawFeatures.find(f => f.name === 'MIMO Sleep Mode');
      expect(msmFeature).toBeDefined();
      expect(msmFeature?.fajCode).toBe('FAJ 121 3094');
    });

    it('should include parameters from param_details', () => {
      const msmFeature = rawFeatures.find(f => f.name === 'MIMO Sleep Mode');
      expect(msmFeature?.parameters).toBeDefined();
      expect(msmFeature?.parameters?.length).toBeGreaterThan(10);

      // Check parameter structure
      const sleepModeParam = msmFeature?.parameters?.find(
        p => p.name.includes('sleepMode')
      );
      expect(sleepModeParam).toBeDefined();
    });

    it('should include counters', () => {
      // Features should have counters from counters.json
      const featuresWithCounters = rawFeatures.filter(
        f => f.counters && f.counters.length > 0
      );
      expect(featuresWithCounters.length).toBeGreaterThan(100);
    });

    it('should include KPIs', () => {
      // Features should have KPIs from kpis.json
      const featuresWithKpis = rawFeatures.filter(
        f => f.kpis && f.kpis.length > 0
      );
      expect(featuresWithKpis.length).toBeGreaterThan(50);
    });

    it('should set category from index_categories.json', () => {
      // Carrier Aggregation features should be categorized
      const caFeatures = rawFeatures.filter(
        f => f.category === 'Carrier Aggregation'
      );
      expect(caFeatures.length).toBeGreaterThan(30);
    });

    it('should set access technology correctly', () => {
      const lteFeatures = rawFeatures.filter(f => f.accessTechnology === 'LTE');
      const nrFeatures = rawFeatures.filter(f => f.accessTechnology === 'NR');

      expect(lteFeatures.length).toBeGreaterThan(200);
      expect(nrFeatures.length).toBeGreaterThan(100);
    });

    it('should include dependencies from dependency_graph.json', () => {
      // Some features should have dependencies
      const featuresWithDeps = rawFeatures.filter(
        f => f.dependencies && f.dependencies.length > 0
      );
      expect(featuresWithDeps.length).toBeGreaterThan(10);
    });

    it('should transform to valid RawFeatureData format', () => {
      const loader = new KnowledgeLoader({ validateFajCodes: false });
      const result = loader.loadFromJSON(rawFeatures);

      // Should successfully load most features
      expect(result.loaded).toBeGreaterThan(500);
      expect(result.failed).toBeLessThan(100);
    });
  });

  describe('without skill data', () => {
    it('should use correct default path', () => {
      expect(DEFAULT_SKILL_PATH).toBe('.claude/skills/ericsson-ran-features/references');
    });

    it('should support custom skill path', () => {
      const adapter = new SkillDataAdapter({
        skillPath: 'custom/path/to/skill',
      });
      expect(adapter).toBeDefined();
    });
  });
});

describe.runIf(existsSync(resolve(PROJECT_ROOT, DEFAULT_SKILL_PATH, 'features.json')))(
  'loadSkillCatalog',
  () => {
    it('should load full catalog from skill', async () => {
      const catalog = await loadSkillCatalog(PROJECT_ROOT);

      // Should have loaded 500+ features
      expect(catalog.size).toBeGreaterThan(500);

      // Should be able to search
      const searchResults = catalog.searchByName('MIMO');
      expect(searchResults.length).toBeGreaterThan(5);

      // Should be able to get stats
      const stats = catalog.getStats();
      expect(stats.totalFeatures).toBeGreaterThan(500);
      expect(stats.totalParameters).toBeGreaterThan(1000);
    });

    it('should support category filtering', async () => {
      const catalog = await loadSkillCatalog(PROJECT_ROOT);
      const { Category } = await import('../../../src/core/types/index.js');

      const mimoFeatures = catalog.getByCategory(Category.MIMO);
      expect(mimoFeatures.length).toBeGreaterThan(20);
    });

    it('should support technology filtering', async () => {
      const catalog = await loadSkillCatalog(PROJECT_ROOT);
      const { AccessTechnology } = await import('../../../src/core/types/index.js');

      const lteFeatures = catalog.getByAccessTechnology(AccessTechnology.LTE);
      expect(lteFeatures.length).toBeGreaterThan(200);

      const nrFeatures = catalog.getByAccessTechnology(AccessTechnology.NR);
      expect(nrFeatures.length).toBeGreaterThan(100);
    });
  }
);
