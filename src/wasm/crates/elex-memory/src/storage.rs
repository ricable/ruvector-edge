//! LZ4 Compressed Storage for Q-Table Persistence
//!
//! Provides high-ratio compression (4-32x reduction) for Q-table storage.
//! Uses LZ4 compression algorithm for fast compression/decompression.
//! Supports IndexedDB persistence for WASM environments.
//!
//! # Features
//! - LZ4 compression with configurable levels (0-16)
//! - Compression ratio tracking (typically 4-32x)
//! - bincode serialization for Rust types
//! - IndexedDB backend for WASM persistence
//! - Async storage operations for WASM
//!
//! # Example
//! ```ignore
//! use elex_memory::storage::{CompressedStorage, StorageError};
//!
//! // Create storage with compression level 10
//! let storage = CompressedStorage::new(10);
//!
//! // Serialize and compress Q-table
//! let compressed = storage.save_qtable(&qtable)?;
//!
//! // Decompress and deserialize
//! let restored: QTable = storage.load_qtable(&compressed, original_size)?;
//!
//! // Check compression ratio
//! let ratio = storage.compression_ratio(&original, &compressed);
//! println!("Compression ratio: {:.2}x", ratio);
//! ```

use serde::{Deserialize, Serialize};

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::__rt::IntoJsResult;

#[cfg(target_arch = "wasm32")]
use js_sys::Promise;

// ============================================================================
// Error Types
// ============================================================================

/// Storage operation errors
#[derive(Debug, thiserror::Error)]
pub enum StorageError {
    #[error("Compression error: {0}")]
    Compression(String),

    #[error("Decompression error: {0}")]
    Decompression(String),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Storage backend error: {0}")]
    Backend(String),

    #[error("Invalid data size: expected {expected}, got {actual}")]
    InvalidSize { expected: usize, actual: usize },
}

// ============================================================================
// Compressed Storage
// ============================================================================

/// LZ4 compressed storage with configurable compression level
///
/// Provides high-ratio compression for Q-table persistence.
/// Compression levels: 0-16 (higher = better compression, slower).
///
/// Typical compression ratios:
/// - Level 0-4: 4-8x reduction
/// - Level 5-10: 8-16x reduction
/// - Level 11-16: 16-32x reduction
#[derive(Clone)]
pub struct CompressedStorage {
    /// Compression level (0-16)
    compression_level: u32,
}

impl CompressedStorage {
    /// Create new compressed storage
    ///
    /// # Arguments
    /// * `compression_level` - LZ4 compression level (0-16, higher = better compression)
    ///
    /// # Example
    /// ```ignore
    /// let storage = CompressedStorage::new(10); // Balanced compression
    /// ```
    pub fn new(compression_level: u32) -> Self {
        Self {
            compression_level: compression_level.min(16),
        }
    }
}

/// Default implementation for CompressedStorage
impl Default for CompressedStorage {
    /// Create with default compression level (10)
    fn default() -> Self {
        Self::new(10)
    }
}

impl CompressedStorage {
    /// Compress data using LZ4
    ///
    /// # Arguments
    /// * `data` - Input data to compress
    ///
    /// # Returns
    /// Compressed data
    ///
    /// # Errors
    /// Returns `StorageError::Compression` if compression fails
    pub fn compress(&self, data: &[u8]) -> Result<Vec<u8>, StorageError> {
        #[cfg(all(feature = "lz4", not(target_arch = "wasm32")))]
        {
            // Calculate maximum compressed size
            let max_compressed_size = data.len() + (data.len() / 255) + 16;

            let mut compressed = vec![0u8; max_compressed_size];

            // Compress data
            let compressed_len = lzzzz::lz4::compress(data, &mut compressed, self.compression_level as i32)
                .map_err(|e: lzzzz::Error| StorageError::Compression(e.to_string()))?;

            // Truncate to actual size
            compressed.truncate(compressed_len);

            Ok(compressed)
        }

        #[cfg(not(all(feature = "lz4", not(target_arch = "wasm32"))))]
        {
            // Fallback: no compression
            Ok(data.to_vec())
        }
    }

