# ADR-019: Persistence Format for Q-Tables and Agent State

## Status
Accepted

## Context
The 593-agent neural system requires persistent storage for:

- **Q-Tables:** 64 states x 20 actions x 4 bytes = ~5KB per agent, 593 agents = ~3MB
- **Trajectory Buffers:** Up to 1000 trajectories x 1KB = ~1MB per agent
- **Learned Patterns:** HNSW indices, embedding vectors
- **Configuration:** Agent settings, safe zone constraints
- **Session State:** Current learning progress, exploration rates

Storage environments:
- **Browser:** IndexedDB (async, structured, ~50MB+ quota)
- **Node.js:** File system, SQLite
- **Edge Devices:** Limited storage, power constraints

Requirements:
- **Serialization Speed:** Q-table export <10ms, import <20ms
- **Compression:** Reduce storage by 50%+
- **Versioning:** Support format evolution
- **Integrity:** Detect corruption
- **Portability:** Same format across all environments

## Decision
We adopt **Bincode + LZ4 Compression with Versioned Headers** for persistence:

### 1. Binary Format Structure

```
+------------------+------------------+------------------+
| Header (32 bytes)| Compressed Data  | Checksum (4 bytes)|
+------------------+------------------+------------------+

Header:
  - Magic: 4 bytes ("ELEX")
  - Version: 4 bytes (major.minor.patch.reserved)
  - Type: 4 bytes (QTABLE=1, TRAJECTORY=2, CONFIG=3, STATE=4)
  - Uncompressed Size: 8 bytes
  - Compressed Size: 8 bytes
  - Flags: 4 bytes (compression=bit0, encrypted=bit1)

Checksum:
  - CRC32 of compressed data
```

```rust
use serde::{Deserialize, Serialize};

/// File header for all persisted data
#[derive(Debug, Clone, Copy)]
#[repr(C, packed)]
pub struct PersistenceHeader {
    pub magic: [u8; 4],           // "ELEX"
    pub version: Version,          // Format version
    pub data_type: DataType,       // What's stored
    pub uncompressed_size: u64,    // Size before compression
    pub compressed_size: u64,      // Size after compression
    pub flags: Flags,              // Compression, encryption, etc.
}

#[derive(Debug, Clone, Copy)]
#[repr(C)]
pub struct Version {
    pub major: u8,
    pub minor: u8,
    pub patch: u8,
    pub reserved: u8,
}

#[derive(Debug, Clone, Copy, PartialEq)]
#[repr(u32)]
pub enum DataType {
    QTable = 1,
    TrajectoryBuffer = 2,
    AgentConfig = 3,
    SessionState = 4,
    HNSWIndex = 5,
    FederatedDelta = 6,
}

bitflags::bitflags! {
    #[derive(Debug, Clone, Copy)]
    pub struct Flags: u32 {
        const COMPRESSED = 0b0001;
        const ENCRYPTED = 0b0010;
        const INCREMENTAL = 0b0100;
    }
}

impl PersistenceHeader {
    pub const MAGIC: [u8; 4] = *b"ELEX";
    pub const SIZE: usize = 32;

    pub fn new(data_type: DataType, uncompressed: u64, compressed: u64, flags: Flags) -> Self {
        PersistenceHeader {
            magic: Self::MAGIC,
            version: Version::current(),
            data_type,
            uncompressed_size: uncompressed,
            compressed_size: compressed,
            flags,
        }
    }

    pub fn validate(&self) -> Result<(), PersistenceError> {
        if self.magic != Self::MAGIC {
            return Err(PersistenceError::InvalidMagic);
        }
        if !self.version.is_compatible() {
            return Err(PersistenceError::IncompatibleVersion {
                file: self.version,
                supported: Version::current(),
            });
        }
        Ok(())
    }
}
```

### 2. Bincode Serialization

