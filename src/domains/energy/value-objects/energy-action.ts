/**
 * Energy Action Value Object
 *
 * Available actions for energy optimization in the Q-learning framework.
 * Supports both MIMO Sleep (GOAL-008) and Cell Sleep (GOAL-009) optimization.
 */

export enum EnergyAction {
  /** Maintain current operational mode */
  MAINTAIN_CURRENT = 'maintain_current',

  /** Enable partial MIMO sleep (reduce antenna layers) */
  ENABLE_PARTIAL_SLEEP = 'enable_partial_sleep',

  /** Enable deep MIMO sleep (minimum antenna configuration) */
  ENABLE_DEEP_SLEEP = 'enable_deep_sleep',

  /** Wake to full MIMO capacity */
  WAKE_TO_FULL_MIMO = 'wake_to_full_mimo',

  /** Cell sleep: Sleep secondary cells */
  SLEEP_SECONDARY_CELLS = 'sleep_secondary_cells',

  /** Cell sleep: Reduce layers */
  REDUCE_LAYERS = 'reduce_layers',

  /** Cell sleep: Gradual sleep (phased shutdown) */
  GRADUAL_SLEEP = 'gradual_sleep',

  /** Cell wake: Immediate wake */
  IMMEDIATE_WAKE = 'immediate_wake',

  /** Cell wake: Wake in cells */
  WAKE_IN_CELLS = 'wake_in_cells',

  /** Cell wake: Distribute load from overloaded neighbors */
  DISTRIBUTE_LOAD = 'distribute_load'
}

export const MIMO_SLEEP_ACTIONS: EnergyAction[] = [
  EnergyAction.MAINTAIN_CURRENT,
  EnergyAction.ENABLE_PARTIAL_SLEEP,
  EnergyAction.ENABLE_DEEP_SLEEP,
  EnergyAction.WAKE_TO_FULL_MIMO
];

export const CELL_SLEEP_ACTIONS: EnergyAction[] = [
  EnergyAction.MAINTAIN_CURRENT,
  EnergyAction.SLEEP_SECONDARY_CELLS,
  EnergyAction.REDUCE_LAYERS,
  EnergyAction.GRADUAL_SLEEP,
  EnergyAction.IMMEDIATE_WAKE,
  EnergyAction.WAKE_IN_CELLS,
  EnergyAction.DISTRIBUTE_LOAD
];

export interface EnergyActionMetadata {
  readonly action: EnergyAction;
  readonly description: string;
  readonly category: 'mimo' | 'cell' | 'both';
  readonly energySavings: number; // Expected savings percentage
  readonly qosImpact: number; // QoS impact (-100 to 100)
  readonly transitionTime: number; // Seconds
  readonly appliesTo: string[]; // Cell types or MIMO configs
}

/**
 * Action metadata for energy optimization
 */
