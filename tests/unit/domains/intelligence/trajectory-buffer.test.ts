import { describe, it, expect, beforeEach } from 'vitest';
import { TrajectoryBuffer } from '@/domains/intelligence/aggregates/trajectory-buffer';

describe('TrajectoryBuffer', () => {
  let buffer: TrajectoryBuffer;

  beforeEach(() => {
    buffer = new TrajectoryBuffer(100); // Max size of 100
  });

  describe('creation', () => {
    it('should create with default parameters', () => {
      expect(buffer).toBeInstanceOf(TrajectoryBuffer);
      expect(buffer.size).toBe(0);
      expect(buffer.maxSize).toBe(100);
    });

    it('should create with custom max size', () => {
      const customBuffer = new TrajectoryBuffer(50);
      expect(customBuffer.maxSize).toBe(50);
    });
  });

  describe('trajectory recording', () => {
    it('should add transitions', () => {
      const transition = {
        state: 'state1',
        action: 'action1',
        reward: 1.0,
        nextState: 'state2',
        done: false
      };

      buffer.add(transition);
      expect(buffer.size).toBe(1);
    });

    it('should maintain order of transitions', () => {
      const transitions = [
        { state: 's1', action: 'a1', reward: 1.0, nextState: 's2', done: false },
        { state: 's2', action: 'a2', reward: 0.5, nextState: 's3', done: false },
        { state: 's3', action: 'a3', reward: -1.0, nextState: 's4', done: true }
      ];

      transitions.forEach(t => buffer.add(t));

      const trajectory = buffer.sampleTrajectory();
      expect(trajectory.length).toBe(3);
      expect(trajectory[0].state).toBe('s1');
      expect(trajectory[2].done).toBe(true);
    });

    it('should respect max size and remove oldest when full', () => {
      const smallBuffer = new TrajectoryBuffer(2);

      smallBuffer.add({ state: 's1', action: 'a1', reward: 1.0, nextState: 's2', done: false });
      smallBuffer.add({ state: 's2', action: 'a2', reward: 0.5, nextState: 's3', done: false });
      smallBuffer.add({ state: 's3', action: 'a3', reward: -1.0, nextState: 's4', done: false });

      expect(smallBuffer.size).toBe(2);
      expect(smallBuffer.sampleTrajectory()[0].state).toBe('s2'); // s1 should be gone
    });
  });

  describe('sampling', () => {
    beforeEach(() => {
      // Populate buffer with some transitions
      for (let i = 0; i < 10; i++) {
        buffer.add({
          state: `state${i}`,
          action: `action${i}`,
          reward: i * 0.1,
          nextState: `state${i + 1}`,
          done: i === 9
        });
      }
    });

    it('should sample complete trajectories', () => {
      const trajectory = buffer.sampleTrajectory();

      expect(trajectory.length).toBeGreaterThan(0);
      expect(trajectory[0]).toHaveProperty('state');
      expect(trajectory[0]).toHaveProperty('action');
      expect(trajectory[0]).toHaveProperty('reward');
      expect(trajectory[0]).toHaveProperty('nextState');
      expect(trajectory[0]).toHaveProperty('done');
    });

    it('should sample multiple trajectories', () => {
      const trajectories = buffer.sampleTrajectories(3);

      expect(trajectories).toHaveLength(3);
      trajectories.forEach(t => {
        expect(t.length).toBeGreaterThan(0);
      });
    });

    it('should handle empty buffer gracefully', () => {
      const emptyBuffer = new TrajectoryBuffer(10);
      const trajectory = emptyBuffer.sampleTrajectory();

      expect(trajectory).toHaveLength(0);
    });

    it('should handle request for more trajectories than available', () => {
      const trajectories = buffer.sampleTrajectories(100);

      expect(trajectories.length).toBeGreaterThan(0);
      expect(trajectories.length).toBeLessThanOrEqual(100);
    });
  });

  describe('batch operations', () => {
    it('should add multiple transitions at once', () => {
      const transitions = [
        { state: 's1', action: 'a1', reward: 1.0, nextState: 's2', done: false },
        { state: 's2', action: 'a2', reward: 0.5, nextState: 's3', done: false }
      ];

      buffer.addAll(transitions);
      expect(buffer.size).toBe(2);
    });

    it('should clear all transitions', () => {
      buffer.add({ state: 's1', action: 'a1', reward: 1.0, nextState: 's2', done: false });
      buffer.clear();

      expect(buffer.size).toBe(0);
      const trajectory = buffer.sampleTrajectory();
      expect(trajectory).toHaveLength(0);
    });
  });

  describe('persistence', () => {
    it('should serialize to JSON', () => {
      buffer.add({ state: 's1', action: 'a1', reward: 1.0, nextState: 's2', done: false });

      const json = buffer.toJSON();
      expect(json).toBeDefined();
      expect(json).toHaveProperty('transitions');
      expect(json).toHaveProperty('maxSize');
    });

    it('should deserialize from JSON', () => {
      const data = {
        transitions: [
          { state: 's1', action: 'a1', reward: 1.0, nextState: 's2', done: false }
        ],
        maxSize: 100
      };

      const newBuffer = TrajectoryBuffer.fromJSON(data);
      expect(newBuffer.size).toBe(1);
      expect(newBuffer.maxSize).toBe(100);
    });

    it('should handle invalid JSON gracefully', () => {
      expect(() => {
        TrajectoryBuffer.fromJSON({ invalid: 'data' });
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined transitions', () => {
      expect(() => {
        buffer.add(null as any);
      }).not.toThrow();

      expect(() => {
        buffer.add(undefined as any);
      }).not.toThrow();

      expect(buffer.size).toBe(0);
    });

    it('should handle partial transitions', () => {
      const partial = {
        state: 's1',
        // Missing other required fields
      };

      expect(() => {
        buffer.add(partial as any);
      }).not.toThrow();
    });

    it('should handle very large buffer sizes', () => {
      const hugeBuffer = new TrajectoryBuffer(1000000);
      expect(hugeBuffer.maxSize).toBe(1000000);
    });
  });
});