```rust
use bincode::{config, Decode, Encode};

/// Bincode configuration for deterministic encoding
fn bincode_config() -> impl bincode::config::Config {
    config::standard()
        .with_little_endian()
        .with_fixed_int_encoding()
        .with_limit::<{ 100 * 1024 * 1024 }>() // 100MB limit
}

/// Q-table serialization format
#[derive(Encode, Decode, Debug)]
pub struct QTableData {
    pub state_count: u32,
    pub action_count: u32,
    pub values: Vec<f32>,        // Flattened Q-values
    pub visit_counts: Vec<u32>,  // State-action visit counts
}

impl QTable {
    pub fn serialize(&self) -> Vec<u8> {
        let data = QTableData {
            state_count: self.state_count as u32,
            action_count: self.action_count as u32,
            values: self.values.clone(),
            visit_counts: self.visit_counts.clone(),
        };

        bincode::encode_to_vec(&data, bincode_config())
            .expect("Q-table serialization should not fail")
    }

    pub fn deserialize(bytes: &[u8]) -> Result<Self, PersistenceError> {
        let (data, _): (QTableData, _) = bincode::decode_from_slice(bytes, bincode_config())
            .map_err(|e| PersistenceError::Deserialization(e.to_string()))?;

        Ok(QTable {
            state_count: data.state_count as usize,
            action_count: data.action_count as usize,
            values: data.values,
            visit_counts: data.visit_counts,
        })
    }
}

/// Trajectory buffer serialization
#[derive(Encode, Decode, Debug)]
pub struct TrajectoryData {
    pub trajectories: Vec<TrajectoryEntry>,
    pub total_rewards: f64,
    pub episode_count: u32,
}

#[derive(Encode, Decode, Debug)]
pub struct TrajectoryEntry {
    pub state: [f32; 64],
    pub action: u8,
    pub reward: f32,
    pub next_state: [f32; 64],
    pub done: bool,
}
```

### 3. LZ4 Compression

```rust
use lz4_flex::{compress_prepend_size, decompress_size_prepended};

/// Compress data with LZ4
pub fn compress(data: &[u8]) -> Vec<u8> {
    compress_prepend_size(data)
}

/// Decompress LZ4 data
pub fn decompress(compressed: &[u8]) -> Result<Vec<u8>, PersistenceError> {
    decompress_size_prepended(compressed)
        .map_err(|e| PersistenceError::Decompression(e.to_string()))
}

/// Compression statistics
pub struct CompressionStats {
    pub original_size: usize,
    pub compressed_size: usize,
    pub ratio: f64,
    pub compression_time_us: u64,
}

impl CompressionStats {
    pub fn new(original: usize, compressed: usize, time_us: u64) -> Self {
        CompressionStats {
            original_size: original,
            compressed_size: compressed,
            ratio: original as f64 / compressed as f64,
            compression_time_us: time_us,
        }
    }
}
```

**Compression Ratios (Measured):**

| Data Type | Original | Compressed | Ratio |
|-----------|----------|------------|-------|
| Q-table (zero-init) | 5KB | 200B | 25x |
| Q-table (trained) | 5KB | 2KB | 2.5x |
| Trajectories | 100KB | 30KB | 3.3x |
| HNSW Index | 1MB | 600KB | 1.7x |

### 4. Complete Persistence API

```rust
/// High-level persistence interface
pub struct Persister {
    version: Version,
}

impl Persister {
    pub fn new() -> Self {
        Persister {
            version: Version::current(),
        }
    }

    /// Save Q-table with full header and compression
    pub fn save_q_table(&self, q_table: &QTable) -> Result<Vec<u8>, PersistenceError> {
        // Serialize to bincode
        let uncompressed = q_table.serialize();
        let uncompressed_size = uncompressed.len() as u64;

        // Compress
        let compressed = compress(&uncompressed);
        let compressed_size = compressed.len() as u64;

        // Calculate checksum
        let checksum = crc32fast::hash(&compressed);

        // Build output
        let mut output = Vec::with_capacity(
            PersistenceHeader::SIZE + compressed.len() + 4
        );

        // Write header
        let header = PersistenceHeader::new(
            DataType::QTable,
            uncompressed_size,
            compressed_size,
            Flags::COMPRESSED,
        );
        output.extend_from_slice(&header.as_bytes());

        // Write compressed data
        output.extend_from_slice(&compressed);

        // Write checksum
        output.extend_from_slice(&checksum.to_le_bytes());

        Ok(output)
    }

    /// Load Q-table with validation
    pub fn load_q_table(&self, data: &[u8]) -> Result<QTable, PersistenceError> {
        // Validate minimum size
        if data.len() < PersistenceHeader::SIZE + 4 {
            return Err(PersistenceError::TooSmall);
        }

        // Parse header
        let header = PersistenceHeader::from_bytes(&data[..PersistenceHeader::SIZE])?;
        header.validate()?;

        if header.data_type != DataType::QTable {
            return Err(PersistenceError::WrongType {
                expected: DataType::QTable,
                actual: header.data_type,
            });
        }

        // Extract compressed data and checksum
        let compressed_end = PersistenceHeader::SIZE + header.compressed_size as usize;
        let compressed = &data[PersistenceHeader::SIZE..compressed_end];
        let stored_checksum = u32::from_le_bytes(
            data[compressed_end..compressed_end + 4].try_into().unwrap()
        );

        // Verify checksum
        let computed_checksum = crc32fast::hash(compressed);
        if stored_checksum != computed_checksum {
            return Err(PersistenceError::ChecksumMismatch {
                expected: stored_checksum,
                actual: computed_checksum,
            });
        }

        // Decompress
        let uncompressed = if header.flags.contains(Flags::COMPRESSED) {
            decompress(compressed)?
        } else {
            compressed.to_vec()
        };

        // Deserialize
        QTable::deserialize(&uncompressed)
    }
}
```

