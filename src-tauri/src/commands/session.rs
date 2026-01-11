//! Session management commands

use serde::Serialize;
use tauri::State;
use tracing::info;

use crate::bridge::BridgeManager;

/// Session information for the frontend
#[derive(Debug, Serialize)]
pub struct SessionInfo {
    pub session_id: String,
    pub port: u16,
    pub ws_url: String,
    pub uptime_secs: u64,
}

/// List all active sessions
#[tauri::command]
pub async fn list_sessions(
    bridge_manager: State<'_, BridgeManager>,
) -> Result<Vec<SessionInfo>, String> {
    let bridges = bridge_manager.list();
    
    let sessions: Vec<SessionInfo> = bridges
        .into_iter()
        .map(|b| SessionInfo {
            session_id: b.session_id,
            port: b.port,
            ws_url: format!("ws://localhost:{}", b.port),
            uptime_secs: b.created_at.elapsed().as_secs(),
        })
        .collect();

    Ok(sessions)
}

/// Disconnect a session
/// This triggers the cleanup flow: WS close → SSH channel close → registry cleanup
#[tauri::command]
pub async fn disconnect_session(
    session_id: String,
    bridge_manager: State<'_, BridgeManager>,
) -> Result<bool, String> {
    info!("Disconnecting session: {}", session_id);
    
    // Unregister from bridge manager - this will:
    // 1. Remove from registry
    // 2. Send SessionCommand::Close to SSH channel (if extended mode)
    // 3. SSH channel close will trigger WS close
    let removed = bridge_manager.unregister(&session_id);
    
    Ok(removed.is_some())
}

/// Resize a session's PTY
#[tauri::command]
pub async fn resize_session(
    session_id: String,
    cols: u16,
    rows: u16,
    bridge_manager: State<'_, BridgeManager>,
) -> Result<(), String> {
    info!("Resizing session {}: {}x{}", session_id, cols, rows);
    bridge_manager.resize(&session_id, cols, rows).await
}

/// Get session count
#[tauri::command]
pub async fn get_session_count(
    bridge_manager: State<'_, BridgeManager>,
) -> Result<usize, String> {
    Ok(bridge_manager.count())
}
