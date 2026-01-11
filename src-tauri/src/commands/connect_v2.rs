//! Connection Commands with Session Registry Integration
//!
//! These commands integrate with the global SessionRegistry for:
//! - State machine management
//! - Connection limiting
//! - Timeout handling
//! - Key authentication

use std::sync::Arc;
use std::time::Duration;
use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::time::timeout;
use tracing::{info, warn, error};

use crate::session::{SessionRegistry, SessionConfig, AuthMethod, SessionInfo, SessionStats, KeyAuth};
use crate::ssh::{SshClient, SshConfig, AuthMethod as SshAuthMethod};
use crate::bridge::{WsBridge, BridgeManager};

/// Connection timeout settings
const HANDSHAKE_TIMEOUT_SECS: u64 = 30;
const AUTH_TIMEOUT_SECS: u64 = 60;

/// Response returned when a connection is established
#[derive(Debug, Serialize)]
pub struct ConnectResponseV2 {
    /// Session ID
    pub session_id: String,
    /// WebSocket URL to connect to
    pub ws_url: String,
    /// Port number
    pub port: u16,
    /// Session information
    pub session: SessionInfo,
}

/// Connect request from frontend
#[derive(Debug, Deserialize)]
pub struct ConnectRequest {
    pub host: String,
    pub port: u16,
    pub username: String,
    #[serde(flatten)]
    pub auth: AuthRequest,
    #[serde(default = "default_cols")]
    pub cols: u32,
    #[serde(default = "default_rows")]
    pub rows: u32,
    pub name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "auth_type", rename_all = "snake_case")]
pub enum AuthRequest {
    Password { password: String },
    Key { key_path: String, passphrase: Option<String> },
    DefaultKey { passphrase: Option<String> },
}

fn default_cols() -> u32 { 80 }
fn default_rows() -> u32 { 24 }

/// Connect to SSH server (v2 with registry)
#[tauri::command]
pub async fn connect_v2(
    request: ConnectRequest,
    registry: State<'_, Arc<SessionRegistry>>,
) -> Result<ConnectResponseV2, String> {
    info!("Connect request: {}@{}:{}", request.username, request.host, request.port);

    // Convert auth request to session config
    let auth = match request.auth {
        AuthRequest::Password { password } => AuthMethod::Password { password },
        AuthRequest::Key { key_path, passphrase } => AuthMethod::Key { key_path, passphrase },
        AuthRequest::DefaultKey { passphrase } => {
            // Find default key
            let key_auth = KeyAuth::from_default_locations(passphrase.as_deref())
                .map_err(|e| format!("No SSH key found: {}", e))?;
            AuthMethod::Key { 
                key_path: key_auth.key_path.to_string_lossy().to_string(),
                passphrase,
            }
        }
    };

    let config = SessionConfig {
        host: request.host,
        port: request.port,
        username: request.username,
        auth,
        name: request.name,
        color: None,
        cols: request.cols,
        rows: request.rows,
    };

    // Create session in registry (checks connection limit)
    let session_id = registry.create_session(config.clone())
        .map_err(|e| format!("Failed to create session: {}", e))?;

    // Start connecting
    if let Err(e) = registry.start_connecting(&session_id) {
        registry.remove(&session_id);
        return Err(format!("Failed to start connection: {}", e));
    }

    // Attempt connection with timeout
    let result = connect_with_timeout(
        &session_id,
        &config,
        registry.inner().clone(),
    ).await;

    match result {
        Ok(response) => Ok(response),
        Err(e) => {
            // Mark as failed in registry
            let _ = registry.connect_failed(&session_id, e.clone());
            Err(e)
        }
    }
}

