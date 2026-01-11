import { describe, it, expect, beforeEach } from 'vitest';
import { QTable } from '@/domains/intelligence/aggregates/q-table';

describe('QTable', () => {
  let qTable: QTable;

  beforeEach(() => {
    qTable = new QTable();
  });

  describe('creation', () => {
    it('should create with default parameters', () => {
      expect(qTable).toBeInstanceOf(QTable);
      expect(qTable.size).toBe(0);
    });

    it('should create with initial capacity', () => {
      const table = new QTable(100);
      expect(table).toBeInstanceOf(QTable);
    });
  });

  describe('state-action management', () => {
    it('should get and set Q-values', () => {
      const state = 'test-state';
      const action = 'test-action';
      const value = 0.5;

      qTable.setQValue(state, action, value);
      expect(qTable.getQValue(state, action)).toBe(value);
    });

    it('should return default value for unset state-action', () => {
      const defaultValue = qTable.getQValue('non-existent', 'action');
      expect(defaultValue).toBe(0);
    });

    it('should update existing Q-values', () => {
      const state = 'state1';
      const action = 'action1';

      qTable.setQValue(state, action, 0.3);
      qTable.setQValue(state, action, 0.7);

      expect(qTable.getQValue(state, action)).toBe(0.7);
    });
  });

  describe('best action selection', () => {
    it('should return best action for a state', () => {
      const state = 'state1';

      qTable.setQValue(state, 'action1', 0.3);
      qTable.setQValue(state, 'action2', 0.7);
      qTable.setQValue(state, 'action3', 0.5);

      const bestAction = qTable.getBestAction(state);
      expect(bestAction).toBe('action2');
    });

    it('should handle states with no actions', () => {
      const bestAction = qTable.getBestAction('non-existent');
      expect(bestAction).toBeNull();
    });

    it('should handle epsilon-greedy exploration', () => {
      const state = 'state1';
      qTable.setQValue(state, 'action1', 0.9);

      // With epsilon > 0, sometimes random actions should be chosen
      const actions = Array.from({ length: 100 }, () =>
        qTable.getAction(state, 1.0) // Force exploration
      );

      expect(actions).toContain('action1');
    });
  });

  describe('learning and updates', () => {
    it('should update Q-values with learning rate', () => {
      const state = 'state1';
      const action = 'action1';
      const oldValue = 0.5;
      const newValue = 0.8;
      const learningRate = 0.1;

      qTable.setQValue(state, action, oldValue);
      const updated = qTable.updateQValue(state, action, newValue, learningRate);

      expect(updated).toBe(true);
      expect(qTable.getQValue(state, action)).toBeCloseTo(oldValue + learningRate * (newValue - oldValue));
    });

    it('should handle reward-based updates', () => {
      const state = 'state1';
      const action = 'action1';
      const nextState = 'state2';
      const reward = 1.0;
      const discount = 0.9;

      qTable.setQValue(state, action, 0.5);
      const nextBest = qTable.getBestAction(nextState) || 'default';
      qTable.setQValue(nextState, nextBest, 0.8);

      const updated = qTable.updateWithReward(
        state, action, nextState, reward, discount
      );

      expect(updated).toBe(true);
      const expectedValue = 0.5 + 0.1 * (reward + discount * 0.8 - 0.5);
      expect(qTable.getQValue(state, action)).toBeCloseTo(expectedValue);
    });
  });

  describe('persistence', () => {
    it('should serialize to JSON', () => {
      qTable.setQValue('state1', 'action1', 0.5);
      qTable.setQValue('state1', 'action2', 0.8);
      qTable.setQValue('state2', 'action1', 0.3);

      const json = qTable.toJSON();
      expect(json).toBeDefined();
      expect(typeof json).toBe('object');
      expect(json['state1']['action1']).toBe(0.5);
    });

    it('should deserialize from JSON', () => {
      const data = {
        'state1': { 'action1': 0.5, 'action2': 0.8 },
        'state2': { 'action1': 0.3 }
      };

      const table = QTable.fromJSON(data);
      expect(table.getQValue('state1', 'action1')).toBe(0.5);
      expect(table.getQValue('state1', 'action2')).toBe(0.8);
      expect(table.getQValue('state2', 'action1')).toBe(0.3);
    });

    it('should clear all values', () => {
      qTable.setQValue('state1', 'action1', 0.5);
      qTable.clear();

      expect(qTable.size).toBe(0);
      expect(qTable.getQValue('state1', 'action1')).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined states and actions gracefully', () => {
      expect(() => {
        qTable.setQValue(null as any, 'action', 0.5);
      }).not.toThrow();

      expect(() => {
        qTable.setQValue('state', null as any, 0.5);
      }).not.toThrow();

      expect(qTable.getQValue(null as any, 'action')).toBe(0);
      expect(qTable.getBestAction(null as any)).toBeNull();
    });

    it('should handle very large Q-values', () => {
      qTable.setQValue('state', 'action', Number.MAX_VALUE);
      expect(qTable.getQValue('state', 'action')).toBe(Number.MAX_VALUE);
    });
  });
});