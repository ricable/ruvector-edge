/**
 * ELEX Edge AI Agent Swarm - Agent Module
 *
 * Exports agent-related classes and functions.
 */

export { Agent, type PeerAgent, type AgentDependencies } from './Agent.js';
export {
  AgentRegistry,
  getGlobalRegistry,
  resetGlobalRegistry,
  type RegistryStats,
  type AgentFilter,
} from './AgentRegistry.js';
export {
  AgentFactory,
  createAgentFactory,
  type AgentFactoryConfig,
  type AgentCreationResult,
  type BatchCreationResult,
} from './AgentFactory.js';
