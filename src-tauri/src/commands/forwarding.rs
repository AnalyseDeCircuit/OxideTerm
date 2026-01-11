//! Port Forwarding Tauri Commands
//!
//! Provides Tauri commands for managing port forwarding from the frontend.

use std::collections::HashMap;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::sync::RwLock;
use tracing::{info, warn, error};

use crate::forwarding::{ForwardingManager, ForwardRule, ForwardStatus, ForwardType};
use crate::ssh::SshError;

/// Global registry of forwarding managers (one per session)
pub struct ForwardingRegistry {
    managers: RwLock<HashMap<String, Arc<ForwardingManager>>>,
}

impl ForwardingRegistry {
    /// Create a new forwarding registry
    pub fn new() -> Self {
        Self {
            managers: RwLock::new(HashMap::new()),
        }
    }

    /// Register a forwarding manager for a session
    pub async fn register(&self, session_id: String, manager: ForwardingManager) {
        self.managers.write().await.insert(session_id, Arc::new(manager));
    }

    /// Get a forwarding manager by session ID
    pub async fn get(&self, session_id: &str) -> Option<Arc<ForwardingManager>> {
        self.managers.read().await.get(session_id).cloned()
    }

    /// Remove and stop all forwards for a session
    pub async fn remove(&self, session_id: &str) {
        if let Some(manager) = self.managers.write().await.remove(session_id) {
            manager.stop_all().await;
        }
    }
}

impl Default for ForwardingRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Request to create a port forward
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateForwardRequest {
    /// Session ID to create forward for
    pub session_id: String,
    /// Type of forward: "local" or "remote"
    pub forward_type: String,
    /// Bind address (local address for local forward, remote bind for remote)
    pub bind_address: String,
    /// Bind port
    pub bind_port: u16,
    /// Target host
    pub target_host: String,
    /// Target port
    pub target_port: u16,
    /// Optional description
    pub description: Option<String>,
}

/// Response for forward operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForwardResponse {
    /// Whether the operation succeeded
    pub success: bool,
    /// Forward rule (if successful)
    pub forward: Option<ForwardRuleDto>,
    /// Error message (if failed)
    pub error: Option<String>,
}

/// Forward rule DTO for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForwardRuleDto {
    pub id: String,
    pub forward_type: String,
    pub bind_address: String,
    pub bind_port: u16,
    pub target_host: String,
    pub target_port: u16,
    pub status: String,
    pub description: Option<String>,
}

impl From<ForwardRule> for ForwardRuleDto {
    fn from(rule: ForwardRule) -> Self {
        Self {
            id: rule.id,
            forward_type: match rule.forward_type {
                ForwardType::Local => "local".to_string(),
                ForwardType::Remote => "remote".to_string(),
                ForwardType::Dynamic => "dynamic".to_string(),
            },
            bind_address: rule.bind_address,
            bind_port: rule.bind_port,
            target_host: rule.target_host,
            target_port: rule.target_port,
            status: match rule.status {
                ForwardStatus::Starting => "starting".to_string(),
                ForwardStatus::Active => "active".to_string(),
                ForwardStatus::Stopped => "stopped".to_string(),
                ForwardStatus::Error => "error".to_string(),
            },
            description: rule.description,
        }
    }
}

