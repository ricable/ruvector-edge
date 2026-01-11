# ADR-117: SONA Self-Optimizing Neural Architecture

**Status:** Accepted  
**Date:** 2026-01-11  
**Category:** Intelligence  
**Impact:** HIGH

---

## Context

The ELEX agent swarm requires continuous self-improvement through online learning. Traditional neural network fine-tuning risks catastrophic forgetting and requires expensive retraining. A self-optimizing architecture that adapts in real-time while preserving existing knowledge is needed.

**Problems Addressed:**
- Fine-tuning causes catastrophic forgetting of previous knowledge
- Full retraining is computationally expensive for WASM
- Online learning requires minimal latency overhead
- Weight updates must be stable and reversible

**Related ADRs:**
- ADR-006: Q-Learning Engine for Self-Learning
- ADR-112: Neural Learning Pipeline Integration
- ADR-113: Decision Transformer Integration
- ADR-114: ReasoningBank 4-Step Pipeline

---

## Decision

**We will implement SONA (Self-Optimizing Neural Architecture) as an extension in `elex-reasoningbank` that enables continuous learning with minimal latency and forgetting prevention.**

### SONA Components

| Component | Purpose | Performance Target |
|-----------|---------|-------------------|
| Micro-LoRA | Fast adaptation (rank 1-2) | <0.8ms per trajectory |
| Base LoRA | Stability (rank 4-16) | Periodic consolidation |
| EWC (Elastic Weight Consolidation) | Prevent catastrophic forgetting | λ=0.5 default |
| ReasoningBank Integration | K-means++ pattern clustering | Capacity-limited |
| Lock-Free Trajectories | Concurrent trajectory updates | ~50ns overhead |

### Architecture

```
Input → Base Model → LoRA Adapter → Output
            ↑               ↑
         Frozen        Micro-LoRA (fast)
                            +
                       Base LoRA (stable)
                            +
                       EWC Regularization
```

### Core Structures

```rust
pub struct SonaConfig {
    pub micro_lora_rank: usize,      // 1-2 for fast adaptation
    pub base_lora_rank: usize,       // 4-16 for stability
    pub ewc_lambda: f32,             // 0.5 default (prevent forgetting)
    pub reasoning_bank_capacity: usize, // K-means++ clustering size
    pub lock_free_trajectories: bool, // ~50ns overhead per step
}

pub struct Sona {
    config: SonaConfig,
    micro_lora: LoRAAdapter,
    base_lora: LoRAAdapter,
    fisher_information: Vec<f32>,    // For EWC
    reasoning_bank: ReasoningBank,
}

pub struct LoRAAdapter {
    pub rank: usize,
    pub alpha: f32,
    pub a_matrices: Vec<Vec<f32>>,   // Low-rank decomposition A
    pub b_matrices: Vec<Vec<f32>>,   // Low-rank decomposition B
}
```

### EWC Regularization

```rust
impl Sona {
    /// Elastic Weight Consolidation to prevent catastrophic forgetting
    fn ewc_loss(&self, new_weights: &[f32]) -> f32 {
        let mut loss = 0.0;
        for (i, (new_w, old_w)) in new_weights.iter()
            .zip(self.base_lora.flatten())
            .enumerate() 
        {
            let fisher = self.fisher_information[i];
            loss += fisher * (new_w - old_w).powi(2);
        }
        self.config.ewc_lambda * loss
    }
}
```

### WASM Integration

```rust
#[wasm_bindgen]
impl Sona {
    pub fn learn_from_trajectory(&mut self, trajectory: JsValue) -> Result<(), JsValue>;
    pub fn adapt_weights(&mut self, feedback: f32) -> Result<(), JsValue>;
    pub fn consolidate_patterns(&mut self) -> Result<JsValue, JsValue>;
    pub fn get_fisher_information(&self) -> Result<JsValue, JsValue>;
}
```

---

## Alternatives Considered

### 1. Full Fine-Tuning
- **Pros:** Maximum adaptation capability
- **Cons:** Catastrophic forgetting, high compute cost
- **Decision:** Rejected - LoRA provides efficient adaptation without full weight updates

