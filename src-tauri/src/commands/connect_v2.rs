//! Connection Commands with Session Registry Integration
//!
//! These commands integrate with the global SessionRegistry for:
//! - State machine management
//! - Connection limiting
//! - Timeout handling
//! - Key authentication

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};
use tokio::time::timeout;
use tracing::{info, warn};

use super::ForwardingRegistry;
use crate::bridge::{BridgeManager, WsBridge};
use crate::forwarding::ForwardingManager;
use crate::session::{
    events::{event_names, SessionDisconnectedPayload},
    AuthMethod, KeyAuth, SessionConfig, SessionInfo, SessionRegistry, SessionStats,
};
use crate::sftp::session::SftpRegistry;
use crate::ssh::{AuthMethod as SshAuthMethod, SshClient, SshConfig, SshConnectionRegistry};

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
    /// WebSocket authentication token (sent as first message after connection)
    pub ws_token: String,
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
    pub proxy_chain: Option<Vec<ProxyChainRequest>>,
    #[serde(default)]
    pub buffer_config: Option<BufferConfigRequest>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct BufferConfigRequest {
    pub max_lines: usize,
    pub save_on_disconnect: bool,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(tag = "auth_type", rename_all = "snake_case")]
pub enum AuthRequest {
    Password {
        password: String,
    },
    Key {
        key_path: String,
        passphrase: Option<String>,
    },
    DefaultKey {
        passphrase: Option<String>,
    },
    Agent,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ProxyChainRequest {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth: AuthRequest,
}

fn default_cols() -> u32 {
    80
}
fn default_rows() -> u32 {
    24
}

/// Connect to SSH server (v2 with registry)
#[tauri::command]
pub async fn connect_v2(
    app_handle: AppHandle,
    request: ConnectRequest,
    registry: State<'_, Arc<SessionRegistry>>,
    forwarding_registry: State<'_, Arc<ForwardingRegistry>>,
    connection_registry: State<'_, Arc<SshConnectionRegistry>>,
) -> Result<ConnectResponseV2, String> {
    info!(
        "Connect request: {}@{}:{}",
        request.username, request.host, request.port
    );

    // === Branch: Proxy chain or direct connection ===
    let (session_id, ws_port, ws_token) = if let Some(proxy_chain_req) = request.proxy_chain {
        // === Multi-hop proxy connection ===
        info!("Using proxy chain with {} hops", proxy_chain_req.len());

        // Convert target auth
        let target_auth = match request.auth {
            AuthRequest::Password { password } => crate::ssh::AuthMethod::Password(password),
            AuthRequest::Key {
                key_path,
                passphrase,
            } => crate::ssh::AuthMethod::Key {
                key_path,
                passphrase,
            },
            AuthRequest::DefaultKey { passphrase } => {
                let key_auth = KeyAuth::from_default_locations(passphrase.as_deref())
                    .map_err(|e| format!("No SSH key found for target: {}", e))?;
                crate::ssh::AuthMethod::Key {
                    key_path: key_auth.key_path.to_string_lossy().to_string(),
                    passphrase,
                }
            }
            AuthRequest::Agent => {
                return Err("SSH Agent not yet supported".to_string());
            }
        };

        // Convert proxy requests to ProxyHop
        let mut chain = crate::ssh::ProxyChain::new();
        for hop_req in &proxy_chain_req {
            let hop_auth = match &hop_req.auth {
                AuthRequest::Password { password } => {
                    crate::ssh::AuthMethod::Password(password.clone())
                }
                AuthRequest::Key {
                    key_path,
                    passphrase,
                } => crate::ssh::AuthMethod::Key {
                    key_path: key_path.clone(),
                    passphrase: passphrase.clone(),
                },
                AuthRequest::DefaultKey { passphrase } => {
                    let key_auth = KeyAuth::from_default_locations(passphrase.as_deref())
                        .map_err(|e| format!("No SSH key found for proxy hop: {}", e))?;
                    crate::ssh::AuthMethod::Key {
                        key_path: key_auth.key_path.to_string_lossy().to_string(),
                        passphrase: passphrase.clone(),
                    }
                }
                AuthRequest::Agent => {
                    return Err("SSH Agent not yet supported".to_string());
                }
            };

            chain = chain.add_hop(crate::ssh::ProxyHop {
                host: hop_req.host.clone(),
                port: hop_req.port,
                username: hop_req.username.clone(),
                auth: hop_auth,
            });
        }

        // Establish multi-hop SSH connection
        let proxy_conn = crate::ssh::connect_via_proxy(
            &chain,
            &request.host,
            request.port,
            &request.username,
            &target_auth,
            HANDSHAKE_TIMEOUT_SECS,
        )
        .await
        .map_err(|e| format!("Proxy connection failed: {}", e))?;

        info!(
            "Multi-hop connection established: {} proxy handles",
            proxy_conn.jump_handles.len()
        );

        // Clone target_auth for later use in connection pool registration
        let target_auth_for_pool = target_auth.clone();

        // Create session config for target
        let config = SessionConfig {
            host: request.host.clone(),
            port: request.port,
            username: request.username.clone(),
            auth: match target_auth {
                crate::ssh::AuthMethod::Password(p) => AuthMethod::Password { password: p },
                crate::ssh::AuthMethod::Key {
                    key_path,
                    passphrase,
                } => AuthMethod::Key {
                    key_path,
                    passphrase,
                },
                crate::ssh::AuthMethod::Agent => AuthMethod::Agent,
            },
            name: request.name.clone(),
            color: None,
            cols: request.cols,
            rows: request.rows,
        };

        // Create session in registry (checks connection limit)
        let sid = if let Some(buf_cfg) = &request.buffer_config {
            registry
                .create_session_with_buffer(config, buf_cfg.max_lines)
                .map_err(|e| format!("Failed to create session: {}", e))?
        } else {
            registry
                .create_session(config)
                .map_err(|e| format!("Failed to create session: {}", e))?
        };

        // Start connecting
        if let Err(e) = registry.start_connecting(&sid) {
            registry.remove(&sid);
            return Err(format!("Failed to start connection: {}", e));
        }

        // Extract target handle for shell request
        // The jump handles are stored in ProxyConnection and will be dropped when appropriate
        let target_handle = proxy_conn.into_target_handle();
        info!("Multi-hop proxy connection ready for session: {}", sid);

        // The target_handle is a complete SSH session (handshake + auth done)
        // We can directly use it to request shell
        let session = crate::ssh::SshSession::new(target_handle, request.cols, request.rows);

        // Request shell with auth timeout
        let shell_future = session.request_shell_extended();

        let (session_handle, handle_controller) =
            timeout(Duration::from_secs(AUTH_TIMEOUT_SECS), shell_future)
                .await
                .map_err(|_| {
                    registry.remove(&sid);
                    format!("Authentication timeout after {}s", AUTH_TIMEOUT_SECS)
                })?
                .map_err(|e| {
                    registry.remove(&sid);
                    format!("Shell request failed: {}", e)
                })?;

        info!("Multi-hop proxy handles stored for session: {}", sid);

        // Get command sender for resize support
        let cmd_tx = session_handle.cmd_tx.clone();

        // Get scroll buffer for this session
        let scroll_buffer = registry
            .with_session(&sid, |entry| entry.scroll_buffer.clone())
            .ok_or_else(|| "Session not found in registry".to_string())?;

        // Start WebSocket bridge with disconnect tracking
        let (_, port, token, disconnect_rx) =
            WsBridge::start_extended_with_disconnect(session_handle, scroll_buffer)
                .await
                .map_err(|e| {
                    registry.remove(&sid);
                    format!("Failed to start WebSocket bridge: {}", e)
                })?;

        // Spawn task to handle disconnect and emit event
        let app_handle_clone = app_handle.clone();
        let sid_clone = sid.clone();
        let registry_clone = registry.inner().clone();
        tokio::spawn(async move {
            if let Ok(reason) = disconnect_rx.await {
                warn!("Session {} disconnected: {:?}", sid_clone, reason);
                // Update registry state
                let _ = registry_clone.disconnect_complete(&sid_clone, false);

                // Emit disconnect event to frontend
                let payload = SessionDisconnectedPayload {
                    session_id: sid_clone.clone(),
                    reason: reason.description(),
                    recoverable: reason.is_recoverable(),
                };
                let _ = app_handle_clone.emit(event_names::SESSION_DISCONNECTED, &payload);
            }
        });

        // Clone the handle controller for the forwarding manager
        let forwarding_controller = handle_controller.clone();
        // Clone for connection pool registration
        let pool_controller = handle_controller.clone();

        // Update registry with success
        registry
            .connect_success(&sid, port, cmd_tx, handle_controller)
            .map_err(|e| {
                registry.remove(&sid);
                format!("Failed to update session state: {}", e)
            })?;

        // Register ForwardingManager for port forwarding support
        let forwarding_manager = ForwardingManager::new(forwarding_controller, sid.to_string());
        forwarding_registry
            .register(sid.to_string(), forwarding_manager)
            .await;
        info!("ForwardingManager registered for session {}", sid);

        // Register to SSH connection pool for visibility in connection panel
        let pool_config = SessionConfig {
            host: request.host.clone(),
            port: request.port,
            username: request.username.clone(),
            auth: match target_auth_for_pool {
                crate::ssh::AuthMethod::Password(p) => AuthMethod::Password { password: p },
                crate::ssh::AuthMethod::Key { key_path, passphrase } => AuthMethod::Key {
                    key_path,
                    passphrase,
                },
                crate::ssh::AuthMethod::Agent => AuthMethod::Agent,
            },
            name: request.name.clone(),
            color: None,
            cols: request.cols,
            rows: request.rows,
        };
        connection_registry
            .register_existing(sid.clone(), pool_config, pool_controller, sid.clone())
            .await;
        info!("Connection registered to pool for session {}", sid);

        info!("Connection established: session={}, ws_port={}", sid, port);

        (sid, port, token)
    } else {
        // === Direct connection (existing behavior) ===
        // Convert auth request to session config
        let auth = match request.auth {
            AuthRequest::Password { password } => AuthMethod::Password { password },
            AuthRequest::Key {
                key_path,
                passphrase,
            } => AuthMethod::Key {
                key_path,
                passphrase,
            },
            AuthRequest::DefaultKey { passphrase } => {
                // Find default key
                let key_auth = KeyAuth::from_default_locations(passphrase.as_deref())
                    .map_err(|e| format!("No SSH key found: {}", e))?;
                AuthMethod::Key {
                    key_path: key_auth.key_path.to_string_lossy().to_string(),
                    passphrase,
                }
            }
            AuthRequest::Agent => {
                return Err("SSH Agent not yet supported".to_string());
            }
        };

        let config = SessionConfig {
            host: request.host.clone(),
            port: request.port,
            username: request.username.clone(),
            auth: auth.clone(),
            name: request.name.clone(),
            color: None,
            cols: request.cols,
            rows: request.rows,
        };

        // Create session in registry (checks connection limit)
        let sid = if let Some(buf_cfg) = &request.buffer_config {
            registry
                .create_session_with_buffer(config.clone(), buf_cfg.max_lines)
                .map_err(|e| format!("Failed to create session: {}", e))?
        } else {
            registry
                .create_session(config.clone())
                .map_err(|e| format!("Failed to create session: {}", e))?
        };

        // Start connecting
        if let Err(e) = registry.start_connecting(&sid) {
            registry.remove(&sid);
            return Err(format!("Failed to start connection: {}", e));
        }

        // Build SSH config
        let ssh_auth = match &auth {
            AuthMethod::Password { password } => SshAuthMethod::Password(password.clone()),
            AuthMethod::Key {
                key_path,
                passphrase,
            } => SshAuthMethod::Key {
                key_path: key_path.clone(),
                passphrase: passphrase.clone(),
            },
            AuthMethod::Agent => {
                registry.remove(&sid);
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
            proxy_chain: None,
            strict_host_key_checking: false, // Auto-accept unknown hosts
        };

        // Connect with handshake timeout
        let client = SshClient::new(ssh_config);
        let connect_future = client.connect();

        let session = timeout(Duration::from_secs(HANDSHAKE_TIMEOUT_SECS), connect_future)
            .await
            .map_err(|_| {
                registry.remove(&sid);
                format!("Connection timeout after {}s", HANDSHAKE_TIMEOUT_SECS)
            })?
            .map_err(|e| {
                registry.remove(&sid);
                format!("Connection failed: {}", e)
            })?;

        // Request shell with auth timeout
        // This will spawn the Handle Owner Task and return both the shell handle and controller
        let shell_future = session.request_shell_extended();

        let (session_handle, handle_controller) =
            timeout(Duration::from_secs(AUTH_TIMEOUT_SECS), shell_future)
                .await
                .map_err(|_| {
                    registry.remove(&sid);
                    format!("Authentication timeout after {}s", AUTH_TIMEOUT_SECS)
                })?
                .map_err(|e| {
                    registry.remove(&sid);
                    format!("Shell request failed: {}", e)
                })?;

        // Get command sender for resize support
        let cmd_tx = session_handle.cmd_tx.clone();

        // Get scroll buffer for this session
        let scroll_buffer = registry
            .with_session(&sid, |entry| entry.scroll_buffer.clone())
            .ok_or_else(|| "Session not found in registry".to_string())?;

        // Start WebSocket bridge with disconnect tracking
        let (_, port, token, disconnect_rx) =
            WsBridge::start_extended_with_disconnect(session_handle, scroll_buffer)
                .await
                .map_err(|e| {
                    registry.remove(&sid);
                    format!("Failed to start WebSocket bridge: {}", e)
                })?;

        // Spawn task to handle disconnect and emit event
        let app_handle_clone = app_handle.clone();
        let sid_clone = sid.clone();
        let registry_clone = registry.inner().clone();
        tokio::spawn(async move {
            if let Ok(reason) = disconnect_rx.await {
                warn!("Session {} disconnected: {:?}", sid_clone, reason);
                // Update registry state
                let _ = registry_clone.disconnect_complete(&sid_clone, false);

                // Emit disconnect event to frontend
                let payload = SessionDisconnectedPayload {
                    session_id: sid_clone.clone(),
                    reason: reason.description(),
                    recoverable: reason.is_recoverable(),
                };
                let _ = app_handle_clone.emit(event_names::SESSION_DISCONNECTED, &payload);
            }
        });

        // Clone the handle controller for the forwarding manager
        let forwarding_controller = handle_controller.clone();
        // Clone for connection pool registration
        let pool_controller = handle_controller.clone();

        // Update registry with success
        registry
            .connect_success(&sid, port, cmd_tx, handle_controller)
            .map_err(|e| {
                registry.remove(&sid);
                format!("Failed to update session state: {}", e)
            })?;

        // Register ForwardingManager for port forwarding support
        let forwarding_manager = ForwardingManager::new(forwarding_controller, sid.to_string());
        forwarding_registry
            .register(sid.to_string(), forwarding_manager)
            .await;
        info!("ForwardingManager registered for session {}", sid);

        // Register to SSH connection pool for visibility in connection panel
        connection_registry
            .register_existing(sid.clone(), config, pool_controller, sid.clone())
            .await;
        info!("Connection registered to pool for session {}", sid);

        info!("Connection established: session={}, ws_port={}", sid, port);

        (sid, port, token)
    };

    // Build response for both paths
    let ws_url = format!("ws://localhost:{}", ws_port);
    let session_info = registry
        .get(&session_id)
        .ok_or_else(|| "Session disappeared from registry".to_string())?;

    Ok(ConnectResponseV2 {
        session_id,
        ws_url,
        port: ws_port,
        session: session_info,
        ws_token,
    })
}

/// Disconnect a session (v2 with registry)
#[tauri::command]
pub async fn disconnect_v2(
    session_id: String,
    registry: State<'_, Arc<SessionRegistry>>,
    bridge_manager: State<'_, BridgeManager>,
    sftp_registry: State<'_, Arc<SftpRegistry>>,
    forwarding_registry: State<'_, Arc<ForwardingRegistry>>,
    connection_registry: State<'_, Arc<SshConnectionRegistry>>,
) -> Result<bool, String> {
    info!("Disconnecting session: {}", session_id);

    // Save terminal buffer before disconnecting
    if let Err(e) = registry.persist_session_with_buffer(&session_id).await {
        tracing::warn!("Failed to persist session buffer: {}", e);
        // Don't fail the disconnect if persistence fails
    }

    // Stop and remove all port forwards for this session
    forwarding_registry.remove(&session_id).await;

    // Close via registry (sends close command)
    registry.close_session(&session_id).await?;

    // Complete disconnection and remove
    let _ = registry.disconnect_complete(&session_id, true);

    // Also unregister from bridge manager
    bridge_manager.unregister(&session_id);

    // Drop any cached SFTP handle tied to this session
    sftp_registry.remove(&session_id);

    // Release connection from pool (using session_id as connection_id)
    // This will decrement ref_count and potentially start idle timer
    if let Err(e) = connection_registry.release(&session_id).await {
        warn!("Failed to release connection from pool: {}", e);
        // Not a fatal error - the connection might not have been in the pool
    } else {
        info!("Connection released from pool for session {}", session_id);
    }

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
    registry
        .get(&session_id)
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
    registry
        .reorder(&ordered_ids)
        .map_err(|e| format!("Failed to reorder: {}", e))
}

/// Check if default SSH keys are available
#[tauri::command]
pub async fn check_ssh_keys() -> Result<Vec<String>, String> {
    let keys = crate::session::auth::list_available_keys();
    Ok(keys
        .into_iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect())
}

/// Restore persisted sessions (returns session metadata for selective restoration)
#[tauri::command]
pub async fn restore_sessions(
    registry: State<'_, Arc<SessionRegistry>>,
) -> Result<Vec<PersistedSessionDto>, String> {
    let sessions = registry
        .restore_sessions()
        .map_err(|e| format!("Failed to restore sessions: {:?}", e))?;

    Ok(sessions
        .into_iter()
        .map(|s| PersistedSessionDto {
            id: s.id,
            host: s.config.host,
            port: s.config.port,
            username: s.config.username,
            name: s.config.name,
            created_at: s.created_at.to_rfc3339(),
            order: s.order,
        })
        .collect())
}

/// List persisted session IDs
#[tauri::command]
pub async fn list_persisted_sessions(
    registry: State<'_, Arc<SessionRegistry>>,
) -> Result<Vec<String>, String> {
    registry
        .list_persisted_sessions()
        .map_err(|e| format!("Failed to list persisted sessions: {:?}", e))
}

/// Delete a persisted session
#[tauri::command]
pub async fn delete_persisted_session(
    registry: State<'_, Arc<SessionRegistry>>,
    session_id: String,
) -> Result<(), String> {
    registry
        .delete_persisted_session(&session_id)
        .map_err(|e| format!("Failed to delete persisted session: {:?}", e))
}

/// DTO for persisted session info (without sensitive data)
#[derive(Debug, Serialize)]
pub struct PersistedSessionDto {
    pub id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub name: Option<String>,
    pub created_at: String,
    pub order: usize,
}
