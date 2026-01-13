//! Port Forwarding Tauri Commands
//!
//! Provides Tauri commands for managing port forwarding from the frontend.

use std::collections::HashMap;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::sync::RwLock;
use tracing::{info, warn, error};

use crate::forwarding::{ForwardingManager, ForwardRule, ForwardRuleUpdate, ForwardStatus, ForwardType, ForwardStats};

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
    /// Check port availability before creating forward (default: true)
    #[serde(default = "default_check_health")]
    pub check_health: bool,
}

fn default_check_health() -> bool {
    true
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
        "dynamic" => ForwardType::Dynamic,
        _ => return Err(format!("Invalid forward type: {}", request.forward_type)),
    };

    // Perform health check if enabled (skip for dynamic forwards)
    if request.check_health && forward_type != ForwardType::Dynamic {
        info!("Checking port availability: {}:{}", request.target_host, request.target_port);
        
        match manager.check_port_available(&request.target_host, request.target_port, 3000).await {
            Ok(true) => {
                info!("Port {}:{} is available", request.target_host, request.target_port);
            }
            Ok(false) => {
                let error_msg = format!(
                    "Target port {}:{} is not reachable. Please ensure the service is running on the remote server.\n\nTroubleshooting:\n• Check if service is running: ss -tlnp | grep {}\n• Verify the port number is correct\n• Try connecting manually: nc -zv {} {}",
                    request.target_host, request.target_port, request.target_port, request.target_host, request.target_port
                );
                error!("Port health check failed: {}", error_msg);
                return Ok(ForwardResponse {
                    success: false,
                    forward: None,
                    error: Some(error_msg),
                });
            }
            Err(e) => {
                // Timeout or other network error
                let error_msg = format!(
                    "Failed to check port availability: {}\n\nThis might indicate:\n• Network connectivity issues\n• SSH connection problems\n• Port may be unreachable\n\nYou can skip this check with the 'Skip port availability check' option.",
                    e
                );
                error!("Health check error: {}", error_msg);
                return Ok(ForwardResponse {
                    success: false,
                    forward: None,
                    error: Some(error_msg),
                });
            }
        }
    }

    let rule = ForwardRule {
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

/// Quick forward for VS Code (convenience command)
#[tauri::command]
pub async fn forward_vscode(
    registry: State<'_, ForwardingRegistry>,
    session_id: String,
    local_port: u16,
    remote_port: u16,
) -> Result<ForwardResponse, String> {
    info!(
        "Creating VS Code forward for session {}: {} -> {}",
        session_id, local_port, remote_port
    );

    let manager = registry
        .get(&session_id)
        .await
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    match manager.forward_vscode(local_port, remote_port).await {
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

/// Request to update a forward's configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateForwardRequest {
    /// Session ID
    pub session_id: String,
    /// Forward ID to update
    pub forward_id: String,
    /// New bind address (optional)
    pub bind_address: Option<String>,
    /// New bind port (optional)
    pub bind_port: Option<u16>,
    /// New target host (optional)
    pub target_host: Option<String>,
    /// New target port (optional)
    pub target_port: Option<u16>,
    /// New description (optional)
    pub description: Option<String>,
}

/// Forward stats DTO for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForwardStatsDto {
    pub connection_count: u64,
    pub active_connections: u64,
    pub bytes_sent: u64,
    pub bytes_received: u64,
}

impl From<ForwardStats> for ForwardStatsDto {
    fn from(stats: ForwardStats) -> Self {
        Self {
            connection_count: stats.connection_count,
            active_connections: stats.active_connections,
            bytes_sent: stats.bytes_sent,
            bytes_received: stats.bytes_received,
        }
    }
}

/// Delete a port forward (permanently remove)
#[tauri::command]
pub async fn delete_port_forward(
    registry: State<'_, ForwardingRegistry>,
    session_id: String,
    forward_id: String,
) -> Result<ForwardResponse, String> {
    info!("Deleting port forward {} for session {}", forward_id, session_id);

    let manager = registry
        .get(&session_id)
        .await
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    match manager.delete_forward(&forward_id).await {
        Ok(()) => {
            info!("Port forward deleted: {}", forward_id);
            Ok(ForwardResponse {
                success: true,
                forward: None,
                error: None,
            })
        }
        Err(e) => {
            warn!("Failed to delete port forward: {}", e);
            Ok(ForwardResponse {
                success: false,
                forward: None,
                error: Some(e.to_string()),
            })
        }
    }
}

/// Restart a stopped port forward
#[tauri::command]
pub async fn restart_port_forward(
    registry: State<'_, ForwardingRegistry>,
    session_id: String,
    forward_id: String,
) -> Result<ForwardResponse, String> {
    info!("Restarting port forward {} for session {}", forward_id, session_id);

    let manager = registry
        .get(&session_id)
        .await
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    match manager.restart_forward(&forward_id).await {
        Ok(rule) => {
            info!("Port forward restarted: {}", rule.id);
            Ok(ForwardResponse {
                success: true,
                forward: Some(rule.into()),
                error: None,
            })
        }
        Err(e) => {
            warn!("Failed to restart port forward: {}", e);
            Ok(ForwardResponse {
                success: false,
                forward: None,
                error: Some(e.to_string()),
            })
        }
    }
}

/// Update a stopped port forward's configuration
#[tauri::command]
pub async fn update_port_forward(
    registry: State<'_, ForwardingRegistry>,
    request: UpdateForwardRequest,
) -> Result<ForwardResponse, String> {
    info!("Updating port forward {} for session {}", request.forward_id, request.session_id);

    let manager = registry
        .get(&request.session_id)
        .await
        .ok_or_else(|| format!("Session not found: {}", request.session_id))?;

    let updates = ForwardRuleUpdate {
        bind_address: request.bind_address,
        bind_port: request.bind_port,
        target_host: request.target_host,
        target_port: request.target_port,
        description: request.description,
    };

    match manager.update_forward(&request.forward_id, updates).await {
        Ok(rule) => {
            info!("Port forward updated: {}", rule.id);
            Ok(ForwardResponse {
                success: true,
                forward: Some(rule.into()),
                error: None,
            })
        }
        Err(e) => {
            warn!("Failed to update port forward: {}", e);
            Ok(ForwardResponse {
                success: false,
                forward: None,
                error: Some(e.to_string()),
            })
        }
    }
}

/// Get statistics for a port forward
#[tauri::command]
pub async fn get_port_forward_stats(
    registry: State<'_, ForwardingRegistry>,
    session_id: String,
    forward_id: String,
) -> Result<Option<ForwardStatsDto>, String> {
    let manager = registry
        .get(&session_id)
        .await
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    Ok(manager.get_forward_stats(&forward_id).await.map(|s| s.into()))
}