export const ENERGY_ACTION_METADATA: Map<EnergyAction, EnergyActionMetadata> = new Map([
  [EnergyAction.MAINTAIN_CURRENT, {
    action: EnergyAction.MAINTAIN_CURRENT,
    description: 'Maintain current operational mode',
    category: 'both',
    energySavings: 0,
    qosImpact: 0,
    transitionTime: 0,
    appliesTo: ['all']
  }],
  [EnergyAction.ENABLE_PARTIAL_SLEEP, {
    action: EnergyAction.ENABLE_PARTIAL_SLEEP,
    description: 'Enable partial MIMO sleep (reduce from 4x4 to 2x2)',
    category: 'mimo',
    energySavings: 20,
    qosImpact: -2,
    transitionTime: 30,
    appliesTo: ['4x4', '8x8']
  }],
  [EnergyAction.ENABLE_DEEP_SLEEP, {
    action: EnergyAction.ENABLE_DEEP_SLEEP,
    description: 'Enable deep MIMO sleep (minimum antenna config)',
    category: 'mimo',
    energySavings: 35,
    qosImpact: -5,
    transitionTime: 60,
    appliesTo: ['2x2', '4x4', '8x8']
  }],
  [EnergyAction.WAKE_TO_FULL_MIMO, {
    action: EnergyAction.WAKE_TO_FULL_MIMO,
    description: 'Wake to full MIMO capacity',
    category: 'mimo',
    energySavings: 0,
    qosImpact: 10,
    transitionTime: 10,
    appliesTo: ['2x2', '4x4']
  }],
  [EnergyAction.SLEEP_SECONDARY_CELLS, {
    action: EnergyAction.SLEEP_SECONDARY_CELLS,
    description: 'Sleep secondary cells during low traffic',
    category: 'cell',
    energySavings: 50,
    qosImpact: -3,
    transitionTime: 120,
    appliesTo: ['micro', 'pico']
  }],
  [EnergyAction.REDUCE_LAYERS, {
    action: EnergyAction.REDUCE_LAYERS,
    description: 'Reduce carrier layers (e.g., 3CC to 2CC)',
    category: 'cell',
    energySavings: 30,
    qosImpact: -2,
    transitionTime: 60,
    appliesTo: ['macro', 'micro']
  }],
  [EnergyAction.GRADUAL_SLEEP, {
    action: EnergyAction.GRADUAL_SLEEP,
    description: 'Phased shutdown of low-priority features',
    category: 'cell',
    energySavings: 25,
    qosImpact: -1,
    transitionTime: 300,
    appliesTo: ['macro', 'micro', 'pico']
  }],
  [EnergyAction.IMMEDIATE_WAKE, {
    action: EnergyAction.IMMEDIATE_WAKE,
    description: 'Immediate wake on traffic spike',
    category: 'cell',
    energySavings: 0,
    qosImpact: 15,
    transitionTime: 5,
    appliesTo: ['all']
  }],
  [EnergyAction.WAKE_IN_CELLS, {
    action: EnergyAction.WAKE_IN_CELLS,
    description: 'Wake cells in coverage holes',
    category: 'cell',
    energySavings: 0,
    qosImpact: 12,
    transitionTime: 15,
    appliesTo: ['micro', 'pico']
  }],
  [EnergyAction.DISTRIBUTE_LOAD, {
    action: EnergyAction.DISTRIBUTE_LOAD,
    description: 'Distribute load from overloaded neighbors',
    category: 'cell',
    energySavings: -10,
    qosImpact: 8,
    transitionTime: 20,
    appliesTo: ['macro', 'micro']
  }]
]);

/**
 * Sleep Policy for Cell Sleep (GOAL-009)
 */
export interface SleepPolicy {
  readonly id: string;
  readonly name: string;
  readonly conditions: SleepPolicyConditions;
  readonly action: EnergyAction;
  readonly expectedSavings: number;
  readonly priority: number;
}

export interface SleepPolicyConditions {
  readonly timeRange?: { start: string; end: string }; // HH:MM format
  readonly days?: string[]; // Day of week
  readonly trafficThreshold?: number; // Percentage
  readonly duration?: number; // Minutes
  readonly campingThreshold?: number; // UE count
}

/**
 * Predefined sleep policies for GOAL-009
 */
export const SLEEP_POLICIES: SleepPolicy[] = [
  {
    id: 'night-sleep-policy',
    name: 'Night Sleep Policy',
    conditions: {
      timeRange: { start: '00:00', end: '05:00' },
      trafficThreshold: 10
    },
    action: EnergyAction.SLEEP_SECONDARY_CELLS,
    expectedSavings: 50,
    priority: 1
  },
  {
    id: 'weekend-sleep-policy',
    name: 'Weekend Sleep Policy',
    conditions: {
      days: ['Saturday', 'Sunday'],
      trafficThreshold: 30
    },
    action: EnergyAction.REDUCE_LAYERS,
    expectedSavings: 30,
    priority: 2
  },
  {
    id: 'adaptive-sleep-policy',
    name: 'Adaptive Sleep Policy',
    conditions: {
      trafficThreshold: 15,
      duration: 30
    },
    action: EnergyAction.GRADUAL_SLEEP,
    expectedSavings: 25,
    priority: 3
  }
];

