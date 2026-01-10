/**
 * Safe Zone Validator
 * Enforces hardcoded parameter constraints
 *
 * Key Decision from ADR-008:
 * - Safe zones are hardcoded in WASM binaries
 * - Cannot be modified at runtime
 * - No operator overrides allowed
 *
 * @see ADR-008: Safe Zone Parameter Constraints
 */

import type {
  ParameterDefinition,
  SafeZone,
  Timestamp,
  Duration,
} from '../../../core/types/interfaces.js';
import { BlockingCondition } from '../../../core/types/enums.js';

export interface IParameterChange {
  parameter: string;
  currentValue: number;
  proposedValue: number;
  safeZone: SafeZone;
}

export interface ISafeZoneViolation {
  parameter: string;
  reason: 'below_min' | 'above_max' | 'exceeds_change_limit' | 'cooldown_active';
  currentValue: number;
  proposedValue: number;
  constraint: number;
  message: string;
}

interface CooldownEntry {
  parameter: string;
  lastChangeTime: Timestamp;
  cooldownDuration: Duration;
}

/**
 * SafeZoneValidator enforces parameter constraints
 */
export class SafeZoneValidator {
  private readonly cooldowns: Map<string, CooldownEntry>;
  private readonly blockingConditions: Set<BlockingCondition>;

  constructor() {
    this.cooldowns = new Map();
    this.blockingConditions = new Set();
  }

  /**
   * Validate a proposed parameter change
   */
  validate(change: IParameterChange): ISafeZoneViolation | null {
    const { parameter, currentValue, proposedValue, safeZone } = change;

    // Check absolute bounds
    if (proposedValue < safeZone.min) {
      return {
        parameter,
        reason: 'below_min',
        currentValue,
        proposedValue,
        constraint: safeZone.min,
        message: `Value ${proposedValue} is below safe minimum ${safeZone.min}`,
      };
    }

    if (proposedValue > safeZone.max) {
      return {
        parameter,
        reason: 'above_max',
        currentValue,
        proposedValue,
        constraint: safeZone.max,
        message: `Value ${proposedValue} is above safe maximum ${safeZone.max}`,
      };
    }

    // Check change limit
    const changePercent = Math.abs((proposedValue - currentValue) / currentValue) * 100;
    if (changePercent > safeZone.changeLimit) {
      return {
        parameter,
        reason: 'exceeds_change_limit',
        currentValue,
        proposedValue,
        constraint: safeZone.changeLimit,
        message: `Change of ${changePercent.toFixed(1)}% exceeds limit of ${safeZone.changeLimit}%`,
      };
    }

    // Check cooldown
    const cooldown = this.cooldowns.get(parameter);
    if (cooldown) {
      const elapsed = Date.now() - cooldown.lastChangeTime;
      if (elapsed < cooldown.cooldownDuration) {
        const remaining = cooldown.cooldownDuration - elapsed;
        return {
          parameter,
          reason: 'cooldown_active',
          currentValue,
          proposedValue,
          constraint: cooldown.cooldownDuration,
          message: `Cooldown active. ${Math.ceil(remaining / 60000)} minutes remaining`,
        };
      }
    }

    return null; // No violation
  }

  /**
   * Validate multiple parameter changes
   */
  validateAll(changes: IParameterChange[]): ISafeZoneViolation[] {
    const violations: ISafeZoneViolation[] = [];

    for (const change of changes) {
      const violation = this.validate(change);
      if (violation) {
        violations.push(violation);
      }
    }

    return violations;
  }

  /**
   * Record a parameter change (starts cooldown)
   */
  recordChange(parameter: string, cooldownDuration: Duration): void {
    this.cooldowns.set(parameter, {
      parameter,
      lastChangeTime: Date.now(),
      cooldownDuration,
    });
  }

  /**
   * Check if any blocking condition is active
   */
  isBlocked(): boolean {
    return this.blockingConditions.size > 0;
  }

  /**
   * Set a blocking condition
   */
  setBlockingCondition(condition: BlockingCondition): void {
    this.blockingConditions.add(condition);
  }

  /**
   * Clear a blocking condition
   */
  clearBlockingCondition(condition: BlockingCondition): void {
    this.blockingConditions.delete(condition);
  }

  /**
   * Get all active blocking conditions
   */
  getActiveBlockingConditions(): BlockingCondition[] {
    return Array.from(this.blockingConditions);
  }

  /**
   * Check if within night window
   */
  isNightWindow(startHour: number = 0, endHour: number = 6): boolean {
    const hour = new Date().getHours();
    return hour >= startHour && hour < endHour;
  }

  /**
   * Clear expired cooldowns
   */
  clearExpiredCooldowns(): void {
    const now = Date.now();
    for (const [param, entry] of this.cooldowns) {
      if (now - entry.lastChangeTime >= entry.cooldownDuration) {
        this.cooldowns.delete(param);
      }
    }
  }

  /**
   * Get cooldown status for a parameter
   */
  getCooldownStatus(parameter: string): {
    active: boolean;
    remainingMs?: Duration;
    expiresAt?: Timestamp;
  } {
    const cooldown = this.cooldowns.get(parameter);
    if (!cooldown) {
      return { active: false };
    }

    const elapsed = Date.now() - cooldown.lastChangeTime;
    if (elapsed >= cooldown.cooldownDuration) {
      this.cooldowns.delete(parameter);
      return { active: false };
    }

    const remainingMs = cooldown.cooldownDuration - elapsed;
    return {
      active: true,
      remainingMs,
      expiresAt: cooldown.lastChangeTime + cooldown.cooldownDuration,
    };
  }

  /**
   * Get validator statistics
   */
  getStats(): {
    activeCooldowns: number;
    activeBlockingConditions: BlockingCondition[];
    isBlocked: boolean;
    isNightWindow: boolean;
  } {
    return {
      activeCooldowns: this.cooldowns.size,
      activeBlockingConditions: this.getActiveBlockingConditions(),
      isBlocked: this.isBlocked(),
      isNightWindow: this.isNightWindow(),
    };
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.cooldowns.clear();
    this.blockingConditions.clear();
  }
}
