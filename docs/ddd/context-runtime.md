# Runtime Bounded Context

## Domain Purpose

The Runtime context manages the execution environment for agents, including WASM module loading, agent instance lifecycle, resource pooling, memory management, and health monitoring. This is a **Supporting Domain** that provides the infrastructure for running the 593-agent system.

---

## Context Map Position

```
┌─────────────────────────────────────────────────────────────────────┐
│                       RUNTIME CONTEXT                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Upstream Dependencies:                                            │
│  └── Security (ACL) - module signing, execution authorization      │
│                                                                     │
│  Downstream Consumers:                                              │
│  └── Coordination (Domain Events) - agent lifecycle events         │
│                                                                     │
│  Integration Style:                                                 │
│  └── Anti-Corruption Layer toward external WASM runtimes           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Aggregate Root: RuntimeEnvironment

The `RuntimeEnvironment` is the aggregate root that manages the execution environment, including loaded WASM modules, active agent instances, and resource allocation.

### Aggregate Boundary

```
┌─────────────────────────────────────────────────────────────────────┐
│                   RuntimeEnvironment Aggregate                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────┐                                          │
│  │  RuntimeEnvironment   │ (Aggregate Root)                         │
│  │                       │                                          │
│  │  id                   │                                          │
│  │  platform             │                                          │
│  │  status               │                                          │
│  │  resource_limits      │                                          │
│  └───────────┬───────────┘                                          │
│              │                                                       │
│              │ owns                                                  │
│              ▼                                                       │
│  ┌─────────────────┐     ┌─────────────────┐     ┌───────────────┐  │
│  │   WASMModule    │     │  AgentInstance  │     │  ResourcePool │  │
│  │    (Entity)     │     │    (Entity)     │     │   (Entity)    │  │
│  │                 │     │                 │     │               │  │
│  │  bytecode       │     │  module_ref     │     │  memory       │  │
│  │  exports        │     │  state          │     │  threads      │  │
│  │  memory_pages   │     │  memory_budget  │     │  handles      │  │
│  └─────────────────┘     └─────────────────┘     └───────────────┘  │
│                                                                     │
│           ┌─────────────────────────────────────────┐               │
│           │        Value Objects                     │               │
│           │                                          │               │
│           │  MemoryBudget  CacheEntry  HealthStatus │               │
│           └─────────────────────────────────────────┘               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Invariants

1. **Resource Limits**: Total allocated resources cannot exceed environment limits
2. **Module Isolation**: Each agent instance has isolated memory
3. **Health Thresholds**: Unhealthy instances must be evicted or restarted
4. **Unique Instances**: Each agent ID maps to at most one active instance
5. **Module Verification**: Only signed/verified modules can be loaded

---

## Entities

### RuntimeEnvironment

Manages the execution environment for agents.