/// Internal connection with timeout handling
async fn connect_with_timeout(
    session_id: &str,
    config: &SessionConfig,
    registry: Arc<SessionRegistry>,
) -> Result<ConnectResponseV2, String> {
    // Build SSH config
    let ssh_auth = match &config.auth {
        AuthMethod::Password { password } => SshAuthMethod::Password(password.clone()),
        AuthMethod::Key { key_path, passphrase } => SshAuthMethod::Key {
            key_path: key_path.clone(),
            passphrase: passphrase.clone(),
        },
        AuthMethod::Agent => {
            return Err("SSH Agent not yet supported".to_string());
        }
    };

    let ssh_config = SshConfig {
        host: config.host.clone(),
        port: config.port,
        username: config.username.clone(),
        auth: ssh_auth,
        timeout_secs: HANDSHAKE_TIMEOUT_SECS,
        cols: config.cols,
        rows: config.rows,
    };

    // Connect with handshake timeout
    let client = SshClient::new(ssh_config);
    let connect_future = client.connect();
    
    let session = timeout(
        Duration::from_secs(HANDSHAKE_TIMEOUT_SECS),
        connect_future
    )
    .await
    .map_err(|_| format!("Connection timeout after {}s", HANDSHAKE_TIMEOUT_SECS))?
    .map_err(|e| format!("Connection failed: {}", e))?;

    // Request shell with auth timeout
    let shell_future = session.request_shell_extended();
    
    let session_handle = timeout(
        Duration::from_secs(AUTH_TIMEOUT_SECS),
        shell_future
    )
    .await
    .map_err(|_| format!("Authentication timeout after {}s", AUTH_TIMEOUT_SECS))?
    .map_err(|e| format!("Shell request failed: {}", e))?;

    // Get command sender for resize support
    let cmd_tx = session_handle.cmd_tx.clone();

    // Start WebSocket bridge
    let (_, ws_port) = WsBridge::start_extended(session_handle)
        .await
        .map_err(|e| format!("Failed to start WebSocket bridge: {}", e))?;

    // Update registry with success
    registry.connect_success(session_id, ws_port, cmd_tx)
        .map_err(|e| format!("Failed to update session state: {}", e))?;

    let ws_url = format!("ws://localhost:{}", ws_port);
    let session_info = registry.get(session_id)
        .ok_or_else(|| "Session disappeared from registry".to_string())?;

    info!("Connection established: session={}, ws_url={}", session_id, ws_url);

    Ok(ConnectResponseV2 {
        session_id: session_id.to_string(),
        ws_url,
        port: ws_port,
        session: session_info,
    })
}

/// Disconnect a session (v2 with registry)
#[tauri::command]
pub async fn disconnect_v2(
    session_id: String,
    registry: State<'_, Arc<SessionRegistry>>,
    bridge_manager: State<'_, BridgeManager>,
) -> Result<bool, String> {
    info!("Disconnecting session: {}", session_id);

    // Close via registry (sends close command)
    registry.close_session(&session_id).await?;

    // Complete disconnection and remove
    let _ = registry.disconnect_complete(&session_id, true);

    // Also unregister from bridge manager
    bridge_manager.unregister(&session_id);

    Ok(true)
}

/// List all sessions (v2)
#[tauri::command]
pub async fn list_sessions_v2(
    registry: State<'_, Arc<SessionRegistry>>,
) -> Result<Vec<SessionInfo>, String> {
    Ok(registry.list())
}

/// Get session statistics
#[tauri::command]
pub async fn get_session_stats(
    registry: State<'_, Arc<SessionRegistry>>,
) -> Result<SessionStats, String> {
    Ok(registry.stats())
}

/// Get single session info
#[tauri::command]
pub async fn get_session(
    session_id: String,
    registry: State<'_, Arc<SessionRegistry>>,
) -> Result<SessionInfo, String> {
    registry.get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))
}

/// Resize session PTY (v2)
#[tauri::command]
pub async fn resize_session_v2(
    session_id: String,
    cols: u16,
    rows: u16,
    registry: State<'_, Arc<SessionRegistry>>,
) -> Result<(), String> {
    registry.resize(&session_id, cols, rows).await
}

/// Reorder sessions (for tab drag and drop)
#[tauri::command]
pub async fn reorder_sessions(
    ordered_ids: Vec<String>,
    registry: State<'_, Arc<SessionRegistry>>,
) -> Result<(), String> {
    registry.reorder(&ordered_ids)
        .map_err(|e| format!("Failed to reorder: {}", e))
}

/// Check if default SSH keys are available
#[tauri::command]
pub async fn check_ssh_keys() -> Result<Vec<String>, String> {
    let keys = crate::session::auth::list_available_keys();
    Ok(keys.into_iter().map(|p| p.to_string_lossy().to_string()).collect())
}
