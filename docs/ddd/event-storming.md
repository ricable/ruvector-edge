# Event Storming Results

## Overview

This document captures the results of event storming sessions for the 593-agent Ericsson RAN neural agentic system. Event storming is a workshop-based method for modeling complex domains through domain events.

---

## Event Storming Legend

```
+------------------------------------------------------------------+
|                    EVENT STORMING LEGEND                         |
+------------------------------------------------------------------+
|                                                                  |
|  +-------------+  +-------------+  +-------------+               |
|  |   ORANGE    |  |    BLUE     |  |   YELLOW    |               |
|  |   Event     |  |   Command   |  |  Aggregate  |               |
|  +-------------+  +-------------+  +-------------+               |
|  | Past tense  |  | Imperative  |  | Consistency |               |
|  | Something   |  | User intent |  | boundary    |               |
|  | happened    |  |             |  |             |               |
|  +-------------+  +-------------+  +-------------+               |
|                                                                  |
|  +-------------+  +-------------+  +-------------+               |
|  |   PURPLE    |  |    GREEN    |  |    PINK     |               |
|  |   Policy    |  | Read Model  |  |  External   |               |
|  +-------------+  +-------------+  +-------------+               |
|  | Reactive    |  | Query view  |  | External    |               |
|  | When...then |  | for display |  | system      |               |
|  +-------------+  +-------------+  +-------------+               |
|                                                                  |
+------------------------------------------------------------------+
```

---

## Domain Event Timeline

### 1. System Initialization

```
TIME ------>

+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
| Initialize Swarm |---->| SwarmInitialized |---->| Load Features    |
|     (Command)    |     |     (Event)      |     |    (Command)     |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
                                                         |
                                                         v
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
| RuntimeInit'd    |<----| ModuleLoaded     |<----|  FeaturesLoaded  |
|     (Event)      |     |    (Event)       |     |     (Event)      |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
```

### 2. Agent Lifecycle

```
TIME ------>

+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|   Spawn Agent    |---->|  AgentSpawned    |---->| Register Agent   |
|    (Command)     |     |    (Event)       |     |   (Command)      |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
                                                         |
                                                         v
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
| FeatureAssigned  |<----| AgentRegistered  |<----| Assign Features  |
|    (Event)       |     |    (Event)       |     |   (Command)      |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
```

### 3. Query Processing

```
TIME ------>

+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|  Submit Query    |---->| QueryReceived    |---->|   Route Query    |
|   (Command)      |     |    (Event)       |     |   (Command)      |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
        |                                                |
        v                                                v
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|   User/API       |     |  QueryRouted     |---->| Execute Query    |
|   (External)     |     |    (Event)       |     |   (Command)      |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
                                                         |
                                                         v
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
| ResponseSent     |<----| QueryCompleted   |<----|  Generate Resp   |
|    (Event)       |     |    (Event)       |     |   (Command)      |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
```

### 4. Learning Cycle

```
TIME ------>

+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
| Receive Feedback |---->| FeedbackReceived |---->| Calculate Reward |
|   (Command)      |     |    (Event)       |     |   (Command)      |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
                                                         |
                                                         v
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
| TrajectoryRec'd  |<----| RewardCalculated |<----| Record Trajectory|
|    (Event)       |     |    (Event)       |     |   (Command)      |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
        |
        | [When trajectory complete]
        v
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
| Update QTable    |---->|  QTableUpdated   |---->|  Merge QTables   |
|   (Command)      |     |    (Event)       |     |   (Command)      |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
                                                         |
                                                         v
                                                 +------------------+
                                                 |                  |
                                                 | QTablesMerged    |
                                                 |    (Event)       |
                                                 |                  |
                                                 +------------------+
```

### 5. Optimization Cycle