```rust
struct RuntimeEnvironment {
    // Identity
    id: RuntimeId,
    name: String,

    // Platform
    platform: RuntimePlatform,
    wasm_engine: WasmEngine,

    // Resources
    resource_pool: ResourcePool,
    resource_limits: ResourceLimits,

    // Modules
    modules: HashMap<ModuleId, WASMModule>,
    module_cache: LruCache<ModuleHash, CompiledModule>,

    // Instances
    instances: HashMap<AgentId, AgentInstance>,

    // Status
    status: RuntimeStatus,
    metrics: RuntimeMetrics,
    started_at: DateTime<Utc>,
}

#[derive(Clone, Copy, PartialEq)]
enum RuntimePlatform {
    Browser,       // Browser WASM runtime
    Node,          // Node.js with WASM
    Edge,          // Edge runtime (Cloudflare Workers, etc.)
    Native,        // Native Rust (for testing/development)
}

#[derive(Clone, Copy, PartialEq)]
enum RuntimeStatus {
    Initializing,
    Ready,
    Running,
    Degraded,
    ShuttingDown,
    Stopped,
}

impl RuntimeEnvironment {
    /// Load a WASM module
    fn load_module(&mut self, bytecode: &[u8], metadata: ModuleMetadata) -> Result<ModuleId, RuntimeError> {
        // Verify module signature
        if !self.verify_module_signature(bytecode, &metadata) {
            return Err(RuntimeError::InvalidSignature);
        }

        // Check cache
        let hash = ModuleHash::from_bytes(bytecode);
        let compiled = if let Some(cached) = self.module_cache.get(&hash) {
            cached.clone()
        } else {
            // Compile module
            let compiled = self.wasm_engine.compile(bytecode)?;
            self.module_cache.put(hash, compiled.clone());
            compiled
        };

        let module = WASMModule {
            id: ModuleId::new(),
            hash,
            bytecode: bytecode.to_vec(),
            compiled,
            exports: self.extract_exports(&compiled),
            memory_pages: metadata.memory_pages,
            metadata,
            loaded_at: Utc::now(),
        };

        let module_id = module.id;
        self.modules.insert(module_id, module);

        Ok(module_id)
    }

    /// Spawn an agent instance
    fn spawn_agent(
        &mut self,
        agent_id: AgentId,
        module_id: ModuleId,
        config: AgentConfig,
    ) -> Result<(), RuntimeError> {
        // Check if agent already exists
        if self.instances.contains_key(&agent_id) {
            return Err(RuntimeError::AgentAlreadyExists);
        }

        // Get module
        let module = self.modules.get(&module_id)
            .ok_or(RuntimeError::ModuleNotFound)?;

        // Allocate resources
        let memory_budget = self.resource_pool.allocate_memory(config.memory_limit)?;

        // Create instance
        let instance = self.wasm_engine.instantiate(&module.compiled, &memory_budget)?;

        let agent_instance = AgentInstance {
            id: InstanceId::new(),
            agent_id,
            module_id,
            instance,
            state: InstanceState::Starting,
            memory_budget,
            health: HealthStatus::Unknown,
            created_at: Utc::now(),
            last_activity: Utc::now(),
            invocation_count: 0,
        };

        self.instances.insert(agent_id, agent_instance);

        // Raise domain event
        self.raise(AgentSpawned {
            runtime_id: self.id,
            agent_id,
            module_id,
            memory_allocated: memory_budget.limit,
            timestamp: Utc::now(),
        });

        Ok(())
    }

    /// Evict an agent instance
    fn evict_agent(&mut self, agent_id: AgentId, reason: EvictionReason) -> Result<(), RuntimeError> {
        let instance = self.instances.remove(&agent_id)
            .ok_or(RuntimeError::AgentNotFound)?;

        // Release resources
        self.resource_pool.release_memory(instance.memory_budget);

        // Raise domain event
        self.raise(AgentEvicted {
            runtime_id: self.id,
            agent_id,
            reason,
            memory_released: instance.memory_budget.limit,
            uptime: Utc::now() - instance.created_at,
            timestamp: Utc::now(),
        });

        Ok(())
    }

    /// Invoke agent function
    fn invoke(
        &mut self,
        agent_id: AgentId,
        function: &str,
        args: &[WasmValue],
    ) -> Result<Vec<WasmValue>, RuntimeError> {
        let instance = self.instances.get_mut(&agent_id)
            .ok_or(RuntimeError::AgentNotFound)?;

        if instance.state != InstanceState::Running {
            return Err(RuntimeError::AgentNotRunning);
        }

        // Check memory budget
        if instance.memory_budget.is_exceeded() {
            return Err(RuntimeError::MemoryExceeded);
        }

        // Invoke function
        let result = instance.instance.invoke(function, args)?;

        instance.last_activity = Utc::now();
        instance.invocation_count += 1;

        Ok(result)
    }

    /// Handle memory pressure
    fn handle_memory_pressure(&mut self) -> Vec<AgentId> {
        let mut evicted = Vec::new();

        // Sort instances by priority (LRU, health, memory usage)
        let mut candidates: Vec<_> = self.instances.iter()
            .filter(|(_, i)| i.state != InstanceState::Critical)
            .collect();

        candidates.sort_by(|(_, a), (_, b)| {
            // Prioritize eviction: unhealthy > old activity > high memory
            match (&a.health, &b.health) {
                (HealthStatus::Unhealthy, HealthStatus::Healthy) => std::cmp::Ordering::Less,
                (HealthStatus::Healthy, HealthStatus::Unhealthy) => std::cmp::Ordering::Greater,
                _ => a.last_activity.cmp(&b.last_activity),
            }
        });

        // Evict until memory pressure is resolved
        for (agent_id, _) in candidates {
            if !self.resource_pool.is_under_pressure() {
                break;
            }

            if self.evict_agent(*agent_id, EvictionReason::MemoryPressure).is_ok() {
                evicted.push(*agent_id);
            }
        }

        if !evicted.is_empty() {
            self.raise(MemoryPressure {
                runtime_id: self.id,
                evicted_agents: evicted.clone(),
                memory_before: self.resource_pool.used_memory(),
                memory_after: self.resource_pool.used_memory(),
                timestamp: Utc::now(),
            });
        }

        evicted
    }
}
```

