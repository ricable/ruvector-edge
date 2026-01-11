/**
 * Integration Tests: TypeScript API Examples
 * Tests the documented API usage patterns from the skill
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

// Get project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../../..');

describe('TypeScript API Examples', () => {
  let loadSkillCatalog: any;
  let Category: any;
  let AccessTechnology: any;
  let catalog: any;

  const skillPath = resolve(PROJECT_ROOT, '.claude/skills/ericsson-ran-features/references/features.json');
  const skillAvailable = existsSync(skillPath);

  describe.runIf(skillAvailable)('Documented API Usage', () => {
    beforeAll(async () => {
      const knowledgeModule = await import(`${PROJECT_ROOT}/src/core/knowledge/index.js`);
      loadSkillCatalog = knowledgeModule.loadSkillCatalog;

      const typesModule = await import(`${PROJECT_ROOT}/src/core/types/index.js`);
      Category = typesModule.Category;
      AccessTechnology = typesModule.AccessTechnology;

      catalog = await loadSkillCatalog(PROJECT_ROOT);
    });

    describe('Example 1: Load catalog', () => {
      it('should load catalog (593 features, 16K params, 5K counters)', () => {
        expect(catalog).toBeDefined();
        expect(catalog.size).toBeGreaterThan(500);

        const stats = catalog.getStats();
        expect(stats.totalFeatures).toBeGreaterThan(500);
        expect(stats.totalParameters).toBeGreaterThan(1000);
        expect(stats.totalCounters).toBeGreaterThan(1000);
      });
    });

    describe('Example 2: Search by name', () => {
      it('const results = catalog.searchByName("MIMO Sleep");', () => {
        const results = catalog.searchByName('MIMO Sleep');

        expect(results).toBeDefined();
        expect(results.length).toBeGreaterThan(0);

        const msm = results[0];
        expect(msm.name).toContain('MIMO Sleep');
        expect(msm.acronym).toBe('MSM');
        expect(msm.fajCode).toBe('FAJ 121 3094');
      });

      it('should find features with partial name match', () => {
        const results = catalog.searchByName('load balancing');
        expect(results.length).toBeGreaterThan(0);
      });

      it('should be case-insensitive', () => {
        const lower = catalog.searchByName('mimo sleep');
        const upper = catalog.searchByName('MIMO SLEEP');

        expect(lower.length).toBe(upper.length);
      });
    });

    describe('Example 3: Filter by category', () => {
      it('const caFeatures = catalog.getByCategory(Category.CarrierAggregation);', () => {
        const caFeatures = catalog.getByCategory(Category.CarrierAggregation);

        expect(caFeatures).toBeDefined();
        expect(caFeatures.length).toBeGreaterThan(30);

        // Verify all features are CA related
        caFeatures.forEach(feature => {
          expect(feature.category).toBe(Category.CarrierAggregation);
        });
      });

      it('should have multiple categories', () => {
        const categories = new Set();
        const allFeatures = catalog.getAll();
        allFeatures.forEach(f => {
          categories.add(f.category);
        });

        expect(categories.size).toBeGreaterThan(10);
      });

      it('should support Energy Saving category', () => {
        const energyFeatures = catalog.getByCategory(Category.EnergySaving);
        expect(energyFeatures.length).toBeGreaterThan(10);
      });

      it('should support MIMO category', () => {
        const mimoFeatures = catalog.getByCategory(Category.MIMO);
        expect(mimoFeatures.length).toBeGreaterThan(20);
      });
    });

    describe('Example 4: Filter by technology', () => {
      it('const nrFeatures = catalog.getByAccessTechnology(AccessTechnology.NR);', () => {
        const nrFeatures = catalog.getByAccessTechnology(AccessTechnology.NR);

        expect(nrFeatures).toBeDefined();
        expect(nrFeatures.length).toBeGreaterThan(100);

        // Verify all features have NR access
        nrFeatures.forEach(feature => {
          expect(feature.accessTechnology).toBe(AccessTechnology.NR);
        });
      });

      it('should support LTE technology', () => {
        const lteFeatures = catalog.getByAccessTechnology(AccessTechnology.LTE);
        expect(lteFeatures.length).toBeGreaterThan(200);
      });

      it('should have both LTE and NR features', () => {
        const lte = catalog.getByAccessTechnology(AccessTechnology.LTE);
        const nr = catalog.getByAccessTechnology(AccessTechnology.NR);

        expect(lte.length).toBeGreaterThan(0);
        expect(nr.length).toBeGreaterThan(0);
      });
    });

    describe('Example 5: Feature details', () => {
      it('should include parameters, counters, KPIs, and procedures', () => {
        const results = catalog.searchByName('MIMO Sleep');
        expect(results.length).toBeGreaterThan(0);

        const msm = results[0];

        expect(msm.parameters).toBeDefined();
        expect(msm.parameters.length).toBeGreaterThan(10);

        expect(msm.counters).toBeDefined();
        expect(msm.counters.length).toBeGreaterThan(0);

        expect(msm.kpis).toBeDefined();
        expect(msm.kpis.length).toBeGreaterThanOrEqual(0);

        expect(msm.procedures).toBeDefined();
        expect(msm.procedures.length).toBeGreaterThan(0);
      });

      it('should include FAJ, CXC, and acronym', () => {
        const results = catalog.searchByName('MIMO Sleep');
        const msm = results[0];

        expect(msm.fajCode).toBe('FAJ 121 3094');
        expect(msm.cxcCode).toBe('CXC4011808');
        expect(msm.acronym).toBe('MSM');
      });

      it('should include description', () => {
        const results = catalog.searchByName('MIMO Sleep');
        const msm = results[0];

        expect(msm.description).toBeDefined();
        expect(msm.description.length).toBeGreaterThan(50);
      });

      it('should include dependencies and conflicts', () => {
        const results = catalog.searchByName('Inter-Frequency Load Balancing');
        if (results.length > 0) {
          const iflb = results[0];

          expect(iflb.dependencies).toBeDefined();
          expect(iflb.conflicts).toBeDefined();
        }
      });
    });

    describe('Example 6: Catalog statistics', () => {
      it('should provide accurate statistics', () => {
        const stats = catalog.getStats();

        expect(stats.totalFeatures).toBeGreaterThan(500);
        expect(stats.totalParameters).toBeGreaterThan(10000);
        expect(stats.totalCounters).toBeGreaterThan(1000);
        expect(stats.totalKPIs).toBeGreaterThan(100);
      });
    });

    describe('Example 7: Get all features', () => {
      it('const allFeatures = catalog.getAll();', () => {
        const allFeatures = catalog.getAll();

        expect(allFeatures).toBeDefined();
        expect(allFeatures.length).toBeGreaterThan(500);

        // Verify structure
        allFeatures.slice(0, 10).forEach(feature => {
          expect(feature.name).toBeDefined();
          expect(feature.fajCode).toBeDefined();
          expect(feature.acronym).toBeDefined();
          expect(feature.parameters).toBeDefined();
        });
      });
    });

    describe('Example 8: IFLB Query', () => {
      it('should find IFLB and its configuration', () => {
        const iflbResults = catalog.searchByName('Inter-Frequency Load Balancing');
        expect(iflbResults.length).toBeGreaterThan(0);

        const iflb = iflbResults[0];
        expect(iflb.name).toContain('Inter-Frequency Load Balancing');
        expect(iflb.acronym).toBe('IFLB');
        expect(iflb.fajCode).toBe('FAJ 121 3009');

        // Should have many parameters
        expect(iflb.parameters.length).toBeGreaterThan(50);

        // Should have dependencies
        expect(iflb.dependencies).toBeDefined();
        expect(iflb.dependencies.length).toBeGreaterThan(0);
      });
    });

    describe('Example 9: Features with most parameters', () => {
      it('should find feature with most parameters', () => {
        const allFeatures = catalog.getAll();
        const sorted = allFeatures.sort(
          (a, b) => b.parameters.length - a.parameters.length
        );

        const topFeature = sorted[0];
        expect(topFeature.parameters.length).toBeGreaterThan(50);

        // Top 5 should all have significant parameters
        sorted.slice(0, 5).forEach(feature => {
          expect(feature.parameters.length).toBeGreaterThan(30);
        });
      });
    });

    describe('Example 10: API consistency', () => {
      it('all search methods should return feature objects with consistent structure', () => {
        const methods = [
          () => catalog.searchByName('MIMO'),
          () => catalog.getByCategory(Category.MIMO),
          () => catalog.getByAccessTechnology(AccessTechnology.LTE),
          () => catalog.getAll(),
        ];

        methods.forEach(method => {
          const features = method();
          expect(features.length).toBeGreaterThan(0);

          features.slice(0, 3).forEach(feature => {
            expect(feature.name).toBeDefined();
            expect(feature.fajCode).toBeDefined();
            expect(feature.acronym).toBeDefined();
            expect(feature.parameters).toBeInstanceOf(Array);
            expect(feature.counters).toBeInstanceOf(Array);
            expect(feature.accessTechnology).toBeDefined();
          });
        });
      });
    });
  });
});