```
TIME ------>

+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
| Start Optimize   |---->| OptimizationStart|---->|   Observe KPIs   |
|   (Command)      |     |    (Event)       |     |   (Command)      |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
                                                         |
                                                         v
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
| KPIsObserved     |---->| Analyze Causes   |---->| RootCauseIdent'd |
|    (Event)       |     |   (Command)      |     |    (Event)       |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
                                                         |
                                                         v
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
| Propose Changes  |---->| ChangesDecided   |---->|  Seek Consensus  |
|   (Command)      |     |    (Event)       |     |   (Command)      |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
                                                         |
     [If rejected]                                       |
          |                                              v
          |                              +------------------+
          |                              |                  |
          +<-----------------------------| ConsensusReached |
                                         |    (Event)       |
                                         |                  |
                                         +------------------+
                                                  |
                                    [If approved] |
                                                  v
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
| Execute Changes  |---->| ParameterChanged |---->|  Learn Outcome   |
|   (Command)      |     |    (Event)       |     |   (Command)      |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
                                                         |
                                                         v
+------------------+     +------------------+
|                  |     |                  |
| OptimizeCycleDone|<----| OutcomeLearned   |
|    (Event)       |     |    (Event)       |
|                  |     |                  |
+------------------+     +------------------+
```

### 6. Security Events

```
TIME ------>

+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
| Generate Identity|---->| IdentityCreated  |---->| Request Session  |
|   (Command)      |     |    (Event)       |     |   (Command)      |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
                                                         |
                                                         v
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
| SessionEstab'd   |---->|  Sign Message    |---->| MessageSigned    |
|    (Event)       |     |   (Command)      |     |    (Event)       |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
                                                         |
                                                         v
+------------------+     +------------------+
|                  |     |                  |
| Verify Message   |---->| MessageVerified  |
|   (Command)      |     |    (Event)       |
|                  |     |                  |
+------------------+     +------------------+
```

---

## Commands by Bounded Context

### Knowledge Context Commands

| Command | Triggered By | Produces Event |
|---------|--------------|----------------|
| LoadFeature | System Startup | FeatureLoaded |
| UpdateCatalog | Admin Action | CatalogRefreshed |
| AssignFeatureToAgent | Spawn Agent | FeatureAssigned |
| LookupFeature | Query Processing | FeatureLookedUp |
| ResolveDependencies | Feature Activation | DependenciesResolved |

### Intelligence Context Commands

| Command | Triggered By | Produces Event |
|---------|--------------|----------------|
| RecordTrajectory | Query Completion | TrajectoryRecorded |
| UpdateQTable | Learning Cycle | QTableUpdated |
| MergeQTables | Federated Sync | QTablesMerged |
| DecayEpsilon | Periodic | EpsilonDecayed |
| ExtractPatterns | Pattern Learning | PatternLearned |

### Coordination Context Commands

| Command | Triggered By | Produces Event |
|---------|--------------|----------------|
| InitializeSwarm | System Startup | SwarmInitialized |
| SpawnAgent | Scaling Decision | AgentSpawned |
| RouteQuery | Query Received | QueryRouted |
| ChangeTopology | Load Change | TopologyChanged |
| ReachConsensus | Decision Required | ConsensusReached |

### Optimization Context Commands

| Command | Triggered By | Produces Event |
|---------|--------------|----------------|
| StartOptimization | KPI Degradation | OptimizationStarted |
| ObserveKPIs | Optimization Cycle | KPIsObserved |
| AnalyzeRootCause | Degradation Detected | RootCauseIdentified |
| ProposeChange | Analysis Complete | ChangeProposed |
| ExecuteChange | Consensus Reached | ParameterChanged |
| TriggerRollback | KPI Worsened | RollbackTriggered |

### Runtime Context Commands

| Command | Triggered By | Produces Event |
|---------|--------------|----------------|
| LoadModule | Agent Spawn | ModuleLoaded |
| ExecuteFunction | Query Processing | ExecutionCompleted |
| AllocateResources | Module Load | ResourceAllocated |
| CollectGarbage | Memory Pressure | GarbageCollected |

### Security Context Commands

| Command | Triggered By | Produces Event |
|---------|--------------|----------------|
| GenerateIdentity | Agent Spawn | IdentityCreated |
| EstablishSession | Communication | SessionEstablished |
| SignMessage | Message Send | MessageSigned |
| VerifyMessage | Message Receive | MessageVerified |
| RevokeKey | Security Event | KeyRevoked |

---

## Read Models

### Swarm Dashboard Read Model