### WASMModule

Represents a loaded WebAssembly module.

```rust
struct WASMModule {
    // Identity
    id: ModuleId,
    hash: ModuleHash,

    // Code
    bytecode: Vec<u8>,
    compiled: CompiledModule,

    // Interface
    exports: Vec<Export>,
    imports: Vec<Import>,

    // Resources
    memory_pages: u32,

    // Metadata
    metadata: ModuleMetadata,
    loaded_at: DateTime<Utc>,
}

struct ModuleMetadata {
    name: String,
    version: String,
    author: Option<String>,
    signature: Option<Signature>,
    memory_pages: u32,
    features: Vec<String>,
}

struct Export {
    name: String,
    export_type: ExportType,
}

enum ExportType {
    Function { params: Vec<ValueType>, results: Vec<ValueType> },
    Memory { min_pages: u32, max_pages: Option<u32> },
    Table { element_type: TableElementType, min: u32, max: Option<u32> },
    Global { value_type: ValueType, mutable: bool },
}

impl WASMModule {
    /// Check if module exports a function
    fn has_export(&self, name: &str) -> bool {
        self.exports.iter().any(|e| e.name == name)
    }

    /// Get function signature
    fn get_function_signature(&self, name: &str) -> Option<(Vec<ValueType>, Vec<ValueType>)> {
        self.exports.iter()
            .find(|e| e.name == name)
            .and_then(|e| match &e.export_type {
                ExportType::Function { params, results } => Some((params.clone(), results.clone())),
                _ => None,
            })
    }

    /// Estimate memory usage
    fn estimated_memory(&self) -> usize {
        self.bytecode.len() + (self.memory_pages as usize * 65536)
    }
}
```

### AgentInstance

Represents a running agent instance.

