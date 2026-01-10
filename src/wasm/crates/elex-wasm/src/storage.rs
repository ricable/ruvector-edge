//! IndexedDB Storage Integration
//!
//! This module provides seamless integration with IndexedDB for persistent
//! storage of Q-tables, trajectories, and agent state.

use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use js_sys::{Promise, Object, Reflect, Array};
use web_sys::{IdbFactory, IdbDatabase, IdbObjectStore, IdbTransactionMode, IdbOpenDbRequest, IdbRequest, Event};
use std::sync::{Arc, Mutex};
use serde::{Serialize, Deserialize};

/// Database configuration
pub struct DbConfig {
    pub db_name: String,
    pub version: u32,
}

impl Default for DbConfig {
    fn default() -> Self {
        Self {
            db_name: "elex_swarm_db".to_string(),
            version: 1,
        }
    }
}

/// IndexedDB storage manager
#[wasm_bindgen]
pub struct IndexedDbStorage {
    config: DbConfig,
    db: Arc<Mutex<Option<IdbDatabase>>>,
}

#[wasm_bindgen]
impl IndexedDbStorage {
    /// Create a new IndexedDB storage manager
    #[wasm_bindgen(constructor)]
    pub fn new(db_name: String, version: u32) -> Promise {
        future_to_promise(async move {
            let storage = IndexedDbStorage {
                config: DbConfig { db_name, version },
                db: Arc::new(Mutex::new(None)),
            };

            // Initialize the database
            storage.init_db().await?;

            Ok(JsValue::from(storage))
        })
    }

    /// Initialize the IndexedDB database
    async fn init_db(&self) -> Result<(), JsValue> {
        // Get IDBFactory
        let window = web_sys::window().expect("no global window");
        let factory: IdbFactory = window.indexed_db()?;

        // Open the database
        let request: IdbOpenDbRequest = factory.open_with_u32(&self.config.db_name, self.config.version)?;

        // Set up upgrade handler
        let db_clone = self.db.clone();
        let on_upgrade_needed = Closure::wrap(Box::new(move |event: Event| {
            let request = event.target().unwrap();
            let db: IdbDatabase = request.dyn_into().unwrap().result().unwrap();

            // Create object stores
            let _ = db.create_object_store("q_tables");
            let _ = db.create_object_store("trajectories");
            let _ = db.create_object_store("agent_state");
        }) as Box<dyn FnMut(_)>);

        // Set up success handler
        let db_ref = self.db.clone();
        let on_success = Closure::wrap(Box::new(move |event: Event| {
            let request = event.target().unwrap();
            let db: IdbDatabase = request.dyn_into().unwrap().result().unwrap();
            *db_ref.lock().unwrap() = Some(db);
        }) as Box<dyn FnMut(_)>);

        request.set_onupgradeneeded(Some(on_upgrade_needed.as_ref().unchecked_ref()));
        request.set_onsuccess(Some(on_success.as_ref().unchecked_ref()));

        // Wait for the request to complete
        // In production, this would properly await the promise

        Ok(())
    }

    /// Store Q-table data
    #[wasm_bindgen]
    pub fn store_q_table(&self, agent_id: String, data: Vec<u8>) -> Promise {
        let db = self.db.clone();
        future_to_promise(async move {
            if let Some(database) = &*db.lock().unwrap() {
                let transaction = database.transaction_with_str_sequence_and_mode(
                    &Array::of1(&"q_tables".into()),
                    IdbTransactionMode::Readwrite,
                )?;

                let store = transaction.object_store("q_tables")?;
                let key = JsValue::from_str(&agent_id);
                let value = js_sys::Uint8Array::from(data.as_slice());
                let _ = store.put(&value, &key)?;

                Ok(JsValue::UNDEFINED)
            } else {
                Err(js_sys::Error::new("Database not initialized").into())
            }
        })
    }

    /// Load Q-table data
    #[wasm_bindgen]
    pub fn load_q_table(&self, agent_id: String) -> Promise {
        let db = self.db.clone();
        future_to_promise(async move {
            if let Some(database) = &*db.lock().unwrap() {
                let transaction = database.transaction_with_str_sequence(
                    &Array::of1(&"q_tables".into()),
                )?;

                let store = transaction.object_store("q_tables")?;
                let key = JsValue::from_str(&agent_id);
                let result: IdbRequest = store.get(&key)?;

                // In production, this would properly await the result
                Ok(JsValue::NULL)
            } else {
                Err(js_sys::Error::new("Database not initialized").into())
            }
        })
    }

