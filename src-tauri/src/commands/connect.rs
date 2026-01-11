//! SSH Connection commands

use serde::Serialize;
use tauri::State;
use tracing::info;

use crate::ssh::{SshClient, SshConfig, AuthMethod};
use crate::bridge::{WsBridge, BridgeManager};

/// Response returned when a connection is established
#[derive(Debug, Serialize)]
pub struct ConnectResponse {
    /// Session ID
    pub session_id: String,
    /// WebSocket URL to connect to
    pub ws_url: String,
    /// Port number
    pub port: u16,
}

/// Connect to an SSH server
#[tauri::command]
pub async fn ssh_connect(
    host: String,
    port: u16,
    username: String,
    password: String,
    cols: u32,
    rows: u32,
    bridge_manager: State<'_, BridgeManager>,
) -> Result<ConnectResponse, String> {
    info!("Connecting to {}@{}:{}", username, host, port);

    // Build SSH config
    let config = SshConfig {
        host: host.clone(),
        port,
        username: username.clone(),
        auth: AuthMethod::Password(password),
        timeout_secs: 30,
        cols,
        rows,
    };

    // Create SSH client and connect
    let client = SshClient::new(config);
    let session = client
        .connect()
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    // Request interactive shell
    let session_handle = session
        .request_shell()
        .await
        .map_err(|e| format!("Shell request failed: {}", e))?;

    let session_id = session_handle.id.clone();

    // Start WebSocket bridge
    let (_, ws_port) = WsBridge::start(session_handle)
        .await
        .map_err(|e| format!("Failed to start WebSocket bridge: {}", e))?;

    // Register bridge
    bridge_manager.register(session_id.clone(), ws_port);

    let ws_url = format!("ws://localhost:{}", ws_port);

    info!("Connection established: session={}, ws_url={}", session_id, ws_url);

    Ok(ConnectResponse {
        session_id,
        ws_url,
        port: ws_port,
    })
}

/// Connect using SSH key authentication
#[tauri::command]
pub async fn ssh_connect_key(
    host: String,
    port: u16,
    username: String,
    key_path: String,
    passphrase: Option<String>,
    cols: u32,
    rows: u32,
    bridge_manager: State<'_, BridgeManager>,
) -> Result<ConnectResponse, String> {
    info!("Connecting to {}@{}:{} using key", username, host, port);

    // Build SSH config
    let config = SshConfig {
        host: host.clone(),
        port,
        username: username.clone(),
        auth: AuthMethod::Key { key_path, passphrase },
        timeout_secs: 30,
        cols,
        rows,
    };

    // Create SSH client and connect
    let client = SshClient::new(config);
    let session = client
        .connect()
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    // Request interactive shell
    let session_handle = session
        .request_shell()
        .await
        .map_err(|e| format!("Shell request failed: {}", e))?;

    let session_id = session_handle.id.clone();

    // Start WebSocket bridge
    let (_, ws_port) = WsBridge::start(session_handle)
        .await
        .map_err(|e| format!("Failed to start WebSocket bridge: {}", e))?;

    // Register bridge
    bridge_manager.register(session_id.clone(), ws_port);

    let ws_url = format!("ws://localhost:{}", ws_port);

    info!("Connection established: session={}, ws_url={}", session_id, ws_url);

    Ok(ConnectResponse {
        session_id,
        ws_url,
        port: ws_port,
    })
}