```rust
struct AgentInstance {
    // Identity
    id: InstanceId,
    agent_id: AgentId,
    module_id: ModuleId,

    // Runtime
    instance: WasmInstance,

    // State
    state: InstanceState,
    health: HealthStatus,

    // Resources
    memory_budget: MemoryBudget,

    // Metrics
    created_at: DateTime<Utc>,
    last_activity: DateTime<Utc>,
    invocation_count: u64,
}

#[derive(Clone, Copy, PartialEq)]
enum InstanceState {
    Starting,
    Running,
    Paused,
    Stopping,
    Stopped,
    Failed,
    Critical,  // Protected from eviction
}

impl AgentInstance {
    /// Start the instance
    fn start(&mut self) -> Result<(), RuntimeError> {
        if self.state != InstanceState::Starting && self.state != InstanceState::Paused {
            return Err(RuntimeError::InvalidStateTransition);
        }

        // Call _start or _initialize if exported
        if self.instance.has_export("_initialize") {
            self.instance.invoke("_initialize", &[])?;
        }

        self.state = InstanceState::Running;
        Ok(())
    }

    /// Pause the instance
    fn pause(&mut self) -> Result<(), RuntimeError> {
        if self.state != InstanceState::Running {
            return Err(RuntimeError::InvalidStateTransition);
        }

        self.state = InstanceState::Paused;
        Ok(())
    }

    /// Resume the instance
    fn resume(&mut self) -> Result<(), RuntimeError> {
        if self.state != InstanceState::Paused {
            return Err(RuntimeError::InvalidStateTransition);
        }

        self.state = InstanceState::Running;
        Ok(())
    }

    /// Stop the instance
    fn stop(&mut self) -> Result<(), RuntimeError> {
        if self.state == InstanceState::Stopped {
            return Ok(());
        }

        self.state = InstanceState::Stopping;

        // Call cleanup if exported
        if self.instance.has_export("_cleanup") {
            let _ = self.instance.invoke("_cleanup", &[]);
        }

        self.state = InstanceState::Stopped;
        Ok(())
    }

    /// Update health status
    fn update_health(&mut self, status: HealthStatus) {
        self.health = status;
        if status == HealthStatus::Unhealthy {
            // Could trigger recovery or eviction
        }
    }
}
```

### ResourcePool

Manages shared resources.

```rust
struct ResourcePool {
    // Memory
    total_memory: usize,
    used_memory: AtomicUsize,
    memory_allocations: HashMap<AllocationId, MemoryAllocation>,

    // Threads/Workers
    thread_pool: ThreadPool,
    max_threads: usize,

    // File handles
    handle_pool: HandlePool,
    max_handles: usize,

    // Pressure thresholds
    memory_pressure_threshold: f64,
    critical_threshold: f64,
}

struct MemoryAllocation {
    id: AllocationId,
    size: usize,
    allocated_at: DateTime<Utc>,
    owner: AgentId,
}

impl ResourcePool {
    /// Allocate memory for an agent
    fn allocate_memory(&mut self, requested: usize) -> Result<MemoryBudget, ResourceError> {
        let current = self.used_memory.load(Ordering::SeqCst);

        if current + requested > self.total_memory {
            return Err(ResourceError::InsufficientMemory {
                requested,
                available: self.total_memory - current,
            });
        }

        self.used_memory.fetch_add(requested, Ordering::SeqCst);

        Ok(MemoryBudget {
            limit: requested,
            used: AtomicUsize::new(0),
            peak: AtomicUsize::new(0),
        })
    }

    /// Release memory allocation
    fn release_memory(&mut self, budget: MemoryBudget) {
        self.used_memory.fetch_sub(budget.limit, Ordering::SeqCst);
    }

    /// Check if under memory pressure
    fn is_under_pressure(&self) -> bool {
        let usage = self.used_memory.load(Ordering::SeqCst) as f64 / self.total_memory as f64;
        usage > self.memory_pressure_threshold
    }

    /// Check if critical
    fn is_critical(&self) -> bool {
        let usage = self.used_memory.load(Ordering::SeqCst) as f64 / self.total_memory as f64;
        usage > self.critical_threshold
    }

    /// Get current memory usage
    fn used_memory(&self) -> usize {
        self.used_memory.load(Ordering::SeqCst)
    }

    /// Get available memory
    fn available_memory(&self) -> usize {
        self.total_memory - self.used_memory.load(Ordering::SeqCst)
    }
}
```

---

## Value Objects

### MemoryBudget

Memory allocation budget for an agent.

```rust
#[derive(Clone)]
struct MemoryBudget {
    limit: usize,
    used: AtomicUsize,
    peak: AtomicUsize,
}

impl MemoryBudget {
    /// Record memory usage
    fn record_usage(&self, bytes: usize) {
        self.used.store(bytes, Ordering::SeqCst);
        self.peak.fetch_max(bytes, Ordering::SeqCst);
    }

    /// Check if budget is exceeded
    fn is_exceeded(&self) -> bool {
        self.used.load(Ordering::SeqCst) > self.limit
    }

    /// Get utilization percentage
    fn utilization(&self) -> f64 {
        self.used.load(Ordering::SeqCst) as f64 / self.limit as f64
    }

    /// Get remaining budget
    fn remaining(&self) -> usize {
        self.limit.saturating_sub(self.used.load(Ordering::SeqCst))
    }
}
```