/**
 * Wake Trigger for Cell Sleep (GOAL-009)
 */
export interface WakeTrigger {
  readonly id: string;
  readonly name: string;
  readonly condition: string;
  readonly action: EnergyAction;
  readonly urgency: 'low' | 'medium' | 'high';
}

/**
 * Predefined wake triggers for GOAL-009
 */
export const WAKE_TRIGGERS: WakeTrigger[] = [
  {
    id: 'traffic-spike-trigger',
    name: 'Traffic Spike Trigger',
    condition: 'traffic > 20%',
    action: EnergyAction.IMMEDIATE_WAKE,
    urgency: 'high'
  },
  {
    id: 'ue-camping-trigger',
    name: 'UE Camping Trigger',
    condition: 'ue_camping > threshold',
    action: EnergyAction.WAKE_IN_CELLS,
    urgency: 'medium'
  },
  {
    id: 'neighbor-overload-trigger',
    name: 'Neighbor Overload Trigger',
    condition: 'neighbor_overload_detected',
    action: EnergyAction.DISTRIBUTE_LOAD,
    urgency: 'high'
  }
];

/**
 * Get metadata for an energy action
 */
export function getEnergyActionMetadata(action: EnergyAction): EnergyActionMetadata {
  const metadata = ENERGY_ACTION_METADATA.get(action);
  if (!metadata) {
    throw new Error(`Unknown energy action: ${action}`);
  }
  return metadata;
}

/**
 * Check if action is valid for MIMO sleep
 */
export function isValidMIMOAction(action: EnergyAction): boolean {
  return MIMO_SLEEP_ACTIONS.includes(action);
}

/**
 * Check if action is valid for cell sleep
 */
export function isValidCellAction(action: EnergyAction): boolean {
  return CELL_SLEEP_ACTIONS.includes(action);
}

/**
 * Get applicable actions for state
 */
export function getApplicableActions(
  isMIMO: boolean,
  state: { trafficLoad: string; activeUEs: number; qosIndex: number }
): EnergyAction[] {
  const baseActions = isMIMO ? MIMO_SLEEP_ACTIONS : CELL_SLEEP_ACTIONS;
  const applicable: EnergyAction[] = [];

  for (const action of baseActions) {
    const metadata = getEnergyActionMetadata(action);

    // Always allow maintain current
    if (action === EnergyAction.MAINTAIN_CURRENT) {
      applicable.push(action);
      continue;
    }

    // Filter based on state
    if (isMIMO) {
      // MIMO actions
      if (action === EnergyAction.WAKE_TO_FULL_MIMO) {
        if (state.trafficLoad === 'high' || state.qosIndex < 90) {
          applicable.push(action);
        }
      } else if (action === EnergyAction.ENABLE_PARTIAL_SLEEP) {
        if (state.trafficLoad === 'low' && state.activeUEs < 20) {
          applicable.push(action);
        }
      } else if (action === EnergyAction.ENABLE_DEEP_SLEEP) {
        if (state.trafficLoad === 'low' && state.activeUEs < 5) {
          applicable.push(action);
        }
      }
    } else {
      // Cell actions
      if (action === EnergyAction.IMMEDIATE_WAKE) {
        if (state.trafficLoad === 'high') {
          applicable.push(action);
        }
      } else if (action === EnergyAction.SLEEP_SECONDARY_CELLS ||
                 action === EnergyAction.REDUCE_LAYERS ||
                 action === EnergyAction.GRADUAL_SLEEP) {
        if (state.trafficLoad === 'low') {
          applicable.push(action);
        }
      } else {
        applicable.push(action);
      }
    }
  }

  return applicable;
}
