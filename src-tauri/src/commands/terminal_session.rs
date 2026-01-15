//! Terminal Session Commands
//!
//! These commands create terminal UI sessions that attach to existing SSH connections.

use serde::Deserialize;
use std::sync::Arc;
use tauri::State;

use crate::bridge::{BridgeManager, WsBridge};
use crate::session::scroll_buffer::ScrollBuffer;
use crate::ssh::SshConnectionManager;

/// Create terminal session request
#[derive(Debug, Deserialize)]
pub struct CreateTerminalRequest {
    pub connection_id: String,
    pub cols: u16,
    pub rows: u16,
}

/// Terminal session response
#[derive(Debug, serde::Serialize)]
pub struct TerminalSessionResponse {
    pub session_id: String,  // 使用真实的 SSH session ID
    pub ws_url: String,
    pub ws_token: String,
}

/// Create terminal session (attaches to existing SSH connection)
#[tauri::command]
pub async fn create_terminal_session(
    request: CreateTerminalRequest,
    manager: State<'_, Arc<SshConnectionManager>>,
    bridge_manager: State<'_, BridgeManager>,
) -> Result<TerminalSessionResponse, String> {
    // 1. Get HandleController from existing SSH connection
    let handle_controller = manager
        .get_handle_controller(&request.connection_id)
        .ok_or("SSH connection not found")?;

    // 2. Increment reference count (terminal is now using this connection)
    manager.add_connection_ref(&request.connection_id).await?;

    // 3. Request PTY shell
    let session_handle = handle_controller
        .request_shell_extended(request.cols, request.rows)
        .await
        .map_err(|e| format!("Failed to request shell: {}", e))?;

    // 4. Extract needed data before session_handle is consumed
    let session_id = session_handle.id.clone();
    let cmd_tx = session_handle.cmd_tx.clone();

    // 5. Create scroll buffer
    let scroll_buffer = Arc::new(ScrollBuffer::new());

    // 6. Create WebSocket bridge (consumes session_handle)
    let (_, ws_port, ws_token) = WsBridge::start_extended(session_handle, scroll_buffer)
        .await
        .map_err(|e| format!("Failed to start WebSocket bridge: {}", e))?;

    // 7. Register bridge to BridgeManager (for tracking and cleanup)
    bridge_manager.register_extended(
        session_id.clone(),
        ws_port,
        ws_token.clone(),
        cmd_tx,  // Use cloned cmd_tx
    );

    // 8. Return session info with the REAL session_id
    Ok(TerminalSessionResponse {
        session_id,
        ws_url: format!("ws://localhost:{}", ws_port),
        ws_token,
    })
}

/// Close terminal session (does NOT close SSH connection)
#[tauri::command]
pub async fn close_terminal_session(
    session_id: String,
    connection_id: String,
    manager: State<'_, Arc<SshConnectionManager>>,
    bridge_manager: State<'_, BridgeManager>,
) -> Result<(), String> {
    // 1. Unregister and close WebSocket bridge
    bridge_manager
        .unregister(&session_id)
        .ok_or("Bridge not found")?;

    // 2. Decrement reference count (terminal is done using this connection)
    manager.release_connection_ref(&connection_id).await?;

    Ok(())
}