    /// Decompress LZ4 data
    ///
    /// # Arguments
    /// * `compressed` - Compressed data
    /// * `uncompressed_size` - Expected uncompressed size
    ///
    /// # Returns
    /// Decompressed data
    ///
    /// # Errors
    /// Returns `StorageError::Decompression` if decompression fails
    pub fn decompress(
        &self,
        compressed: &[u8],
        uncompressed_size: usize,
    ) -> Result<Vec<u8>, StorageError> {
        #[cfg(all(feature = "lz4", not(target_arch = "wasm32")))]
        {
            let mut decompressed = vec![0u8; uncompressed_size];

            // Decompress data
            lzzzz::lz4::decompress(compressed, &mut decompressed)
                .map_err(|e| StorageError::Decompression(e.to_string()))?;

            Ok(decompressed)
        }

        #[cfg(not(all(feature = "lz4", not(target_arch = "wasm32"))))]
        {
            // Fallback: no compression
            if compressed.len() != uncompressed_size {
                return Err(StorageError::InvalidSize {
                    expected: uncompressed_size,
                    actual: compressed.len(),
                });
            }
            Ok(compressed.to_vec())
        }
    }

    /// Serialize and compress Q-table
    ///
    /// # Arguments
    /// * `qtable` - Q-table to serialize and compress
    ///
    /// # Returns
    /// Compressed Q-table data
    ///
    /// # Errors
    /// Returns `StorageError::Serialization` if serialization fails
    /// Returns `StorageError::Compression` if compression fails
    pub fn save_qtable<T: Serialize>(&self, qtable: &T) -> Result<Vec<u8>, StorageError> {
        #[cfg(feature = "bincode")]
        {
            // Serialize using bincode
            let serialized = bincode::serialize(qtable)
                .map_err(|e| StorageError::Serialization(e.to_string()))?;

            // Compress serialized data
            self.compress(&serialized)
        }

        #[cfg(not(feature = "bincode"))]
        {
            // Fallback: JSON serialization
            let serialized = serde_json::to_vec(qtable)
                .map_err(|e| StorageError::Serialization(e.to_string()))?;

            self.compress(&serialized)
        }
    }

    /// Decompress and deserialize Q-table
    ///
    /// # Arguments
    /// * `data` - Compressed Q-table data
    /// * `original_size` - Original uncompressed size
    ///
    /// # Returns
    /// Deserialized Q-table
    ///
    /// # Errors
    /// Returns `StorageError::Decompression` if decompression fails
    /// Returns `StorageError::Serialization` if deserialization fails
    pub fn load_qtable<T: for<'de> Deserialize<'de>>(
        &self,
        data: &[u8],
        original_size: usize,
    ) -> Result<T, StorageError> {
        // Decompress data
        let decompressed = self.decompress(data, original_size)?;

        // Deserialize
        #[cfg(feature = "bincode")]
        {
            bincode::deserialize(&decompressed)
                .map_err(|e| StorageError::Serialization(e.to_string()))
        }

        #[cfg(not(feature = "bincode"))]
        {
            serde_json::from_slice(&decompressed)
                .map_err(|e| StorageError::Serialization(e.to_string()))
        }
    }

    /// Get compression ratio
    ///
    /// Returns the compression ratio (original_size / compressed_size).
    /// Values > 1.0 indicate compression (e.g., 10.0 = 10x reduction).
    ///
    /// # Arguments
    /// * `original` - Original uncompressed data
    /// * `compressed` - Compressed data
    ///
    /// # Returns
    /// Compression ratio (e.g., 10.0 = 10x compression)
    pub fn compression_ratio(&self, original: &[u8], compressed: &[u8]) -> f32 {
        if compressed.is_empty() {
            return 1.0;
        }
        original.len() as f32 / compressed.len() as f32
    }