### CacheEntry

Cached compilation result.

```rust
#[derive(Clone)]
struct CacheEntry {
    module_hash: ModuleHash,
    compiled: CompiledModule,
    size: usize,
    hits: AtomicU64,
    last_access: AtomicI64,
    created_at: DateTime<Utc>,
}

impl CacheEntry {
    /// Record cache hit
    fn record_hit(&self) {
        self.hits.fetch_add(1, Ordering::SeqCst);
        self.last_access.store(Utc::now().timestamp(), Ordering::SeqCst);
    }

    /// Get hit count
    fn hit_count(&self) -> u64 {
        self.hits.load(Ordering::SeqCst)
    }

    /// Get age
    fn age(&self) -> Duration {
        Utc::now() - self.created_at
    }
}
```

### HealthStatus

Health status of an agent instance.

```rust
#[derive(Clone, Copy, PartialEq)]
enum HealthStatus {
    Unknown,
    Healthy,
    Degraded,
    Unhealthy,
}

#[derive(Clone)]
struct HealthCheck {
    status: HealthStatus,
    checked_at: DateTime<Utc>,
    details: HealthDetails,
}

struct HealthDetails {
    memory_ok: bool,
    response_ok: bool,
    error_rate_ok: bool,
    last_error: Option<String>,
    consecutive_failures: u32,
}

impl HealthStatus {
    fn from_details(details: &HealthDetails) -> Self {
        if details.memory_ok && details.response_ok && details.error_rate_ok {
            HealthStatus::Healthy
        } else if details.consecutive_failures > 3 {
            HealthStatus::Unhealthy
        } else {
            HealthStatus::Degraded
        }
    }
}
```

---

## Domain Services

### AgentFactory

Creates and configures agent instances.

```rust
struct AgentFactory {
    module_registry: Box<dyn ModuleRegistry>,
    config_provider: Box<dyn ConfigProvider>,
}

impl AgentFactory {
    /// Create agent with default configuration
    fn create_default(
        &self,
        runtime: &mut RuntimeEnvironment,
        agent_type: AgentType,
    ) -> Result<AgentId, RuntimeError> {
        let module_id = self.module_registry.get_module_for_type(agent_type)?;
        let config = self.config_provider.get_default_config(agent_type);

        let agent_id = AgentId::new();
        runtime.spawn_agent(agent_id, module_id, config)?;

        Ok(agent_id)
    }

    /// Create agent with custom configuration
    fn create_custom(
        &self,
        runtime: &mut RuntimeEnvironment,
        agent_id: AgentId,
        module_id: ModuleId,
        config: AgentConfig,
    ) -> Result<(), RuntimeError> {
        // Validate configuration
        self.validate_config(&config)?;

        runtime.spawn_agent(agent_id, module_id, config)
    }

    fn validate_config(&self, config: &AgentConfig) -> Result<(), RuntimeError> {
        if config.memory_limit < 1024 * 1024 {
            return Err(RuntimeError::InvalidConfig("Memory limit too low".into()));
        }
        if config.memory_limit > 512 * 1024 * 1024 {
            return Err(RuntimeError::InvalidConfig("Memory limit too high".into()));
        }
        Ok(())
    }
}
```

### MemoryManager

Manages memory allocation and garbage collection.