### 5. IndexedDB Storage (Browser)

```rust
use wasm_bindgen::prelude::*;
use web_sys::{IdbDatabase, IdbObjectStore, IdbRequest};

/// IndexedDB storage backend
#[wasm_bindgen]
pub struct IndexedDbStorage {
    db: IdbDatabase,
}

#[wasm_bindgen]
impl IndexedDbStorage {
    /// Open or create database
    #[wasm_bindgen(constructor)]
    pub async fn new(db_name: &str) -> Result<IndexedDbStorage, JsError> {
        let window = web_sys::window().unwrap();
        let idb = window.indexed_db()?.unwrap();

        let request = idb.open_with_u32(db_name, 1)?;

        // Handle upgrade
        let upgrade_closure = Closure::once(|event: web_sys::Event| {
            let request: IdbRequest = event.target().unwrap().dyn_into().unwrap();
            let db: IdbDatabase = request.result().unwrap().dyn_into().unwrap();

            // Create object stores
            db.create_object_store("qtables")?;
            db.create_object_store("trajectories")?;
            db.create_object_store("config")?;
        });
        request.set_onupgradeneeded(Some(upgrade_closure.as_ref().unchecked_ref()));
        upgrade_closure.forget();

        // Wait for open
        let db = JsFuture::from(request).await?.dyn_into::<IdbDatabase>()?;

        Ok(IndexedDbStorage { db })
    }

    /// Save Q-table for agent
    #[wasm_bindgen(js_name = saveQTable)]
    pub async fn save_q_table(&self, agent_id: &str, data: &[u8]) -> Result<(), JsError> {
        let tx = self.db.transaction_with_str_and_mode("qtables", "readwrite")?;
        let store = tx.object_store("qtables")?;

        let key = JsValue::from_str(agent_id);
        let value = js_sys::Uint8Array::from(data);

        let request = store.put_with_key(&value, &key)?;
        JsFuture::from(request).await?;

        Ok(())
    }

    /// Load Q-table for agent
    #[wasm_bindgen(js_name = loadQTable)]
    pub async fn load_q_table(&self, agent_id: &str) -> Result<Option<Vec<u8>>, JsError> {
        let tx = self.db.transaction_with_str("qtables")?;
        let store = tx.object_store("qtables")?;

        let key = JsValue::from_str(agent_id);
        let request = store.get(&key)?;

        let result = JsFuture::from(request).await?;

        if result.is_undefined() {
            return Ok(None);
        }

        let array: js_sys::Uint8Array = result.dyn_into()?;
        Ok(Some(array.to_vec()))
    }

    /// Delete Q-table for agent
    #[wasm_bindgen(js_name = deleteQTable)]
    pub async fn delete_q_table(&self, agent_id: &str) -> Result<(), JsError> {
        let tx = self.db.transaction_with_str_and_mode("qtables", "readwrite")?;
        let store = tx.object_store("qtables")?;

        let key = JsValue::from_str(agent_id);
        let request = store.delete(&key)?;
        JsFuture::from(request).await?;

        Ok(())
    }
}
```

### 6. Version Migration