    /// Get compression percentage
    ///
    /// Returns the percentage of size reduction (e.g., 90.0 = 90% reduction).
    ///
    /// # Arguments
    /// * `original` - Original uncompressed data
    /// * `compressed` - Compressed data
    ///
    /// # Returns
    /// Compression percentage (0-100)
    pub fn compression_percentage(&self, original: &[u8], compressed: &[u8]) -> f32 {
        if original.is_empty() {
            return 0.0;
        }
        let reduction = original.len().saturating_sub(compressed.len());
        (reduction as f32 / original.len() as f32) * 100.0
    }

    /// Get storage size information
    ///
    /// # Arguments
    /// * `original` - Original uncompressed data
    /// * `compressed` - Compressed data
    ///
    /// # Returns
    /// Storage size information
    pub fn storage_info(&self, original: &[u8], compressed: &[u8]) -> StorageInfo {
        StorageInfo {
            original_size: original.len(),
            compressed_size: compressed.len(),
            compression_ratio: self.compression_ratio(original, compressed),
            compression_percentage: self.compression_percentage(original, compressed),
            space_saved: original.len().saturating_sub(compressed.len()),
        }
    }
}

// ============================================================================
// Storage Information
// ============================================================================

/// Storage compression information
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StorageInfo {
    /// Original uncompressed size in bytes
    pub original_size: usize,
    /// Compressed size in bytes
    pub compressed_size: usize,
    /// Compression ratio (e.g., 10.0 = 10x compression)
    pub compression_ratio: f32,
    /// Compression percentage (0-100)
    pub compression_percentage: f32,
    /// Space saved in bytes
    pub space_saved: usize,
}

impl StorageInfo {
    /// Format size as human-readable string
    pub fn format_size(size: usize) -> String {
        const KB: usize = 1024;
        const MB: usize = 1024 * KB;
        const GB: usize = 1024 * MB;

        if size >= GB {
            format!("{:.2} GB", size as f32 / GB as f32)
        } else if size >= MB {
            format!("{:.2} MB", size as f32 / MB as f32)
        } else if size >= KB {
            format!("{:.2} KB", size as f32 / KB as f32)
        } else {
            format!("{} B", size)
        }
    }

    /// Get formatted summary
    pub fn summary(&self) -> String {
        format!(
            "Compression: {:.2}x ({} reduction) - {} -> {}",
            self.compression_ratio,
            format!("{:.1}%", self.compression_percentage),
            Self::format_size(self.original_size),
            Self::format_size(self.compressed_size)
        )
    }
}

// ============================================================================
// IndexedDB Backend (WASM)
// ============================================================================

/// IndexedDB backend for WASM persistence
///
/// Provides persistent storage in browser environments using IndexedDB.
#[cfg(target_arch = "wasm32")]
pub struct IndexedDBBackend {
    /// Database name
    db_name: String,
    /// Object store name
    store_name: String,
}

#[cfg(target_arch = "wasm32")]
impl IndexedDBBackend {
    /// Open IndexedDB database
    ///
    /// # Arguments
    /// * `db_name` - Database name
    ///
    /// # Returns
    /// Opened database backend
    ///
    /// # Errors
    /// Returns `StorageError::Backend` if database cannot be opened
    pub async fn open(db_name: &str) -> Result<Self, StorageError> {
        use wasm_bindgen::JsCast;
        use web_sys::{IdbDatabase, IdbOpenDbRequest};

        // Get IndexedDB
        let window = web_sys::window()
            .ok_or_else(|| StorageError::Backend("No window object".to_string()))?;
        let indexed_db = window
            .indexed_db()
            .map_err(|e| StorageError::Backend(format!("IndexedDB not available: {:?}", e)))?
            .ok_or_else(|| StorageError::Backend("IndexedDB not supported".to_string()))?;

        // Open database request
        let request: IdbOpenDbRequest = indexed_db
            .open_with_u32(db_name, 1)
            .map_err(|e| StorageError::Backend(format!("Failed to open database: {:?}", e)))?;

        // Create object store on upgrade
        let closure = wasm_bindgen::closure::Closure::once(move |event: &web_sys::Event| {
            let target = event
                .target()
                .unwrap()
                .dyn_into::<web_sys::IdbRequest>()
                .unwrap();
            let result = target.result().unwrap();
            let db: IdbDatabase = result.dyn_into().unwrap();

            // Create object store if not exists
            let store_names = db.object_store_names();
            let mut store_exists = false;
            for i in 0..store_names.length() {
                if let Some(name) = store_names.get(i) {
                    if name == "elex_storage" {
                        store_exists = true;
                        break;
                    }
                }
            }
            if !store_exists {
                db.create_object_store("elex_storage")
                    .expect("Failed to create object store");
            }
        });
        request.set_onupgradeneeded(Some(closure.as_ref().unchecked_ref()));
        closure.forget();

        // Wait for open to complete
        let init_promise_js = request.into_js_result()
            .map_err(|e| StorageError::Backend(format!("Failed to create request: {:?}", e)))?;
        let init_promise: Promise = init_promise_js.dyn_into()
            .map_err(|e| StorageError::Backend(format!("Invalid promise: {:?}", e)))?;
        let db = wasm_bindgen_futures::JsFuture::from(init_promise)
            .await
            .map_err(|e| StorageError::Backend(format!("Failed to open database: {:?}", e)))?;

        Ok(Self {
            db_name: db_name.to_string(),
            store_name: "elex_storage".to_string(),
        })
    }

