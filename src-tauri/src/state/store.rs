//! Core StateStore implementation using redb
//! 
//! Provides high-performance embedded database for session and forward state persistence.

use redb::{Database, ReadableTable, TableDefinition};
use std::path::PathBuf;
use std::sync::Arc;
use thiserror::Error;
use tracing::{info, warn, error};

/// State version for migrations
pub const STATE_VERSION: u32 = 1;

/// Table definitions
const SESSIONS_TABLE: TableDefinition<&str, &[u8]> = TableDefinition::new("sessions");
const FORWARDS_TABLE: TableDefinition<&str, &[u8]> = TableDefinition::new("forwards");
const METADATA_TABLE: TableDefinition<&str, &[u8]> = TableDefinition::new("metadata");

/// State persistence errors
#[derive(Debug, Error)]
pub enum StateError {
    #[error("Database error: {0}")]
    Database(#[from] redb::DatabaseError),
    
    #[error("Transaction error: {0}")]
    Transaction(#[from] redb::TransactionError),
    
    #[error("Table error: {0}")]
    Table(#[from] redb::TableError),
    
    #[error("Storage error: {0}")]
    Storage(#[from] redb::StorageError),
    
    #[error("Commit error: {0}")]
    Commit(#[from] redb::CommitError),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] bincode::Error),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Item not found: {0}")]
    NotFound(String),
    
    #[error("Version mismatch: found {found}, expected {expected}")]
    VersionMismatch { found: u32, expected: u32 },
}

/// High-performance state store using redb
pub struct StateStore {
    db: Arc<Database>,
}

impl StateStore {
    /// Create a new state store at the given path
    pub fn new(path: PathBuf) -> Result<Self, StateError> {
        // Try to open existing database
        let db = match Database::create(&path) {
            Ok(db) => {
                info!("State database opened at {:?}", path);
                db
            }
            Err(e) => {
                warn!("Failed to open state database: {:?}, attempting recovery", e);
                
                // Backup corrupted file
                let backup_path = path.with_extension("redb.backup");
                if let Err(e) = std::fs::rename(&path, &backup_path) {
                    error!("Failed to backup corrupted database: {:?}", e);
                } else {
                    info!("Backed up corrupted database to {:?}", backup_path);
                }
                
                // Create new database
                Database::create(&path)?
            }
        };
        
        let store = Self {
            db: Arc::new(db),
        };
        
        // Initialize tables and metadata
        store.initialize()?;
        
        Ok(store)
    }
    
    /// Initialize database tables and metadata
    fn initialize(&self) -> Result<(), StateError> {
        let write_txn = self.db.begin_write()?;
        
        {
            // Create tables if they don't exist
            let _ = write_txn.open_table(SESSIONS_TABLE)?;
            let _ = write_txn.open_table(FORWARDS_TABLE)?;
            let _ = write_txn.open_table(METADATA_TABLE)?;
        }
        
        write_txn.commit()?;
        
        // Check/set version
        self.check_version()?;
        
        info!("State store initialized successfully");
        Ok(())
    }
    
    /// Check and set database version
    fn check_version(&self) -> Result<(), StateError> {
        let write_txn = self.db.begin_write()?;
        
        {
            let mut table = write_txn.open_table(METADATA_TABLE)?;
            
            let current_version = if let Some(version_bytes) = table.get("version")? {
                let version: u32 = bincode::deserialize(version_bytes.value())?;
                
                if version > STATE_VERSION {
                    return Err(StateError::VersionMismatch {
                        found: version,
                        expected: STATE_VERSION,
                    });
                }
                
                if version < STATE_VERSION {
                    info!("Migrating state database from v{} to v{}", version, STATE_VERSION);
                    // TODO: Add migration logic here if needed
                }
                Some(version)
            } else {
                None
            };
            
            if current_version.is_none() {
                // First time initialization
                let version_bytes = bincode::serialize(&STATE_VERSION)?;
                table.insert("version", version_bytes.as_slice())?;
                info!("Initialized state database version: {}", STATE_VERSION);
            }
        }
        
        write_txn.commit()?;
        Ok(())
    }
    
    /// Save a session to the database
    pub fn save_session(&self, id: &str, data: &[u8]) -> Result<(), StateError> {
        let write_txn = self.db.begin_write()?;
        
        {
            let mut table = write_txn.open_table(SESSIONS_TABLE)?;
            table.insert(id, data)?;
        }
        
        write_txn.commit()?;
        Ok(())
    }
    
    /// Load a session from the database
    pub fn load_session(&self, id: &str) -> Result<Vec<u8>, StateError> {
        let read_txn = self.db.begin_read()?;
        let table = read_txn.open_table(SESSIONS_TABLE)?;
        
        if let Some(value) = table.get(id)? {
            Ok(value.value().to_vec())
        } else {
            Err(StateError::NotFound(format!("Session not found: {}", id)))
        }
    }
    
    /// Delete a session from the database
    pub fn delete_session(&self, id: &str) -> Result<(), StateError> {
        let write_txn = self.db.begin_write()?;
        
        {
            let mut table = write_txn.open_table(SESSIONS_TABLE)?;
            table.remove(id)?;
        }
        
        write_txn.commit()?;
        Ok(())
    }
    
    /// List all session IDs
    pub fn list_sessions(&self) -> Result<Vec<String>, StateError> {
        let read_txn = self.db.begin_read()?;
        let table = read_txn.open_table(SESSIONS_TABLE)?;
        
        let mut ids = Vec::new();
        for item in table.iter()? {
            let (key, _) = item?;
            ids.push(key.value().to_string());
        }
        
        Ok(ids)
    }
    
    /// Save a forward rule to the database
    pub fn save_forward(&self, id: &str, data: &[u8]) -> Result<(), StateError> {
        let write_txn = self.db.begin_write()?;
        
        {
            let mut table = write_txn.open_table(FORWARDS_TABLE)?;
            table.insert(id, data)?;
        }
        
        write_txn.commit()?;
        Ok(())
    }
    
    /// Load a forward rule from the database
    pub fn load_forward(&self, id: &str) -> Result<Vec<u8>, StateError> {
        let read_txn = self.db.begin_read()?;
        let table = read_txn.open_table(FORWARDS_TABLE)?;
        
        if let Some(value) = table.get(id)? {
            Ok(value.value().to_vec())
        } else {
            Err(StateError::NotFound(format!("Forward not found: {}", id)))
        }
    }
    
    /// Delete a forward rule from the database
    pub fn delete_forward(&self, id: &str) -> Result<(), StateError> {
        let write_txn = self.db.begin_write()?;
        
        {
            let mut table = write_txn.open_table(FORWARDS_TABLE)?;
            table.remove(id)?;
        }
        
        write_txn.commit()?;
        Ok(())
    }
    
    /// List all forward IDs
    pub fn list_forwards(&self) -> Result<Vec<String>, StateError> {
        let read_txn = self.db.begin_read()?;
        let table = read_txn.open_table(FORWARDS_TABLE)?;
        
        let mut ids = Vec::new();
        for item in table.iter()? {
            let (key, _) = item?;
            ids.push(key.value().to_string());
        }
        
        Ok(ids)
    }
    
    /// Get statistics about the database
    pub fn stats(&self) -> Result<StateStats, StateError> {
        let read_txn = self.db.begin_read()?;
        
        let sessions_table = read_txn.open_table(SESSIONS_TABLE)?;
        let forwards_table = read_txn.open_table(FORWARDS_TABLE)?;
        
        let mut session_count = 0;
        for _ in sessions_table.iter()? {
            session_count += 1;
        }
        
        let mut forward_count = 0;
        for _ in forwards_table.iter()? {
            forward_count += 1;
        }
        
        Ok(StateStats {
            session_count,
            forward_count,
        })
    }
}

/// Database statistics
#[derive(Debug, Clone)]
pub struct StateStats {
    pub session_count: usize,
    pub forward_count: usize,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[test]
    fn test_store_creation() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.redb");
        
        let store = StateStore::new(db_path).unwrap();
        let stats = store.stats().unwrap();
        
        assert_eq!(stats.session_count, 0);
        assert_eq!(stats.forward_count, 0);
    }
    
    #[test]
    fn test_session_crud() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.redb");
        let store = StateStore::new(db_path).unwrap();
        
        // Create
        let data = b"test session data";
        store.save_session("session1", data).unwrap();
        
        // Read
        let loaded = store.load_session("session1").unwrap();
        assert_eq!(loaded, data);
        
        // List
        let ids = store.list_sessions().unwrap();
        assert_eq!(ids.len(), 1);
        assert_eq!(ids[0], "session1");
        
        // Delete
        store.delete_session("session1").unwrap();
        assert!(store.load_session("session1").is_err());
    }
    
    #[test]
    fn test_forward_crud() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.redb");
        let store = StateStore::new(db_path).unwrap();
        
        // Create
        let data = b"test forward data";
        store.save_forward("forward1", data).unwrap();
        
        // Read
        let loaded = store.load_forward("forward1").unwrap();
        assert_eq!(loaded, data);
        
        // List
        let ids = store.list_forwards().unwrap();
        assert_eq!(ids.len(), 1);
        assert_eq!(ids[0], "forward1");
        
        // Delete
        store.delete_forward("forward1").unwrap();
        assert!(store.load_forward("forward1").is_err());
    }
}
