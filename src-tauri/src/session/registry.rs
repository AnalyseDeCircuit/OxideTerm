//! Global Session Registry
//!
//! Thread-safe session management using DashMap for concurrent access.
//! Includes connection limiting and lifecycle management.

use dashmap::DashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{info, warn, debug};

use super::state::SessionState;
use super::types::{SessionConfig, SessionEntry, SessionInfo, SessionStats};
use crate::ssh::SessionCommand;

/// Default maximum concurrent sessions
const DEFAULT_MAX_SESSIONS: usize = 20;

/// Global session registry for managing all SSH sessions
pub struct SessionRegistry {
    /// Map of session ID to session entry
    sessions: DashMap<String, SessionEntry>,
    /// Counter for generating unique tab orders
    order_counter: AtomicUsize,
    /// Maximum allowed concurrent sessions
    max_sessions: AtomicUsize,
}

impl Default for SessionRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl SessionRegistry {
    /// Create a new session registry
    pub fn new() -> Self {
        Self {
            sessions: DashMap::new(),
            order_counter: AtomicUsize::new(0),
            max_sessions: AtomicUsize::new(DEFAULT_MAX_SESSIONS),
        }
    }

    /// Create a new session registry with custom max sessions
    pub fn with_max_sessions(max: usize) -> Self {
        Self {
            sessions: DashMap::new(),
            order_counter: AtomicUsize::new(0),
            max_sessions: AtomicUsize::new(max),
        }
    }

    /// Set maximum concurrent sessions
    pub fn set_max_sessions(&self, max: usize) {
        self.max_sessions.store(max, Ordering::SeqCst);
    }

    /// Get maximum concurrent sessions
    pub fn max_sessions(&self) -> usize {
        self.max_sessions.load(Ordering::SeqCst)
    }

    /// Create a new session (in Disconnected state)
    /// Returns session ID or error if limit reached
    pub fn create_session(&self, config: SessionConfig) -> Result<String, RegistryError> {
        // Check connection limit
        let active_count = self.active_count();
        let max = self.max_sessions();
        
        if active_count >= max {
            return Err(RegistryError::ConnectionLimitReached { current: active_count, max });
        }

        // Generate session ID
        let session_id = uuid::Uuid::new_v4().to_string();
        let order = self.order_counter.fetch_add(1, Ordering::SeqCst);

        info!(
            "Creating session {}: {}@{}:{} (order: {})",
            session_id, config.username, config.host, config.port, order
        );

        let entry = SessionEntry::new(session_id.clone(), config, order);
        self.sessions.insert(session_id.clone(), entry);

        Ok(session_id)
    }

    /// Start connecting a session
    pub fn start_connecting(&self, session_id: &str) -> Result<(), RegistryError> {
        let mut entry = self.sessions
            .get_mut(session_id)
            .ok_or_else(|| RegistryError::SessionNotFound(session_id.to_string()))?;

        entry.state_machine.start_connecting()
            .map_err(|e| RegistryError::StateTransition(e.to_string()))?;

        debug!("Session {} state -> Connecting", session_id);
        Ok(())
    }

    /// Mark session as connected
    pub fn connect_success(
        &self,
        session_id: &str,
        ws_port: u16,
        cmd_tx: mpsc::Sender<SessionCommand>,
    ) -> Result<(), RegistryError> {
        let mut entry = self.sessions
            .get_mut(session_id)
            .ok_or_else(|| RegistryError::SessionNotFound(session_id.to_string()))?;

        entry.state_machine.connect_success()
            .map_err(|e| RegistryError::StateTransition(e.to_string()))?;

        entry.ws_port = Some(ws_port);
        entry.cmd_tx = Some(cmd_tx);

        info!("Session {} connected on port {}", session_id, ws_port);
        Ok(())
    }