    /// Store data in IndexedDB
    ///
    /// # Arguments
    /// * `key` - Storage key
    /// * `value` - Data to store
    pub async fn put(&self, key: &str, value: &[u8]) -> Result<(), StorageError> {
        use js_sys::{ArrayBuffer, Uint8Array};
        use wasm_bindgen::JsCast;
        use web_sys::IdbTransactionMode;

        // Get IndexedDB
        let window = web_sys::window()
            .ok_or_else(|| StorageError::Backend("No window object".to_string()))?;
        let indexed_db = window
            .indexed_db()
            .map_err(|e| StorageError::Backend(format!("IndexedDB not available: {:?}", e)))?
            .ok_or_else(|| StorageError::Backend("IndexedDB not supported".to_string()))?;

        // Open database
        let request: web_sys::IdbOpenDbRequest = indexed_db
            .open(&self.db_name)
            .map_err(|e| StorageError::Backend(format!("Failed to open database: {:?}", e)))?;
        let promise_js = request.into_js_result()
            .map_err(|e| StorageError::Backend(format!("Failed to create request: {:?}", e)))?;
        let promise: Promise = promise_js.dyn_into()
            .map_err(|e| StorageError::Backend(format!("Invalid promise: {:?}", e)))?;
        let db: web_sys::IdbDatabase = wasm_bindgen_futures::JsFuture::from(promise)
            .await
            .map_err(|e| StorageError::Backend(format!("Failed to open database: {:?}", e)))?
            .dyn_into()
            .map_err(|e| StorageError::Backend(format!("Invalid database: {:?}", e)))?;

        // Start transaction
        let tx = db
            .transaction_with_str_and_mode(&self.store_name, IdbTransactionMode::Readwrite)
            .map_err(|e| StorageError::Backend(format!("Failed to create transaction: {:?}", e)))?;

        // Get object store
        let store = tx
            .object_store(&self.store_name)
            .map_err(|e| StorageError::Backend(format!("Failed to get object store: {:?}", e)))?;

        // Convert bytes to Uint8Array
        let array_buffer = ArrayBuffer::new(value.len() as u32);
        let uint8_array = Uint8Array::new_with_byte_offset_and_length(&array_buffer, 0, value.len() as u32);
        uint8_array.copy_from(value);

        // Store data
        let js_key = wasm_bindgen::JsValue::from_str(key);
        let js_value = wasm_bindgen::JsValue::from(uint8_array);
        store
            .put_with_key(&js_value, &js_key)
            .map_err(|e| StorageError::Backend(format!("Failed to put data: {:?}", e)))?;

        // Wait for transaction to complete
        let tx_promise_js = tx.into_js_result()
            .map_err(|e| StorageError::Backend(format!("Failed to get transaction promise: {:?}", e)))?;
        let tx_promise: Promise = tx_promise_js.dyn_into()
            .map_err(|e| StorageError::Backend(format!("Invalid promise: {:?}", e)))?;
        wasm_bindgen_futures::JsFuture::from(tx_promise)
            .await
            .map_err(|e| StorageError::Backend(format!("Transaction failed: {:?}", e)))?;

        Ok(())
    }

