//! Port Forwarding Manager
//!
//! Centralized management for all port forwards in a session.
//! Provides lifecycle management, status tracking, and cleanup.

use std::collections::HashMap;
use std::sync::Arc;

use russh::client::Handle;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tracing::{info, warn, error};
use uuid::Uuid;

use super::local::{LocalForward, LocalForwardHandle, start_local_forward};
use super::remote::{RemoteForward, RemoteForwardHandle, start_remote_forward};
use crate::ssh::{ClientHandler, SshError};

/// Type of port forward
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ForwardType {
    /// Local port forwarding (-L)
    Local,
    /// Remote port forwarding (-R)  
    Remote,
    /// Dynamic SOCKS proxy (-D)
    Dynamic,
}

/// Status of a port forward
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ForwardStatus {
    /// Forward is starting
    Starting,
    /// Forward is active and running
    Active,
    /// Forward has stopped
    Stopped,
    /// Forward encountered an error
    Error,
}

/// Port forward rule configuration (for serialization)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForwardRule {
    /// Unique identifier
    pub id: String,
    /// Type of forward
    pub forward_type: ForwardType,
    /// Local address (for local forward) or remote bind address (for remote)
    pub bind_address: String,
    /// Bind port
    pub bind_port: u16,
    /// Target host
    pub target_host: String,
    /// Target port
    pub target_port: u16,
    /// Current status
    pub status: ForwardStatus,
    /// Description for UI
    pub description: Option<String>,
}

impl ForwardRule {
    /// Create a local forward rule
    pub fn local(bind_addr: impl Into<String>, bind_port: u16, target_host: impl Into<String>, target_port: u16) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            forward_type: ForwardType::Local,
            bind_address: bind_addr.into(),
            bind_port,
            target_host: target_host.into(),
            target_port,
            status: ForwardStatus::Starting,
            description: None,
        }
    }

    /// Create a remote forward rule
    pub fn remote(bind_addr: impl Into<String>, bind_port: u16, target_host: impl Into<String>, target_port: u16) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            forward_type: ForwardType::Remote,
            bind_address: bind_addr.into(),
            bind_port,
            target_host: target_host.into(),
            target_port,
            status: ForwardStatus::Starting,
            description: None,
        }
    }

    /// Set description
    pub fn with_description(mut self, desc: impl Into<String>) -> Self {
        self.description = Some(desc.into());
        self
    }

    /// Set custom ID
    pub fn with_id(mut self, id: impl Into<String>) -> Self {
        self.id = id.into();
        self
    }
}

/// Internal tracking for local forwards
struct LocalForwardEntry {
    rule: ForwardRule,
    handle: LocalForwardHandle,
}

/// Internal tracking for remote forwards
struct RemoteForwardEntry {
    rule: ForwardRule,
    handle: RemoteForwardHandle,
}

/// Port forwarding manager
/// 
/// Manages all port forwards for a session. Thread-safe and designed
/// for concurrent access from multiple Tauri commands.
pub struct ForwardingManager {
    /// SSH handle for creating new forwards (wrapped in Arc for cloning)
    ssh_handle: Arc<Handle<ClientHandler>>,
    /// Active local forwards
    local_forwards: RwLock<HashMap<String, LocalForwardEntry>>,
    /// Active remote forwards
    remote_forwards: RwLock<HashMap<String, RemoteForwardEntry>>,
    /// Session ID for correlation
    session_id: String,
}

impl ForwardingManager {
    /// Create a new forwarding manager
    pub fn new(ssh_handle: Handle<ClientHandler>, session_id: impl Into<String>) -> Self {
        Self {
            ssh_handle: Arc::new(ssh_handle),
            local_forwards: RwLock::new(HashMap::new()),
            remote_forwards: RwLock::new(HashMap::new()),
            session_id: session_id.into(),
        }
    }