    /// Mark session as failed
    pub fn connect_failed(&self, session_id: &str, error: String) -> Result<(), RegistryError> {
        let mut entry = self.sessions
            .get_mut(session_id)
            .ok_or_else(|| RegistryError::SessionNotFound(session_id.to_string()))?;

        entry.state_machine.connect_failed(error.clone())
            .map_err(|e| RegistryError::StateTransition(e.to_string()))?;

        warn!("Session {} connection failed: {}", session_id, error);
        Ok(())
    }

    /// Start disconnecting a session
    pub fn start_disconnecting(&self, session_id: &str) -> Result<(), RegistryError> {
        let mut entry = self.sessions
            .get_mut(session_id)
            .ok_or_else(|| RegistryError::SessionNotFound(session_id.to_string()))?;

        entry.state_machine.start_disconnecting()
            .map_err(|e| RegistryError::StateTransition(e.to_string()))?;

        debug!("Session {} state -> Disconnecting", session_id);
        Ok(())
    }

    /// Complete disconnection and optionally remove session
    pub fn disconnect_complete(&self, session_id: &str, remove: bool) -> Result<(), RegistryError> {
        if remove {
            if let Some((_, mut entry)) = self.sessions.remove(session_id) {
                let _ = entry.state_machine.disconnect_complete();
                info!("Session {} disconnected and removed", session_id);
            }
        } else {
            let mut entry = self.sessions
                .get_mut(session_id)
                .ok_or_else(|| RegistryError::SessionNotFound(session_id.to_string()))?;

            entry.state_machine.disconnect_complete()
                .map_err(|e| RegistryError::StateTransition(e.to_string()))?;
            entry.ws_port = None;
            entry.cmd_tx = None;

            info!("Session {} disconnected", session_id);
        }
        Ok(())
    }

    /// Set session error state
    pub fn set_error(&self, session_id: &str, error: String) {
        if let Some(mut entry) = self.sessions.get_mut(session_id) {
            entry.state_machine.set_error(error);
        }
    }

    /// Remove a session
    pub fn remove(&self, session_id: &str) -> Option<SessionEntry> {
        self.sessions.remove(session_id).map(|(_, entry)| {
            info!("Session {} removed from registry", session_id);
            entry
        })
    }

    /// Get session info by ID
    pub fn get(&self, session_id: &str) -> Option<SessionInfo> {
        self.sessions.get(session_id).map(|entry| SessionInfo::from(entry.value()))
    }

    /// Get session config by ID (for reconnection)
    pub fn get_config(&self, session_id: &str) -> Option<SessionConfig> {
        self.sessions.get(session_id).map(|entry| entry.config.clone())
    }

    /// Get command sender for a session
    pub fn get_cmd_tx(&self, session_id: &str) -> Option<mpsc::Sender<SessionCommand>> {
        self.sessions.get(session_id).and_then(|entry| entry.cmd_tx.clone())
    }

    /// List all sessions
    pub fn list(&self) -> Vec<SessionInfo> {
        let mut sessions: Vec<_> = self.sessions
            .iter()
            .map(|entry| SessionInfo::from(entry.value()))
            .collect();
        
        // Sort by order (tab order)
        sessions.sort_by_key(|s| s.order);
        sessions
    }

    /// List sessions by state
    pub fn list_by_state(&self, state: SessionState) -> Vec<SessionInfo> {
        self.sessions
            .iter()
            .filter(|entry| entry.state() == state)
            .map(|entry| SessionInfo::from(entry.value()))
            .collect()
    }

    /// Get session count
    pub fn count(&self) -> usize {
        self.sessions.len()
    }

    /// Get count of active sessions (connecting or connected)
    pub fn active_count(&self) -> usize {
        self.sessions
            .iter()
            .filter(|entry| entry.state_machine.is_active())
            .count()
    }

