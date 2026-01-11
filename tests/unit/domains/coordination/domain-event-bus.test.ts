import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DomainEventBus } from '@/domains/coordination/aggregates/domain-event-bus';
import {
  StateTransitioned,
  QueryReceived,
  ResponseGenerated,
  PeerConsulted,
  AgentSpawned,
  DomainEvent
} from '@/domains/coordination/domain-events';

describe('DomainEventBus', () => {
  let eventBus: DomainEventBus;

  beforeEach(() => {
    eventBus = new DomainEventBus();
  });

  describe('creation', () => {
    it('should create with default handlers', () => {
      expect(eventBus).toBeInstanceOf(DomainEventBus);
      expect(eventBus['handlers']).toBeDefined();
    });
  });

  describe('event subscription', () => {
    it('should subscribe to events by type', () => {
      const handler = vi.fn();

      eventBus.subscribe('StateTransitioned', handler);

      expect(eventBus['handlers']['StateTransitioned']).toContain(handler);
    });

    it('should subscribe to multiple event types', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.subscribe(['StateTransitioned', 'QueryReceived'], handler1);
      eventBus.subscribe('StateTransitioned', handler2);

      expect(eventBus['handlers']['StateTransitioned']).toHaveLength(2);
      expect(eventBus['handlers']['QueryReceived']).toHaveLength(1);
    });

    it('should unsubscribe from events', () => {
      const handler = vi.fn();

      eventBus.subscribe('StateTransitioned', handler);
      eventBus.unsubscribe('StateTransitioned', handler);

      expect(eventBus['handlers']['StateTransitioned']).not.toContain(handler);
    });

    it('should handle unsubscribe from non-existent handler', () => {
      const handler = vi.fn();

      expect(() => {
        eventBus.unsubscribe('StateTransitioned', handler);
      }).not.toThrow();
    });
  });

  describe('event publishing', () => {
    it('should publish events to subscribed handlers', () => {
      const handler = vi.fn();
      const event = new StateTransitioned('Initializing', 'ColdStart', 'init');

      eventBus.subscribe('StateTransitioned', handler);
      eventBus.publish(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should publish to multiple handlers of same type', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const event = new QueryReceived('query1', 'agent1', 'information');

      eventBus.subscribe('QueryReceived', handler1);
      eventBus.subscribe('QueryReceived', handler2);
      eventBus.publish(event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
    });

    it('should publish to multiple event types', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const event1 = new StateTransitioned('A', 'B', 'test');
      const event2 = new QueryReceived('query1', 'agent1', 'information');

      eventBus.subscribe('StateTransitioned', handler1);
      eventBus.subscribe('QueryReceived', handler2);

      eventBus.publish(event1);
      eventBus.publish(event2);

      expect(handler1).toHaveBeenCalledWith(event1);
      expect(handler2).toHaveBeenCalledWith(event2);
    });

    it('should not publish to unsubscribed handlers', () => {
      const handler = vi.fn();
      const event = new ResponseGenerated('resp1', 0.8, 100);

      eventBus.subscribe('ResponseGenerated', handler);
      eventBus.unsubscribe('ResponseGenerated', handler);
      eventBus.publish(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle events with no subscribers', () => {
      const event = new PeerConsulted('agent1', 'agent2');

      expect(() => {
        eventBus.publish(event);
      }).not.toThrow();
    });
  });

  describe('event filtering', () => {
    it('should filter events by source', () => {
      const handler = vi.fn();
      const event1 = new StateTransitioned('A', 'B', 'test', 'agent1');
      const event2 = new StateTransitioned('C', 'D', 'test', 'agent2');

      eventBus.subscribe('StateTransitioned', handler, { source: 'agent1' });
      eventBus.publish(event1);
      eventBus.publish(event2);

      expect(handler).toHaveBeenCalledWith(event1);
      expect(handler).not.toHaveBeenCalledWith(event2);
    });

    it('should filter events by target', () => {
      const handler = vi.fn();
      const event = new QueryReceived('query1', 'agent1', 'information', undefined, 'agent2');

      eventBus.subscribe('QueryReceived', handler, { target: 'agent2' });
      eventBus.publish(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should filter by both source and target', () => {
      const handler = vi.fn();
      const event = new QueryReceived('query1', 'agent1', 'information', 'agent2', 'agent3');

      eventBus.subscribe('QueryReceived', handler, { source: 'agent1', target: 'agent3' });
      eventBus.publish(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should handle filters that do not match', () => {
      const handler = vi.fn();
      const event = new AgentSpawned('agent1', 'FAJ001', 'Test Agent');

      eventBus.subscribe('AgentSpawned', handler, { source: 'non-existent' });
      eventBus.publish(event);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('event history', () => {
    it('should track event history', () => {
      const event1 = new StateTransitioned('A', 'B', 'test');
      const event2 = new QueryReceived('query1', 'agent1', 'information');

      eventBus.publish(event1);
      eventBus.publish(event2);

      const history = eventBus.getEventHistory();
      expect(history).toHaveLength(2);
      expect(history[0]).toBe(event1);
      expect(history[1]).toBe(event2);
    });

    it('should limit event history size', () => {
      const originalLimit = eventBus['maxHistorySize'];
      eventBus['maxHistorySize'] = 2;

      const events = [
        new StateTransitioned('A', 'B', 'test'),
        new StateTransitioned('B', 'C', 'test'),
        new StateTransitioned('C', 'D', 'test')
      ];

      events.forEach(event => eventBus.publish(event));

      const history = eventBus.getEventHistory();
      expect(history).toHaveLength(2);
      expect(history[0]).toBe(events[1]);
      expect(history[1]).toBe(events[2]);
    });

    it('should clear event history', () => {
      const event = new StateTransitioned('A', 'B', 'test');
      eventBus.publish(event);

      eventBus.clearEventHistory();

      const history = eventBus.getEventHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle errors in event handlers gracefully', () => {
      const errorHandler = vi.fn();
      const throwingHandler = vi.fn(() => {
        throw new Error('Handler error');
      });

      eventBus.subscribe('StateTransitioned', throwingHandler);
      eventBus.subscribe('StateTransitioned', errorHandler);

      const event = new StateTransitioned('A', 'B', 'test');

      expect(() => {
        eventBus.publish(event);
      }).not.toThrow();

      // errorHandler should still be called even if throwingHandler fails
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should continue publishing even if some handlers fail', () => {
      const workingHandler = vi.fn();
      const failingHandler = vi.fn(() => {
        throw new Error('Handler failed');
      });
      const anotherWorkingHandler = vi.fn();

      eventBus.subscribe('StateTransitioned', workingHandler);
      eventBus.subscribe('StateTransitioned', failingHandler);
      eventBus.subscribe('StateTransitioned', anotherWorkingHandler);

      const event = new StateTransitioned('A', 'B', 'test');

      expect(() => {
        eventBus.publish(event);
      }).not.toThrow();

      expect(workingHandler).toHaveBeenCalled();
      expect(anotherWorkingHandler).toHaveBeenCalled();
    });
  });

  describe('performance', () => {
    it('should handle high event volume', () => {
      const handler = vi.fn();
      const eventCount = 1000;

      eventBus.subscribe('StateTransitioned', handler);

      const events = Array.from({ length: eventCount }, (_, i) =>
        new StateTransitioned(`A${i}`, `B${i}`, 'test')
      );

      const start = Date.now();
      events.forEach(event => eventBus.publish(event));
      const duration = Date.now() - start;

      expect(handler).toHaveBeenCalledTimes(eventCount);
      expect(duration).toBeLessThan(1000); // Should process 1000 events in under 1 second
    });

    it('should handle rapid subscriptions and unsubscriptions', () => {
      const handlers = Array.from({ length: 100 }, () => vi.fn());

      // Subscribe all handlers
      handlers.forEach((handler, i) => {
        eventBus.subscribe('StateTransitioned', handler);
      });

      // Publish event
      const event = new StateTransitioned('A', 'B', 'test');
      eventBus.publish(event);

      // All handlers should be called
      handlers.forEach(handler => {
        expect(handler).toHaveBeenCalledWith(event);
      });

      // Unsubscribe all handlers
      handlers.forEach(handler => {
        eventBus.unsubscribe('StateTransitioned', handler);
      });

      // Publish again - no handlers should be called
      eventBus.publish(event);
      handlers.forEach(handler => {
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined events', () => {
      const handler = vi.fn();

      eventBus.subscribe('StateTransitioned', handler);

      expect(() => {
        eventBus.publish(null as any);
      }).not.toThrow();

      expect(() => {
        eventBus.publish(undefined as any);
      }).not.toThrow();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle event type mismatch', () => {
      const handler = vi.fn();
      const event = { type: 'InvalidEventType' } as any;

      eventBus.subscribe('StateTransitioned', handler);
      eventBus.publish(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle handler that throws non-error', () => {
      const handler = vi.fn(() => {
        throw 'string error';
      });

      eventBus.subscribe('StateTransitioned', handler);

      const event = new StateTransitioned('A', 'B', 'test');

      expect(() => {
        eventBus.publish(event);
      }).not.toThrow();
    });
  });
});