```rust
struct MemoryManager {
    gc_threshold: f64,
    gc_interval: Duration,
    last_gc: DateTime<Utc>,
}

impl MemoryManager {
    /// Check if GC is needed
    fn needs_gc(&self, pool: &ResourcePool) -> bool {
        let time_since_gc = Utc::now() - self.last_gc;

        pool.is_under_pressure() || time_since_gc > self.gc_interval
    }

    /// Run garbage collection
    fn run_gc(&mut self, runtime: &mut RuntimeEnvironment) -> GCResult {
        let start = Instant::now();
        let memory_before = runtime.resource_pool.used_memory();

        // Clear module cache of unused entries
        let evicted_modules = self.gc_module_cache(&mut runtime.module_cache);

        // Compact instance memory
        let compacted_instances = self.compact_instances(&mut runtime.instances);

        self.last_gc = Utc::now();

        GCResult {
            duration: start.elapsed(),
            memory_before,
            memory_after: runtime.resource_pool.used_memory(),
            evicted_modules,
            compacted_instances,
        }
    }

    fn gc_module_cache(&self, cache: &mut LruCache<ModuleHash, CompiledModule>) -> usize {
        let to_evict: Vec<_> = cache.iter()
            .filter(|(_, entry)| {
                // Evict entries not accessed in last hour
                let last_access = DateTime::<Utc>::from_timestamp(
                    entry.last_access.load(Ordering::SeqCst), 0
                ).unwrap_or(Utc::now());
                Utc::now() - last_access > Duration::hours(1)
            })
            .map(|(k, _)| k.clone())
            .collect();

        for key in &to_evict {
            cache.pop(key);
        }

        to_evict.len()
    }

    fn compact_instances(&self, instances: &mut HashMap<AgentId, AgentInstance>) -> usize {
        let mut compacted = 0;

        for instance in instances.values_mut() {
            if instance.state == InstanceState::Running {
                // Request WASM runtime to compact memory
                if instance.instance.compact_memory().is_ok() {
                    compacted += 1;
                }
            }
        }

        compacted
    }
}
```

### HealthChecker

Monitors agent health.

```rust
struct HealthChecker {
    check_interval: Duration,
    timeout: Duration,
    failure_threshold: u32,
}

impl HealthChecker {
    /// Check health of all instances
    async fn check_all(&self, runtime: &mut RuntimeEnvironment) -> Vec<HealthCheck> {
        let mut results = Vec::new();

        for (agent_id, instance) in &mut runtime.instances {
            let check = self.check_instance(instance).await;

            instance.update_health(check.status);
            results.push(check);

            // Handle unhealthy instances
            if check.status == HealthStatus::Unhealthy {
                self.handle_unhealthy(*agent_id, instance, &check);
            }
        }

        results
    }

    /// Check single instance health
    async fn check_instance(&self, instance: &AgentInstance) -> HealthCheck {
        let mut details = HealthDetails {
            memory_ok: true,
            response_ok: true,
            error_rate_ok: true,
            last_error: None,
            consecutive_failures: 0,
        };

        // Check memory usage
        details.memory_ok = instance.memory_budget.utilization() < 0.95;

        // Check responsiveness (ping/pong)
        if instance.instance.has_export("_health_check") {
            match timeout(self.timeout, instance.instance.invoke("_health_check", &[])).await {
                Ok(Ok(_)) => details.response_ok = true,
                Ok(Err(e)) => {
                    details.response_ok = false;
                    details.last_error = Some(e.to_string());
                }
                Err(_) => {
                    details.response_ok = false;
                    details.last_error = Some("Health check timeout".to_string());
                }
            }
        }

        HealthCheck {
            status: HealthStatus::from_details(&details),
            checked_at: Utc::now(),
            details,
        }
    }

    fn handle_unhealthy(&self, agent_id: AgentId, instance: &mut AgentInstance, check: &HealthCheck) {
        if check.details.consecutive_failures > self.failure_threshold {
            // Mark for eviction
            instance.state = InstanceState::Failed;
        } else {
            // Try recovery
            if instance.instance.has_export("_recover") {
                let _ = instance.instance.invoke("_recover", &[]);
            }
        }
    }
}
```

---

## Domain Events

### AgentSpawned

Emitted when an agent is spawned.

```rust
struct AgentSpawned {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    runtime_id: RuntimeId,
    agent_id: AgentId,
    module_id: ModuleId,
    memory_allocated: usize,
}
```