```rust
/// Migration from older versions
pub struct Migrator;

impl Migrator {
    /// Migrate data from any supported version to current
    pub fn migrate(data: &[u8]) -> Result<Vec<u8>, PersistenceError> {
        let header = PersistenceHeader::from_bytes(&data[..PersistenceHeader::SIZE])?;

        match (header.version.major, header.version.minor) {
            (1, 0) => Self::migrate_v1_0_to_current(data),
            (1, 1) => Self::migrate_v1_1_to_current(data),
            (1, 2) => Ok(data.to_vec()), // Current version
            _ => Err(PersistenceError::UnsupportedVersion(header.version)),
        }
    }

    fn migrate_v1_0_to_current(data: &[u8]) -> Result<Vec<u8>, PersistenceError> {
        // V1.0 had no visit counts; add zeros
        let old: QTableDataV1_0 = deserialize_v1_0(data)?;
        let new = QTableData {
            state_count: old.state_count,
            action_count: old.action_count,
            values: old.values,
            visit_counts: vec![0; old.state_count as usize * old.action_count as usize],
        };

        Persister::new().save_q_table(&new.into())
    }

    fn migrate_v1_1_to_current(data: &[u8]) -> Result<Vec<u8>, PersistenceError> {
        // V1.1 used different compression; recompress
        let header = PersistenceHeader::from_bytes(&data[..PersistenceHeader::SIZE])?;
        let decompressed = decompress_v1_1(&data[PersistenceHeader::SIZE..])?;

        // Recompress with current algorithm
        let compressed = compress(&decompressed);

        // Rebuild with new header
        let mut output = Vec::new();
        let new_header = PersistenceHeader::new(
            header.data_type,
            decompressed.len() as u64,
            compressed.len() as u64,
            Flags::COMPRESSED,
        );
        output.extend_from_slice(&new_header.as_bytes());
        output.extend_from_slice(&compressed);
        output.extend_from_slice(&crc32fast::hash(&compressed).to_le_bytes());

        Ok(output)
    }
}
```

## Alternatives Considered

### JSON Serialization
- **Pros:** Human-readable, easy debugging, universal support
- **Cons:** 5-10x larger, 10x slower to parse, no binary data
- **Rejected:** Performance and size requirements prohibit JSON

### MessagePack
- **Pros:** Compact, schema-less, wide language support
- **Cons:** Larger than bincode, slower for Rust types
- **Partial:** Used for config files where interop matters

### Protocol Buffers
- **Pros:** Schema evolution, cross-language
- **Cons:** Requires schema files, code generation, larger runtime
- **Rejected:** Overhead not justified for Rust-only persistence

### FlatBuffers
- **Pros:** Zero-copy access, fast reads
- **Cons:** Complex API, schema required
- **Deferred:** May use for HNSW index for random access

### Zstd Compression
- **Pros:** Better ratios than LZ4, dictionary support
- **Cons:** Larger binary size, slower compression
- **Partial:** Use for archival/transfer, LZ4 for hot storage

## Consequences

### Positive
- **Fast:** Bincode is fastest Rust serializer
- **Compact:** LZ4 reduces storage 50-90%
- **Safe:** CRC32 detects corruption
- **Evolvable:** Versioned format supports migration
- **Portable:** Same bytes work everywhere

### Negative
- **Rust-Specific:** Bincode format tied to Rust types
- **No Random Access:** Must decompress entire file
- **Version Maintenance:** Must maintain migration code
- **No Partial Updates:** Cannot update single Q-value

### Risks
- **Format Lock-In:** Changing format requires migration
- **Corruption Propagation:** Bad data may serialize without error
- **Browser Quota:** IndexedDB limits vary by browser
- **Sync Conflicts:** No built-in conflict resolution

### Mitigations
- **Format Stability:** Minimize format changes, test migrations
- **Validation Layer:** Validate data before serialization
- **Quota Management:** Monitor usage, purge old data
- **Conflict Strategy:** Last-write-wins or merge on import

## References
- ADR-011: Rust Memory Model
- ADR-013: wasm-bindgen Strategy
- Bincode - https://docs.rs/bincode
- LZ4 - https://docs.rs/lz4_flex
- IndexedDB MDN - https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- CRC32 - https://docs.rs/crc32fast