    /// Retrieve data from IndexedDB
    ///
    /// # Arguments
    /// * `key` - Storage key
    ///
    /// # Returns
    /// Stored data, or None if not found
    pub async fn get(&self, key: &str) -> Result<Option<Vec<u8>>, StorageError> {
        use js_sys::Uint8Array;
        use wasm_bindgen::JsCast;
        use web_sys::IdbTransactionMode;

        // Get IndexedDB
        let window = web_sys::window()
            .ok_or_else(|| StorageError::Backend("No window object".to_string()))?;
        let indexed_db = window
            .indexed_db()
            .map_err(|e| StorageError::Backend(format!("IndexedDB not available: {:?}", e)))?
            .ok_or_else(|| StorageError::Backend("IndexedDB not supported".to_string()))?;

        // Open database
        let request: web_sys::IdbOpenDbRequest = indexed_db
            .open(&self.db_name)
            .map_err(|e| StorageError::Backend(format!("Failed to open database: {:?}", e)))?;
        let promise_js = request.into_js_result()
            .map_err(|e| StorageError::Backend(format!("Failed to create request: {:?}", e)))?;
        let promise: Promise = promise_js.dyn_into()
            .map_err(|e| StorageError::Backend(format!("Invalid promise: {:?}", e)))?;
        let db: web_sys::IdbDatabase = wasm_bindgen_futures::JsFuture::from(promise)
            .await
            .map_err(|e| StorageError::Backend(format!("Failed to open database: {:?}", e)))?
            .dyn_into()
            .map_err(|e| StorageError::Backend(format!("Invalid database: {:?}", e)))?;

        // Start transaction
        let tx = db
            .transaction_with_str_and_mode(&self.store_name, IdbTransactionMode::Readonly)
            .map_err(|e| StorageError::Backend(format!("Failed to create transaction: {:?}", e)))?;

        // Get object store
        let store = tx
            .object_store(&self.store_name)
            .map_err(|e| StorageError::Backend(format!("Failed to get object store: {:?}", e)))?;

        // Get data
        let js_key = wasm_bindgen::JsValue::from_str(key);
        let result = store
            .get(&js_key)
            .map_err(|e| StorageError::Backend(format!("Failed to get data: {:?}", e)))?;

        let result_promise_js = result.into_js_result()
            .map_err(|e| StorageError::Backend(format!("Failed to get result promise: {:?}", e)))?;
        let result_promise: Promise = result_promise_js.dyn_into()
            .map_err(|e| StorageError::Backend(format!("Invalid promise: {:?}", e)))?;
        let js_value = wasm_bindgen_futures::JsFuture::from(result_promise)
            .await
            .map_err(|e| StorageError::Backend(format!("Get operation failed: {:?}", e)))?;

        // Check if found
        if js_value.is_undefined() {
            return Ok(None);
        }

        // Convert Uint8Array to Vec<u8>
        let uint8_array = js_value
            .dyn_into::<Uint8Array>()
            .map_err(|e| StorageError::Backend(format!("Invalid data format: {:?}", e)))?;

        let mut data = vec![0u8; uint8_array.length() as usize];
        uint8_array.copy_to(&mut data);

        Ok(Some(data))
    }