```typescript
interface SwarmDashboardReadModel {
  swarmId: string;
  status: 'healthy' | 'degraded' | 'critical';
  topology: string;
  agentCount: number;
  healthyAgentCount: number;
  activeQueries: number;
  averageLatencyMs: number;
  throughputQPS: number;
  memoryUsageMB: number;
  cpuUtilization: number;
  lastUpdated: Date;
}

// Built from events:
// - SwarmInitialized
// - AgentSpawned
// - AgentTerminated
// - AgentHealthChanged
// - QueryCompleted
```

### Feature Catalog Read Model

```typescript
interface FeatureCatalogReadModel {
  totalFeatures: number;
  featuresByDomain: Map<string, number>;
  totalParameters: number;
  totalCounters: number;
  totalKPIs: number;
  recentChanges: FeatureChange[];
  coverageByAgent: Map<string, string[]>;
}

// Built from events:
// - FeatureLoaded
// - CatalogRefreshed
// - FeatureAssigned
```

### Learning Progress Read Model

```typescript
interface LearningProgressReadModel {
  totalTrajectories: number;
  successRate: number;
  averageReward: number;
  qTableSize: number;
  explorationRate: number;
  patternsLearned: number;
  recentTrajectories: TrajectoryView[];
  rewardTrend: number[];
}

// Built from events:
// - TrajectoryRecorded
// - QTableUpdated
// - PatternLearned
// - EpsilonDecayed
```

### Optimization Status Read Model

```typescript
interface OptimizationStatusReadModel {
  activeCycles: number;
  currentPhases: Map<string, string>;
  kpiHealth: Map<string, 'healthy' | 'warning' | 'critical'>;
  recentChanges: ParameterChangeView[];
  rollbackCount: number;
  successRate: number;
  averageImprovementPercent: number;
}

// Built from events:
// - OptimizationStarted
// - PhaseTransitioned
// - ParameterChanged
// - RollbackTriggered
// - OptimizationCycleCompleted
```

### Security Audit Read Model

```typescript
interface SecurityAuditReadModel {
  activeIdentities: number;
  activeSessions: number;
  messagesVerified: number;
  verificationFailures: number;
  threatDetections: ThreatView[];
  revokedKeys: number;
  postQuantumEnabled: number;
}

// Built from events:
// - IdentityCreated
// - SessionEstablished
// - MessageVerified
// - SignatureRejected
// - SecurityThreatDetected
// - KeyRevoked
```

---

## Policies (Reactive Rules)

### Swarm Health Policy

```typescript
// When AgentHealthChanged with health='unhealthy'
// Then SpawnReplacementAgent AND NotifyOperator

policy SwarmHealthPolicy {
  on(event: AgentHealthChanged) {
    if (event.currentHealth === 'unhealthy') {
      command(SpawnAgent, {
        type: event.agentType,
        replacingAgent: event.agentId
      });

      command(NotifyOperator, {
        message: `Agent ${event.agentId} unhealthy`,
        severity: 'warning'
      });
    }
  }
}
```

### Learning Trigger Policy

```typescript
// When QueryCompleted
// Then RecordTrajectoryStep AND (if trajectory complete) UpdateQTable

policy LearningTriggerPolicy {
  on(event: QueryCompleted) {
    command(RecordTrajectoryStep, {
      state: event.queryState,
      action: event.routedTo,
      reward: calculateReward(event)
    });

    if (isTrajectoryComplete(event.sessionId)) {
      command(UpdateQTable, {
        trajectoryId: event.sessionId
      });
    }
  }
}
```

### KPI Degradation Policy

```typescript
// When KPIDegraded
// Then StartOptimizationCycle

policy KPIDegradationPolicy {
  on(event: KPIDegraded) {
    if (event.degradationLevel === 'critical') {
      command(StartOptimization, {
        targetKPI: event.kpiName,
        priority: 'high',
        trigger: 'automatic'
      });
    }
  }
}
```

### Rollback Policy

```typescript
// When ParameterChanged AND KPIWorsened within 5 minutes
// Then TriggerRollback

policy RollbackPolicy {
  on(event: ParameterChanged) {
    // Schedule KPI check
    schedule(checkKPIAfter, 5 * 60 * 1000, {
      changeId: event.changeId,
      baselineKPI: getCurrentKPI(event.affectedKPI)
    });
  }

  on(event: KPICheckResult) {
    if (event.worsened) {
      command(TriggerRollback, {
        changeId: event.changeId,
        reason: 'kpi_degradation'
      });
    }
  }
}
```

