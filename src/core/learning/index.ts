/**
 * ELEX Edge AI Agent Swarm - Learning Module
 *
 * Exports Q-learning and trajectory-related classes.
 */

export { QTable, type QTableConfig } from './QTable.js';
export {
  TrajectoryBuffer,
  type TrajectoryBufferConfig,
  type Trajectory,
  type SamplingOptions,
} from './TrajectoryBuffer.js';