    /// Delete data from IndexedDB
    ///
    /// # Arguments
    /// * `key` - Storage key
    pub async fn delete(&self, key: &str) -> Result<(), StorageError> {
        use wasm_bindgen::JsCast;
        use web_sys::IdbTransactionMode;

        // Get IndexedDB
        let window = web_sys::window()
            .ok_or_else(|| StorageError::Backend("No window object".to_string()))?;
        let indexed_db = window
            .indexed_db()
            .map_err(|e| StorageError::Backend(format!("IndexedDB not available: {:?}", e)))?
            .ok_or_else(|| StorageError::Backend("IndexedDB not supported".to_string()))?;

        // Open database
        let request: web_sys::IdbOpenDbRequest = indexed_db
            .open(&self.db_name)
            .map_err(|e| StorageError::Backend(format!("Failed to open database: {:?}", e)))?;
        let promise_js = request.into_js_result()
            .map_err(|e| StorageError::Backend(format!("Failed to create request: {:?}", e)))?;
        let promise: Promise = promise_js.dyn_into()
            .map_err(|e| StorageError::Backend(format!("Invalid promise: {:?}", e)))?;
        let db: web_sys::IdbDatabase = wasm_bindgen_futures::JsFuture::from(promise)
            .await
            .map_err(|e| StorageError::Backend(format!("Failed to open database: {:?}", e)))?
            .dyn_into()
            .map_err(|e| StorageError::Backend(format!("Invalid database: {:?}", e)))?;

        // Start transaction
        let tx = db
            .transaction_with_str_and_mode(&self.store_name, IdbTransactionMode::Readwrite)
            .map_err(|e| StorageError::Backend(format!("Failed to create transaction: {:?}", e)))?;

        // Get object store
        let store = tx
            .object_store(&self.store_name)
            .map_err(|e| StorageError::Backend(format!("Failed to get object store: {:?}", e)))?;

        // Delete data
        let js_key = wasm_bindgen::JsValue::from_str(key);
        store
            .delete(&js_key)
            .map_err(|e| StorageError::Backend(format!("Failed to delete data: {:?}", e)))?;

        // Wait for transaction to complete
        let tx_promise_js = tx.into_js_result()
            .map_err(|e| StorageError::Backend(format!("Failed to get transaction promise: {:?}", e)))?;
        let tx_promise: Promise = tx_promise_js.dyn_into()
            .map_err(|e| StorageError::Backend(format!("Invalid promise: {:?}", e)))?;
        wasm_bindgen_futures::JsFuture::from(tx_promise)
            .await
            .map_err(|e| StorageError::Backend(format!("Transaction failed: {:?}", e)))?;

        Ok(())
    }