### 2. Experience Replay Only
- **Pros:** Simple, well-understood
- **Cons:** Memory-bound, doesn't scale to large trajectory sets
- **Decision:** Rejected - K-means++ clustering in ReasoningBank is more memory-efficient

### 3. Gradient Episodic Memory (GEM)
- **Pros:** Strong forgetting prevention
- **Cons:** Quadratic memory in number of tasks
- **Decision:** Rejected - EWC provides forgetting prevention with linear memory

### 4. Progressive Neural Networks
- **Pros:** No forgetting (frozen columns)
- **Cons:** Model grows linearly with tasks
- **Decision:** Rejected - WASM constraints require fixed model size

---

## Consequences

### Positive

1. **Ultra-Low Latency:** <0.8ms learning per trajectory
2. **No Forgetting:** EWC preserves important weights
3. **Memory Efficient:** LoRA rank limits parameter count
4. **Concurrent Safe:** Lock-free trajectory updates
5. **Reversible:** Can reset to base LoRA weights

### Negative

1. **Limited Capacity:** LoRA rank constrains adaptation depth
2. **Hyperparameter Sensitivity:** ewc_lambda requires tuning
3. **Fisher Computation:** Periodic Fisher information updates needed

### Risks

1. **Underfitting:** Low LoRA rank may not capture complex patterns (mitigated by base LoRA)
2. **Fisher Staleness:** Outdated Fisher information reduces EWC effectiveness
3. **Rank Selection:** Wrong rank could hurt performance

---

## Performance Targets

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Learning Latency | <0.8ms per trajectory | Rust benchmarks |
| Adaptation Speed | <100μs per update | Weight update timing |
| Memory Overhead | <5% of base model | Memory profiling |
| Convergence | ~100 interactions per pattern | Learning curve analysis |
| Lock-Free Overhead | ~50ns per step | Atomic operation timing |

---

## Implementation

### New Files

```
src/wasm/crates/elex-reasoningbank/
├── src/
│   ├── sona.rs          # [NEW] SONA implementation
│   ├── lora.rs          # [NEW] LoRA adapter
│   ├── ewc.rs           # [NEW] Elastic Weight Consolidation
│   └── lib.rs           # [MODIFY] Export SONA module
```

### Configuration Defaults

```rust
impl Default for SonaConfig {
    fn default() -> Self {
        Self {
            micro_lora_rank: 2,
            base_lora_rank: 8,
            ewc_lambda: 0.5,
            reasoning_bank_capacity: 1000,
            lock_free_trajectories: true,
        }
    }
}
```

---

## Verification

### Unit Tests
```bash
cd src/wasm && cargo test -p elex-reasoningbank --test sona
```

### Forgetting Test
```typescript
// Train on task A, then task B, verify A not forgotten
await sona.learnFromTrajectory(taskA_trajectories);
const baseline_A = await sona.evaluate(taskA_queries);
await sona.learnFromTrajectory(taskB_trajectories);
const after_B = await sona.evaluate(taskA_queries);
assert(after_B.score >= baseline_A.score * 0.95); // <5% forgetting
```

### Latency Test
```typescript
const start = performance.now();
for (const traj of trajectories_1000) {
    await sona.learnFromTrajectory(traj);
}
const elapsed = performance.now() - start;
assert(elapsed / 1000 < 0.8); // <0.8ms average
```

---

## References

- [ADR-006](ADR-006-q-learning-engine.md) - Q-Learning Engine
- [ADR-112](ADR-112-neural-learning-pipeline.md) - Neural Learning Pipeline
- [ADR-113](ADR-113-decision-transformer.md) - Decision Transformer
- [ADR-114](ADR-114-reasoningbank-pipeline.md) - ReasoningBank Pipeline
- [LoRA Paper](https://arxiv.org/abs/2106.09685) - Hu et al., 2021
- [EWC Paper](https://arxiv.org/abs/1612.00796) - Kirkpatrick et al., 2017
- [Self-Learning Swarm PRD](../self-learning-swarm-PRD.md) - Implementation specification

---

**Implementation Date:** 2026-01-11  
**Status:** ✅ Accepted