### AgentEvicted

Emitted when an agent is evicted.

```rust
struct AgentEvicted {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    runtime_id: RuntimeId,
    agent_id: AgentId,
    reason: EvictionReason,
    memory_released: usize,
    uptime: Duration,
}

#[derive(Clone, Copy, PartialEq)]
enum EvictionReason {
    MemoryPressure,
    HealthFailure,
    Timeout,
    Manual,
    Shutdown,
    PolicyViolation,
}
```

### MemoryPressure

Emitted when memory pressure is detected.

```rust
struct MemoryPressure {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    runtime_id: RuntimeId,
    evicted_agents: Vec<AgentId>,
    memory_before: usize,
    memory_after: usize,
    pressure_level: PressureLevel,
}

#[derive(Clone, Copy)]
enum PressureLevel {
    Warning,    // > 70%
    High,       // > 85%
    Critical,   // > 95%
}
```

### ModuleLoaded

Emitted when a WASM module is loaded.

```rust
struct ModuleLoaded {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    runtime_id: RuntimeId,
    module_id: ModuleId,
    module_hash: ModuleHash,
    size: usize,
    exports: Vec<String>,
}
```

### HealthCheckCompleted

Emitted after health check cycle.

```rust
struct HealthCheckCompleted {
    event_id: EventId,
    timestamp: DateTime<Utc>,
    runtime_id: RuntimeId,
    total_checked: usize,
    healthy_count: usize,
    degraded_count: usize,
    unhealthy_count: usize,
    duration: Duration,
}
```

---

## Repository Interfaces

### ModuleRepository

```rust
trait ModuleRepository {
    /// Load WASM module from storage
    fn load_wasm(&self, id: &ModuleId) -> Result<WASMModule, RepositoryError>;

    /// Save compiled module
    fn save(&mut self, module: &WASMModule) -> Result<(), RepositoryError>;

    /// Find module by hash
    fn find_by_hash(&self, hash: &ModuleHash) -> Option<ModuleId>;

    /// List all modules
    fn list(&self) -> Vec<ModuleMetadata>;

    /// Delete module
    fn delete(&mut self, id: &ModuleId) -> Result<(), RepositoryError>;
}
```

### InstanceRepository

```rust
trait InstanceRepository {
    /// Save instance state (for recovery)
    fn save_state(&mut self, agent_id: AgentId, state: &InstanceSnapshot) -> Result<(), RepositoryError>;

    /// Load instance state
    fn load_state(&self, agent_id: AgentId) -> Option<InstanceSnapshot>;

    /// Delete instance state
    fn delete_state(&mut self, agent_id: AgentId) -> Result<(), RepositoryError>;

    /// List saved states
    fn list_saved(&self) -> Vec<AgentId>;
}
```

### MetricsRepository

```rust
trait MetricsRepository {
    /// Record runtime metrics
    fn record(&mut self, metrics: RuntimeMetrics) -> Result<(), RepositoryError>;

    /// Query metrics by time range
    fn query(&self, range: TimeRange) -> Vec<RuntimeMetrics>;

    /// Get aggregated metrics
    fn aggregate(&self, range: TimeRange, granularity: Duration) -> Vec<AggregatedMetrics>;
}
```

---

## Integration Points

### Events Published

| Event | Consumer Context | Action |
|-------|-----------------|--------|
| `AgentSpawned` | Coordination | Register agent in swarm |
| `AgentEvicted` | Coordination | Remove agent from swarm |
| `MemoryPressure` | Coordination | Trigger load balancing |

### Events Consumed

| Event | Source Context | Action |
|-------|----------------|--------|
| `AgentJoined` | Coordination | Prepare resources |
| `AgentLeft` | Coordination | Release resources |

### Services Exposed

| Service | Consumer | Purpose |
|---------|----------|---------|
| `spawn_agent` | Coordination | Create new agent |
| `evict_agent` | Coordination | Remove agent |
| `invoke` | All | Execute agent function |
| `get_health` | Coordination | Query agent health |