/// Create a new port forward
#[tauri::command]
pub async fn create_port_forward(
    registry: State<'_, ForwardingRegistry>,
    request: CreateForwardRequest,
) -> Result<ForwardResponse, String> {
    info!("Creating port forward for session {}: {:?}", request.session_id, request);

    let manager = registry
        .get(&request.session_id)
        .await
        .ok_or_else(|| format!("Session not found: {}", request.session_id))?;

    let forward_type = match request.forward_type.as_str() {
        "local" => ForwardType::Local,
        "remote" => ForwardType::Remote,
        _ => return Err(format!("Invalid forward type: {}", request.forward_type)),
    };

    let mut rule = ForwardRule {
        id: uuid::Uuid::new_v4().to_string(),
        forward_type,
        bind_address: request.bind_address,
        bind_port: request.bind_port,
        target_host: request.target_host,
        target_port: request.target_port,
        status: ForwardStatus::Starting,
        description: request.description,
    };

    match manager.create_forward(rule).await {
        Ok(created_rule) => {
            info!("Port forward created: {}", created_rule.id);
            Ok(ForwardResponse {
                success: true,
                forward: Some(created_rule.into()),
                error: None,
            })
        }
        Err(e) => {
            error!("Failed to create port forward: {}", e);
            Ok(ForwardResponse {
                success: false,
                forward: None,
                error: Some(e.to_string()),
            })
        }
    }
}

/// Stop a port forward
#[tauri::command]
pub async fn stop_port_forward(
    registry: State<'_, ForwardingRegistry>,
    session_id: String,
    forward_id: String,
) -> Result<ForwardResponse, String> {
    info!("Stopping port forward {} for session {}", forward_id, session_id);

    let manager = registry
        .get(&session_id)
        .await
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    match manager.stop_forward(&forward_id).await {
        Ok(()) => {
            info!("Port forward stopped: {}", forward_id);
            Ok(ForwardResponse {
                success: true,
                forward: None,
                error: None,
            })
        }
        Err(e) => {
            warn!("Failed to stop port forward: {}", e);
            Ok(ForwardResponse {
                success: false,
                forward: None,
                error: Some(e.to_string()),
            })
        }
    }
}

/// List all port forwards for a session
#[tauri::command]
pub async fn list_port_forwards(
    registry: State<'_, ForwardingRegistry>,
    session_id: String,
) -> Result<Vec<ForwardRuleDto>, String> {
    let manager = registry
        .get(&session_id)
        .await
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let forwards = manager.list_forwards().await;
    Ok(forwards.into_iter().map(|r| r.into()).collect())
}

/// Quick forward for Jupyter (convenience command)
#[tauri::command]
pub async fn forward_jupyter(
    registry: State<'_, ForwardingRegistry>,
    session_id: String,
    local_port: u16,
    remote_port: u16,
) -> Result<ForwardResponse, String> {
    info!(
        "Creating Jupyter forward for session {}: {} -> {}",
        session_id, local_port, remote_port
    );

    let manager = registry
        .get(&session_id)
        .await
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    match manager.forward_jupyter(local_port, remote_port).await {
        Ok(rule) => Ok(ForwardResponse {
            success: true,
            forward: Some(rule.into()),
            error: None,
        }),
        Err(e) => Ok(ForwardResponse {
            success: false,
            forward: None,
            error: Some(e.to_string()),
        }),
    }
}

/// Quick forward for TensorBoard (convenience command)
#[tauri::command]
pub async fn forward_tensorboard(
    registry: State<'_, ForwardingRegistry>,
    session_id: String,
    local_port: u16,
    remote_port: u16,
) -> Result<ForwardResponse, String> {
    info!(
        "Creating TensorBoard forward for session {}: {} -> {}",
        session_id, local_port, remote_port
    );

    let manager = registry
        .get(&session_id)
        .await
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    match manager.forward_tensorboard(local_port, remote_port).await {
        Ok(rule) => Ok(ForwardResponse {
            success: true,
            forward: Some(rule.into()),
            error: None,
        }),
        Err(e) => Ok(ForwardResponse {
            success: false,
            forward: None,
            error: Some(e.to_string()),
        }),
    }
}

/// Stop all forwards for a session
#[tauri::command]
pub async fn stop_all_forwards(
    registry: State<'_, ForwardingRegistry>,
    session_id: String,
) -> Result<(), String> {
    info!("Stopping all port forwards for session {}", session_id);

    if let Some(manager) = registry.get(&session_id).await {
        manager.stop_all().await;
    }

    Ok(())
}
