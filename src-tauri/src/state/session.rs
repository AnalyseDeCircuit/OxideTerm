//! Session metadata persistence
//!
//! Handles serialization and deserialization of session metadata for recovery.

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::sync::Arc;

use crate::session::types::SessionConfig;
use super::store::{StateStore, StateError};

/// Persisted session metadata (excludes runtime data)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedSession {
    /// Unique session ID
    pub id: String,
    
    /// Session configuration
    pub config: SessionConfig,
    
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    
    /// Tab order for UI
    pub order: usize,
    
    /// Version for migration support
    #[serde(default)]
    pub version: u32,
}

impl PersistedSession {
    /// Create a new persisted session
    pub fn new(id: String, config: SessionConfig, order: usize) -> Self {
        Self {
            id,
            config,
            created_at: Utc::now(),
            order,
            version: 1,
        }
    }
    
    /// Serialize to bytes
    pub fn to_bytes(&self) -> Result<Vec<u8>, bincode::Error> {
        bincode::serialize(self)
    }
    
    /// Deserialize from bytes
    pub fn from_bytes(data: &[u8]) -> Result<Self, bincode::Error> {
        bincode::deserialize(data)
    }
}

/// Session persistence operations
pub struct SessionPersistence {
    store: Arc<StateStore>,
}

impl SessionPersistence {
    /// Create a new session persistence handler
    pub fn new(store: Arc<StateStore>) -> Self {
        Self { store }
    }
    
    /// Save a session
    pub fn save(&self, session: &PersistedSession) -> Result<(), StateError> {
        let data = session.to_bytes()
            .map_err(|e| StateError::Serialization(e))?;
        
        self.store.save_session(&session.id, &data)?;
        
        Ok(())
    }
    
    /// Load a session by ID
    pub fn load(&self, id: &str) -> Result<PersistedSession, StateError> {
        let data = self.store.load_session(id)?;
        
        PersistedSession::from_bytes(&data)
            .map_err(|e| StateError::Serialization(e))
    }
    
    /// Delete a session
    pub fn delete(&self, id: &str) -> Result<(), StateError> {
        self.store.delete_session(id)
    }
    
    /// Load all sessions
    pub fn load_all(&self) -> Result<Vec<PersistedSession>, StateError> {
        let ids = self.store.list_sessions()?;
        
        let mut sessions = Vec::new();
        for id in ids {
            match self.load(&id) {
                Ok(session) => sessions.push(session),
                Err(e) => {
                    tracing::warn!("Failed to load session {}: {:?}", id, e);
                    // Continue loading other sessions
                }
            }
        }
        
        // Sort by order
        sessions.sort_by_key(|s| s.order);
        
        Ok(sessions)
    }
    
    /// List all session IDs
    pub fn list_ids(&self) -> Result<Vec<String>, StateError> {
        self.store.list_sessions()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::path::PathBuf;
    use crate::session::types::{SessionConfig, AuthMethod};
    
    fn create_test_store() -> (TempDir, Arc<StateStore>) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.redb");
        let store = Arc::new(StateStore::new(db_path).unwrap());
        (temp_dir, store)
    }
    
    #[test]
    fn test_persisted_session_serialization() {
        let config = SessionConfig::with_password(
            "example.com",
            22,
            "user",
            "pass"
        );
        
        let session = PersistedSession::new(
            "session-1".to_string(),
            config,
            0
        );
        
        let bytes = session.to_bytes().unwrap();
        let deserialized = PersistedSession::from_bytes(&bytes).unwrap();
        
        assert_eq!(session.id, deserialized.id);
        assert_eq!(session.config.host, deserialized.config.host);
    }
    
    #[test]
    fn test_session_persistence() {
        let (_temp_dir, store) = create_test_store();
        let persistence = SessionPersistence::new(store);
        
        let config = SessionConfig::with_password(
            "example.com",
            22,
            "user",
            "pass"
        );
        
        let session = PersistedSession::new(
            "session-1".to_string(),
            config,
            0
        );
        
        // Save
        persistence.save(&session).unwrap();
        
        // Load
        let loaded = persistence.load("session-1").unwrap();
        assert_eq!(session.id, loaded.id);
        
        // Delete
        persistence.delete("session-1").unwrap();
        assert!(persistence.load("session-1").is_err());
    }
    
    #[test]
    fn test_load_all_sessions() {
        let (_temp_dir, store) = create_test_store();
        let persistence = SessionPersistence::new(store);
        
        // Create multiple sessions
        for i in 0..3 {
            let config = SessionConfig::with_password(
                format!("host{}.com", i),
                22,
                "user",
                "pass"
            );
            
            let session = PersistedSession::new(
                format!("session-{}", i),
                config,
                i
            );
            
            persistence.save(&session).unwrap();
        }
        
        // Load all
        let sessions = persistence.load_all().unwrap();
        assert_eq!(sessions.len(), 3);
        
        // Check ordering
        for (i, session) in sessions.iter().enumerate() {
            assert_eq!(session.order, i);
        }
    }
}