    /// Create a new forwarding manager from an Arc<Handle>
    /// 
    /// This is useful when the handle is already wrapped in Arc (e.g., from SessionRegistry)
    pub fn new_from_arc(ssh_handle: Arc<Handle<ClientHandler>>, session_id: impl Into<String>) -> Self {
        Self {
            ssh_handle,
            local_forwards: RwLock::new(HashMap::new()),
            remote_forwards: RwLock::new(HashMap::new()),
            session_id: session_id.into(),
        }
    }

    /// Get session ID
    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    /// Create a local port forward
    pub async fn create_local_forward(&self, mut rule: ForwardRule) -> Result<ForwardRule, SshError> {
        if rule.forward_type != ForwardType::Local {
            return Err(SshError::ConnectionFailed("Invalid forward type".into()));
        }

        let config = LocalForward {
            local_addr: format!("{}:{}", rule.bind_address, rule.bind_port),
            remote_host: rule.target_host.clone(),
            remote_port: rule.target_port,
            description: rule.description.clone(),
        };

        info!(
            "Creating local forward {} -> {}:{}", 
            config.local_addr, config.remote_host, config.remote_port
        );

        let handle = start_local_forward(self.ssh_handle.clone(), config).await?;
        
        // Update rule with actual bound address
        rule.bind_address = handle.bound_addr.ip().to_string();
        rule.bind_port = handle.bound_addr.port();
        rule.status = ForwardStatus::Active;

        let entry = LocalForwardEntry {
            rule: rule.clone(),
            handle,
        };

        self.local_forwards.write().await.insert(rule.id.clone(), entry);

        info!("Local forward created: {}", rule.id);
        Ok(rule)
    }

    /// Create a remote port forward
    pub async fn create_remote_forward(&self, mut rule: ForwardRule) -> Result<ForwardRule, SshError> {
        if rule.forward_type != ForwardType::Remote {
            return Err(SshError::ConnectionFailed("Invalid forward type".into()));
        }

        let config = RemoteForward {
            remote_addr: rule.bind_address.clone(),
            remote_port: rule.bind_port,
            local_host: rule.target_host.clone(),
            local_port: rule.target_port,
            description: rule.description.clone(),
        };

        info!(
            "Creating remote forward {}:{} -> {}:{}",
            config.remote_addr, config.remote_port, config.local_host, config.local_port
        );

        let handle = start_remote_forward(self.ssh_handle.clone(), config).await?;
        rule.status = ForwardStatus::Active;

        let entry = RemoteForwardEntry {
            rule: rule.clone(),
            handle,
        };

        self.remote_forwards.write().await.insert(rule.id.clone(), entry);

        info!("Remote forward created: {}", rule.id);
        Ok(rule)
    }

    /// Create a forward (dispatches to appropriate type)
    pub async fn create_forward(&self, rule: ForwardRule) -> Result<ForwardRule, SshError> {
        match rule.forward_type {
            ForwardType::Local => self.create_local_forward(rule).await,
            ForwardType::Remote => self.create_remote_forward(rule).await,
            ForwardType::Dynamic => {
                Err(SshError::ConnectionFailed("Dynamic forwarding not yet implemented".into()))
            }
        }
    }

    /// Stop a forward by ID
    pub async fn stop_forward(&self, forward_id: &str) -> Result<(), SshError> {
        // Try local forwards first
        if let Some(entry) = self.local_forwards.write().await.remove(forward_id) {
            entry.handle.stop().await;
            info!("Stopped local forward: {}", forward_id);
            return Ok(());
        }

        // Try remote forwards
        if let Some(entry) = self.remote_forwards.write().await.remove(forward_id) {
            entry.handle.stop().await;
            info!("Stopped remote forward: {}", forward_id);
            return Ok(());
        }

        Err(SshError::ConnectionFailed(format!(
            "Forward not found: {}",
            forward_id
        )))
    }

