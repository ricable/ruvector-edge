import { describe, it, expect } from 'vitest';
import { AgentId } from '@/domains/knowledge/value-objects';

describe('AgentId', () => {
  describe('creation', () => {
    it('should create with valid UUID', () => {
      const id = new AgentId();
      expect(id.value).toBeDefined();
      expect(id.value.length).toBe(36); // UUID length
    });

    it('should create with custom value', () => {
      const customValue = '123e4567-e89b-12d3-a456-426614174000';
      const id = new AgentId(customValue);
      expect(id.value).toBe(customValue);
    });

    it('should throw for invalid UUID', () => {
      expect(() => {
        new AgentId('invalid-uuid');
      }).toThrow();
    });

    it('should throw for empty string', () => {
      expect(() => {
        new AgentId('');
      }).toThrow();
    });
  });

  describe('equality', () => {
    it('should be equal to same value', () => {
      const value = '123e4567-e89b-12d3-a456-426614174000';
      const id1 = new AgentId(value);
      const id2 = new AgentId(value);

      expect(id1.equals(id2)).toBe(true);
      expect(id1 === id2).toBe(false); // Different instances
    });

    it('should not be equal to different value', () => {
      const id1 = new AgentId('123e4567-e89b-12d3-a456-426614174000');
      const id2 = new AgentId('123e4567-e89b-12d3-a456-426614174001');

      expect(id1.equals(id2)).toBe(false);
    });

    it('should not be equal to null/undefined', () => {
      const id = new AgentId();

      expect(id.equals(null as any)).toBe(false);
      expect(id.equals(undefined as any)).toBe(false);
    });
  });

  describe('validation', () => {
    it('should validate correct UUID format', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        '00000000-0000-0000-0000-000000000000',
        'ffffffff-ffff-ffff-ffff-ffffffffffff'
      ];

      validUUIDs.forEach(uuid => {
        expect(() => new AgentId(uuid)).not.toThrow();
      });
    });

    it('should reject invalid UUID formats', () => {
      const invalidUUIDs = [
        'not-a-uuid',
        '123e4567-e89b-12d3-a456-426614174', // Too short
        '123e4567-e89b-12d3-a456-4266141740000', // Too long
        '123e4567-e89b-12d3-a456-42661417400', // Wrong format
        '123456789abcdef123456789abcdef12345678' // Wrong format
      ];

      invalidUUIDs.forEach(uuid => {
        expect(() => new AgentId(uuid)).toThrow();
      });
    });
  });

  describe('serialization', () => {
    it('should serialize to string', () => {
      const id = new AgentId('123e4567-e89b-12d3-a456-426614174000');
      expect(id.toString()).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should serialize to JSON', () => {
      const id = new AgentId('123e4567-e89b-12d3-a456-426614174000');
      const json = JSON.parse(JSON.stringify(id));
      expect(json.value).toBe('123e4567-e89b-12d3-a456-426614174000');
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined in constructor', () => {
      expect(() => {
        new AgentId(null as any);
      }).toThrow();

      expect(() => {
        new AgentId(undefined as any);
      }).toThrow();
    });

    it('should generate unique IDs', () => {
      const id1 = new AgentId();
      const id2 = new AgentId();

      expect(id1.equals(id2)).toBe(false);
      expect(id1.value).not.toBe(id2.value);
    });
  });
});