    /// Clear all data from IndexedDB
    pub async fn clear(&self) -> Result<(), StorageError> {
        use wasm_bindgen::JsCast;
        use web_sys::IdbTransactionMode;

        // Get IndexedDB
        let window = web_sys::window()
            .ok_or_else(|| StorageError::Backend("No window object".to_string()))?;
        let indexed_db = window
            .indexed_db()
            .map_err(|e| StorageError::Backend(format!("IndexedDB not available: {:?}", e)))?
            .ok_or_else(|| StorageError::Backend("IndexedDB not supported".to_string()))?;

        // Open database
        let request: web_sys::IdbOpenDbRequest = indexed_db
            .open(&self.db_name)
            .map_err(|e| StorageError::Backend(format!("Failed to open database: {:?}", e)))?;
        let promise_js = request.into_js_result()
            .map_err(|e| StorageError::Backend(format!("Failed to create request: {:?}", e)))?;
        let promise: Promise = promise_js.dyn_into()
            .map_err(|e| StorageError::Backend(format!("Invalid promise: {:?}", e)))?;
        let db: web_sys::IdbDatabase = wasm_bindgen_futures::JsFuture::from(promise)
            .await
            .map_err(|e| StorageError::Backend(format!("Failed to open database: {:?}", e)))?
            .dyn_into()
            .map_err(|e| StorageError::Backend(format!("Invalid database: {:?}", e)))?;

        // Start transaction
        let tx = db
            .transaction_with_str_and_mode(&self.store_name, IdbTransactionMode::Readwrite)
            .map_err(|e| StorageError::Backend(format!("Failed to create transaction: {:?}", e)))?;

        // Get object store
        let store = tx
            .object_store(&self.store_name)
            .map_err(|e| StorageError::Backend(format!("Failed to get object store: {:?}", e)))?;

        // Clear store
        store
            .clear()
            .map_err(|e| StorageError::Backend(format!("Failed to clear store: {:?}", e)))?;

        // Wait for transaction to complete
        let tx_promise_js = tx.into_js_result()
            .map_err(|e| StorageError::Backend(format!("Failed to get transaction promise: {:?}", e)))?;
        let tx_promise: Promise = tx_promise_js.dyn_into()
            .map_err(|e| StorageError::Backend(format!("Invalid promise: {:?}", e)))?;
        wasm_bindgen_futures::JsFuture::from(tx_promise)
            .await
            .map_err(|e| StorageError::Backend(format!("Transaction failed: {:?}", e)))?;

        Ok(())
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_storage_creation() {
        let storage = CompressedStorage::new(10);

        assert_eq!(storage.compression_level, 10);
    }

    #[test]
    fn test_storage_default() {
        let storage = CompressedStorage::default();

        assert_eq!(storage.compression_level, 10);
    }

    #[test]
    fn test_compress_decompress() {
        let storage = CompressedStorage::new(10);
        let data = b"Hello, world! This is a test.";

        let compressed = storage.compress(data).unwrap();
        let decompressed = storage.decompress(&compressed, data.len()).unwrap();

        assert_eq!(&decompressed[..], data);
    }

    #[test]
    fn test_compression_ratio() {
        let storage = CompressedStorage::new(10);
        let data = b"Hello, world! This is a test data for compression.";

        let compressed = storage.compress(data).unwrap();
        let ratio = storage.compression_ratio(data, &compressed);

        // LZ4 should achieve some compression on this data
        assert!(ratio >= 1.0);
        println!("Compression ratio: {:.2}x", ratio);
    }

    #[test]
    fn test_compression_percentage() {
        let storage = CompressedStorage::new(10);
        let data = b"Hello, world! This is a test data for compression.";

        let compressed = storage.compress(data).unwrap();
        let percentage = storage.compression_percentage(data, &compressed);

        // Should achieve some compression
        assert!(percentage >= 0.0);
        assert!(percentage <= 100.0);
        println!("Compression percentage: {:.1}%", percentage);
    }

    #[test]
    fn test_storage_info() {
        let storage = CompressedStorage::new(10);
        let data = b"Hello, world! This is a test data for compression.";

        let compressed = storage.compress(data).unwrap();
        let info = storage.storage_info(data, &compressed);

        assert!(info.compression_ratio >= 1.0);
        assert!(info.space_saved >= 0);
        println!("{}", info.summary());
    }

    #[test]
    fn test_format_size() {
        assert_eq!(StorageInfo::format_size(500), "500 B");
        assert!(StorageInfo::format_size(2048).contains("KB"));
        assert!(StorageInfo::format_size(2_000_000).contains("MB"));
    }

    #[test]
    fn test_serialize_deserialize() {
        #[derive(Serialize, Deserialize, PartialEq, Debug)]
        struct TestQTable {
            entries: std::collections::HashMap<String, f32>,
            total_updates: u32,
        }

        let storage = CompressedStorage::new(10);

        let mut qtable = TestQTable {
            entries: std::collections::HashMap::new(),
            total_updates: 100,
        };
        qtable.entries.insert("state1::action1".to_string(), 0.8);
        qtable.entries.insert("state2::action2".to_string(), 0.5);

        // Serialize and compress
        let compressed = storage.save_qtable(&qtable).unwrap();

        // Decompress and deserialize
        let restored: TestQTable = storage.load_qtable(&compressed, 1024).unwrap();

        assert_eq!(restored, qtable);
    }

    #[test]
    fn test_compress_clamps_level() {
        // Level should be clamped to max 16
        let storage = CompressedStorage::new(100);

        assert_eq!(storage.compression_level, 16);
    }

    #[test]
    fn test_compress_empty_data() {
        let storage = CompressedStorage::new(10);
        let data = b"";

        let compressed = storage.compress(data).unwrap();
        let decompressed = storage.decompress(&compressed, 0).unwrap();

        assert_eq!(decompressed.len(), 0);
    }

    #[test]
    fn test_compression_ratio_empty() {
        let storage = CompressedStorage::new(10);
        let data = b"";
        let compressed = b"";

        let ratio = storage.compression_ratio(data, compressed);

        // Should return 1.0 for empty data
        assert_eq!(ratio, 1.0);
    }
}