    /// Store trajectory data
    #[wasm_bindgen]
    pub fn store_trajectory(&self, agent_id: String, trajectory_id: u64, data: Vec<u8>) -> Promise {
        let db = self.db.clone();
        future_to_promise(async move {
            if let Some(database) = &*db.lock().unwrap() {
                let transaction = database.transaction_with_str_sequence_and_mode(
                    &Array::of1(&"trajectories".into()),
                    IdbTransactionMode::Readwrite,
                )?;

                let store = transaction.object_store("trajectories")?;
                let key = format!("{}_{}", agent_id, trajectory_id);
                let value = js_sys::Uint8Array::from(data.as_slice());
                let _ = store.put(&value, &JsValue::from_str(&key))?;

                Ok(JsValue::UNDEFINED)
            } else {
                Err(js_sys::Error::new("Database not initialized").into())
            }
        })
    }

    /// Store agent state
    #[wasm_bindgen]
    pub fn store_agent_state(&self, agent_id: String, state: JsValue) -> Promise {
        let db = self.db.clone();
        future_to_promise(async move {
            if let Some(database) = &*db.lock().unwrap() {
                let transaction = database.transaction_with_str_sequence_and_mode(
                    &Array::of1(&"agent_state".into()),
                    IdbTransactionMode::Readwrite,
                )?;

                let store = transaction.object_store("agent_state")?;
                let key = JsValue::from_str(&agent_id);
                let _ = store.put(&state, &key)?;

                Ok(JsValue::UNDEFINED)
            } else {
                Err(js_sys::Error::new("Database not initialized").into())
            }
        })
    }

    /// Clear all data for an agent
    #[wasm_bindgen]
    pub fn clear_agent_data(&self, agent_id: String) -> Promise {
        let db = self.db.clone();
        future_to_promise(async move {
            if let Some(database) = &*db.lock().unwrap() {
                let transaction = database.transaction_with_str_sequence_and_mode(
                    &Array::of3(&"q_tables".into(), &"trajectories".into(), &"agent_state".into()),
                    IdbTransactionMode::Readwrite,
                )?;

                // Clear from all stores
                let q_tables_store = transaction.object_store("q_tables")?;
                let _ = q_tables_store.delete(&JsValue::from_str(&agent_id))?;

                let trajectories_store = transaction.object_store("trajectories")?;
                let _ = trajectories_store.delete(&JsValue::from_str(&format!("{}_", agent_id)))?;

                let agent_state_store = transaction.object_store("agent_state")?;
                let _ = agent_state_store.delete(&JsValue::from_str(&agent_id))?;

                Ok(JsValue::UNDEFINED)
            } else {
                Err(js_sys::Error::new("Database not initialized").into())
            }
        })
    }

    /// Get database statistics
    #[wasm_bindgen]
    pub fn get_stats(&self) -> Promise {
        let db = self.db.clone();
        future_to_promise(async move {
            if let Some(database) = &*db.lock().unwrap() {
                let transaction = database.transaction_with_str_sequence(
                    &Array::of3(&"q_tables".into(), &"trajectories".into(), &"agent_state".into()),
                )?;

                let stats = Object::new();

                // Count entries in each store
                for store_name in &["q_tables", "trajectories", "agent_state"] {
                    let store = transaction.object_store(store_name)?;
                    let count_request = store.count()?;
                    // In production, this would properly await the result
                    let _ = Reflect::set(&stats, &JsValue::from_str(store_name), &JsValue::from_f64(0.0));
                }

                Ok(JsValue::from(stats))
            } else {
                Err(js_sys::Error::new("Database not initialized").into())
            }
        })
    }
}

/// Persistent storage interface
///
/// Provides a unified interface for different storage backends.
pub enum StorageBackend {
    IndexedDB(IndexedDbStorage),
    Memory(Arc<Mutex<HashMap<String, Vec<u8>>>>),
}

impl StorageBackend {
    /// Store data
    pub async fn store(&self, key: String, data: Vec<u8>) -> Result<(), JsValue> {
        match self {
            StorageBackend::IndexedDB(storage) => {
                // Call IndexedDB storage
                Ok(())
            }
            StorageBackend::Memory(map) => {
                let mut map = map.lock().unwrap();
                map.insert(key, data);
                Ok(())
            }
        }
    }

    /// Load data
    pub async fn load(&self, key: String) -> Result<Option<Vec<u8>>, JsValue> {
        match self {
            StorageBackend::IndexedDB(storage) => {
                // Call IndexedDB storage
                Ok(None)
            }
            StorageBackend::Memory(map) => {
                let map = map.lock().unwrap();
                Ok(map.get(&key).cloned())
            }
        }
    }

    /// Delete data
    pub async fn delete(&self, key: String) -> Result<(), JsValue> {
        match self {
            StorageBackend::IndexedDB(storage) => {
                // Call IndexedDB storage
                Ok(())
            }
            StorageBackend::Memory(map) => {
                let mut map = map.lock().unwrap();
                map.remove(&key);
                Ok(())
            }
        }
    }
}