    /// List all active forwards
    pub async fn list_forwards(&self) -> Vec<ForwardRule> {
        let mut forwards = Vec::new();

        // Add local forwards
        for entry in self.local_forwards.read().await.values() {
            let mut rule = entry.rule.clone();
            rule.status = if entry.handle.is_running() {
                ForwardStatus::Active
            } else {
                ForwardStatus::Stopped
            };
            forwards.push(rule);
        }

        // Add remote forwards
        for entry in self.remote_forwards.read().await.values() {
            let mut rule = entry.rule.clone();
            rule.status = if entry.handle.is_running() {
                ForwardStatus::Active
            } else {
                ForwardStatus::Stopped
            };
            forwards.push(rule);
        }

        forwards
    }

    /// Get a specific forward by ID
    pub async fn get_forward(&self, forward_id: &str) -> Option<ForwardRule> {
        if let Some(entry) = self.local_forwards.read().await.get(forward_id) {
            return Some(entry.rule.clone());
        }
        if let Some(entry) = self.remote_forwards.read().await.get(forward_id) {
            return Some(entry.rule.clone());
        }
        None
    }

    /// Stop all forwards
    pub async fn stop_all(&self) {
        info!("Stopping all forwards for session {}", self.session_id);

        // Stop local forwards
        let local_ids: Vec<String> = self.local_forwards.read().await.keys().cloned().collect();
        for id in local_ids {
            if let Some(entry) = self.local_forwards.write().await.remove(&id) {
                entry.handle.stop().await;
            }
        }

        // Stop remote forwards
        let remote_ids: Vec<String> = self.remote_forwards.read().await.keys().cloned().collect();
        for id in remote_ids {
            if let Some(entry) = self.remote_forwards.write().await.remove(&id) {
                entry.handle.stop().await;
            }
        }

        info!("All forwards stopped for session {}", self.session_id);
    }

    /// Count active forwards
    pub async fn count(&self) -> usize {
        self.local_forwards.read().await.len() + self.remote_forwards.read().await.len()
    }

    // === Quick shortcuts for common HPC use cases ===

    /// Create a Jupyter notebook forward (local 8888 -> remote 8888)
    pub async fn forward_jupyter(&self, local_port: u16, remote_port: u16) -> Result<ForwardRule, SshError> {
        let rule = ForwardRule::local("127.0.0.1", local_port, "localhost", remote_port)
            .with_description(format!("Jupyter Notebook ({})", remote_port));
        self.create_forward(rule).await
    }

    /// Create a TensorBoard forward (local 6006 -> remote 6006)
    pub async fn forward_tensorboard(&self, local_port: u16, remote_port: u16) -> Result<ForwardRule, SshError> {
        let rule = ForwardRule::local("127.0.0.1", local_port, "localhost", remote_port)
            .with_description(format!("TensorBoard ({})", remote_port));
        self.create_forward(rule).await
    }

    /// Create a VS Code Remote forward (for code-server)
    pub async fn forward_vscode(&self, local_port: u16, remote_port: u16) -> Result<ForwardRule, SshError> {
        let rule = ForwardRule::local("127.0.0.1", local_port, "localhost", remote_port)
            .with_description(format!("VS Code Server ({})", remote_port));
        self.create_forward(rule).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_forward_rule_local() {
        let rule = ForwardRule::local("127.0.0.1", 8888, "localhost", 8888);
        assert_eq!(rule.forward_type, ForwardType::Local);
        assert_eq!(rule.bind_port, 8888);
        assert_eq!(rule.target_port, 8888);
        assert_eq!(rule.status, ForwardStatus::Starting);
    }

    #[test]
    fn test_forward_rule_remote() {
        let rule = ForwardRule::remote("0.0.0.0", 9000, "localhost", 3000)
            .with_description("API Server");
        assert_eq!(rule.forward_type, ForwardType::Remote);
        assert!(rule.description.unwrap().contains("API"));
    }

    #[test]
    fn test_forward_rule_custom_id() {
        let rule = ForwardRule::local("127.0.0.1", 8888, "localhost", 8888)
            .with_id("my-jupyter");
        assert_eq!(rule.id, "my-jupyter");
    }
}