### Security Threat Policy

```typescript
// When SignatureRejected with reason='invalid_signature'
// Then IncrementThreatScore AND (if score > threshold) BlockAgent

policy SecurityThreatPolicy {
  on(event: SignatureRejected) {
    incrementThreatScore(event.senderId);

    if (getThreatScore(event.senderId) > THREAT_THRESHOLD) {
      command(BlockAgent, {
        agentId: event.senderId,
        reason: 'repeated_signature_failures'
      });

      raise(SecurityThreatDetected, {
        threatType: 'potential_impersonation',
        sourceIdentity: event.senderId
      });
    }
  }
}
```

### Federated Merge Policy

```typescript
// When QTableUpdated for N agents
// Then TriggerFederatedMerge

policy FederatedMergePolicy {
  private updateCounts: Map<string, number> = new Map();
  private readonly MERGE_THRESHOLD = 10;

  on(event: QTableUpdated) {
    const count = this.updateCounts.get(event.domain) ?? 0;
    this.updateCounts.set(event.domain, count + 1);

    if (count >= this.MERGE_THRESHOLD) {
      command(MergeQTables, {
        domain: event.domain,
        strategy: 'weighted_average'
      });
      this.updateCounts.set(event.domain, 0);
    }
  }
}
```

---

## Sagas (Long-Running Processes)

### Optimization Saga

```typescript
saga OptimizationSaga {
  // Step 1: Start with observation
  start(command: StartOptimization) {
    emit(OptimizationStarted);
    transition('observing');
  }

  state observing {
    on(KPIsObserved) {
      if (hasAnomalies()) {
        transition('analyzing');
      } else {
        scheduleNextObservation();
      }
    }
  }

  state analyzing {
    on(RootCauseIdentified) {
      transition('deciding');
    }
  }

  state deciding {
    on(ChangesDecided) {
      if (requiresConsensus()) {
        transition('awaiting_consensus');
      } else {
        transition('acting');
      }
    }
  }

  state awaiting_consensus {
    on(ConsensusReached) {
      if (approved) {
        transition('acting');
      } else {
        transition('observing'); // Retry later
      }
    }
    timeout(60_000) {
      transition('observing'); // Timeout, retry later
    }
  }

  state acting {
    on(ParameterChanged) {
      transition('learning');
    }
    on(ChangeRejected) {
      transition('observing');
    }
  }

  state learning {
    on(OutcomeLearned) {
      if (kpiImproved) {
        emit(OptimizationCycleCompleted);
      } else {
        command(TriggerRollback);
      }
      transition('observing'); // Continue loop
    }
  }
}
```

### Agent Onboarding Saga

```typescript
saga AgentOnboardingSaga {
  start(command: SpawnAgent) {
    emit(AgentSpawnRequested);
    transition('loading_module');
  }

  state loading_module {
    on(ModuleLoaded) {
      transition('generating_identity');
    }
    on(ModuleLoadFailed) {
      compensate(); // Cleanup
      fail('module_load_failed');
    }
  }

  state generating_identity {
    on(IdentityCreated) {
      transition('registering');
    }
  }

  state registering {
    on(AgentRegistered) {
      transition('assigning_features');
    }
  }

  state assigning_features {
    on(FeatureAssigned) {
      if (allFeaturesAssigned()) {
        transition('initializing_qtable');
      }
    }
  }

  state initializing_qtable {
    on(QTableInitialized) {
      emit(AgentSpawned);
      complete();
    }
  }

  compensate() {
    // Reverse operations in case of failure
    command(UnloadModule);
    command(RevokeIdentity);
    command(DeregisterAgent);
  }
}
```

---

## Event Catalog Summary

| Context | Events | Commands | Policies |
|---------|--------|----------|----------|
| Knowledge | 5 | 5 | 1 |
| Intelligence | 6 | 5 | 2 |
| Coordination | 8 | 5 | 2 |
| Optimization | 8 | 6 | 2 |
| Runtime | 5 | 4 | 1 |
| Security | 6 | 5 | 1 |
| **Total** | **38** | **30** | **9** |