    /// Get session statistics
    pub fn stats(&self) -> SessionStats {
        let mut connected = 0;
        let mut connecting = 0;
        let mut error = 0;

        for entry in self.sessions.iter() {
            match entry.state() {
                SessionState::Connected => connected += 1,
                SessionState::Connecting => connecting += 1,
                SessionState::Error => error += 1,
                _ => {}
            }
        }

        SessionStats {
            total: self.sessions.len(),
            connected,
            connecting,
            error,
            max_sessions: self.max_sessions(),
        }
    }

    /// Resize a session's PTY
    pub async fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let entry = self.sessions
            .get(session_id)
            .ok_or_else(|| format!("Session {} not found", session_id))?;

        entry.resize(cols, rows).await
    }

    /// Close a session
    pub async fn close_session(&self, session_id: &str) -> Result<(), String> {
        // First send close command
        if let Some(entry) = self.sessions.get(session_id) {
            entry.close().await?;
        }

        // Then update state
        let _ = self.start_disconnecting(session_id);
        Ok(())
    }

    /// Update tab order for a session
    pub fn update_order(&self, session_id: &str, new_order: usize) -> Result<(), RegistryError> {
        let mut entry = self.sessions
            .get_mut(session_id)
            .ok_or_else(|| RegistryError::SessionNotFound(session_id.to_string()))?;

        entry.order = new_order;
        Ok(())
    }

    /// Reorder sessions (for drag and drop)
    pub fn reorder(&self, ordered_ids: &[String]) -> Result<(), RegistryError> {
        for (index, id) in ordered_ids.iter().enumerate() {
            self.update_order(id, index)?;
        }
        Ok(())
    }

    /// Clean up disconnected/error sessions older than threshold
    pub fn cleanup_stale(&self, max_age_secs: u64) {
        let stale_ids: Vec<String> = self.sessions
            .iter()
            .filter(|entry| {
                entry.state_machine.is_terminal() 
                    && entry.state_machine.time_in_state().as_secs() > max_age_secs
            })
            .map(|entry| entry.id.clone())
            .collect();

        for id in stale_ids {
            self.remove(&id);
        }
    }
}

/// Registry error types
#[derive(Debug, Clone, thiserror::Error)]
pub enum RegistryError {
    #[error("Connection limit reached: {current}/{max} sessions active")]
    ConnectionLimitReached { current: usize, max: usize },

    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("State transition error: {0}")]
    StateTransition(String),
}

/// Create a shared session registry
pub fn create_shared_registry() -> Arc<SessionRegistry> {
    Arc::new(SessionRegistry::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_session() {
        let registry = SessionRegistry::new();
        let config = SessionConfig::with_password("example.com", 22, "user", "pass");
        
        let id = registry.create_session(config).unwrap();
        assert!(!id.is_empty());
        assert_eq!(registry.count(), 1);
    }

    #[test]
    fn test_connection_limit() {
        let registry = SessionRegistry::with_max_sessions(2);
        
        let config1 = SessionConfig::with_password("server1.com", 22, "user", "pass");
        let config2 = SessionConfig::with_password("server2.com", 22, "user", "pass");
        let config3 = SessionConfig::with_password("server3.com", 22, "user", "pass");
        
        let id1 = registry.create_session(config1).unwrap();
        registry.start_connecting(&id1).unwrap();
        
        let id2 = registry.create_session(config2).unwrap();
        registry.start_connecting(&id2).unwrap();
        
        // Third should fail
        let result = registry.create_session(config3);
        assert!(matches!(result, Err(RegistryError::ConnectionLimitReached { .. })));
    }

    #[test]
    fn test_state_transitions() {
        let registry = SessionRegistry::new();
        let config = SessionConfig::with_password("example.com", 22, "user", "pass");
        
        let id = registry.create_session(config).unwrap();
        
        // Initial state should be Disconnected
        let info = registry.get(&id).unwrap();
        assert_eq!(info.state, SessionState::Disconnected);
        
        // Transition to Connecting
        registry.start_connecting(&id).unwrap();
        let info = registry.get(&id).unwrap();
        assert_eq!(info.state, SessionState::Connecting);
    }
}
