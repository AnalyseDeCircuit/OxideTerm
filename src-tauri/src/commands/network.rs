//! Network Status Commands
//!
//! Handles network status changes from the frontend.

use std::sync::Arc;
use tauri::State;
use tracing::info;

use crate::session::AutoReconnectService;
use crate::ssh::SshConnectionRegistry;

/// Handle network status change from frontend
#[tauri::command]
pub async fn network_status_changed(
    online: bool,
    reconnect_service: State<'_, Arc<AutoReconnectService>>,
) -> Result<(), String> {
    info!("Network status changed: online={}", online);

    reconnect_service.set_network_status(online);

    // 🛑 后端禁止自动重连：只记录状态，不做决策
    // 前端监听网络状态变化事件，自行决定是否重连

    Ok(())
}

/// 主动探测所有活跃 SSH 连接的健康状态。
///
/// 对每个 Active/Idle 状态的连接发送 SSH keepalive 探测。
/// 已死连接会被标记为 link_down 并发射 `connection_status_changed` 事件，
/// 前端 useConnectionEvents 自动接收并调度 orchestrator 重连。
///
/// 使用场景：
/// - 笔记本从休眠唤醒（visibilitychange）
/// - 网络从 offline 恢复为 online
///
/// 返回已死连接的 connection_id 列表。
#[tauri::command]
pub async fn probe_connections(
    connection_registry: State<'_, Arc<SshConnectionRegistry>>,
) -> Result<Vec<String>, String> {
    info!("Probing all active connections for health check");
    let dead = connection_registry.probe_active_connections().await;
    Ok(dead)
}

/// 探测单个连接的健康状态。
///
/// 如果连接处于 LinkDown 且探测成功，自动恢复为 Active 并重启心跳监控。
/// 返回 "alive"（已恢复/存活）、"dead"（确认死亡）、"not_found"、"not_applicable"。
#[tauri::command]
pub async fn probe_single_connection(
    connection_id: String,
    connection_registry: State<'_, Arc<SshConnectionRegistry>>,
) -> Result<String, String> {
    info!("Probing single connection {} for recovery", connection_id);
    let result = connection_registry
        .probe_single_connection(&connection_id)
        .await;
    Ok(result)
}

/// Cancel reconnection for a session
#[tauri::command]
pub async fn cancel_reconnect(
    session_id: String,
    reconnect_service: State<'_, Arc<AutoReconnectService>>,
) -> Result<(), String> {
    reconnect_service.cancel_reconnect(&session_id);
    Ok(())
}

/// Check if a session is currently reconnecting
#[tauri::command]
pub async fn is_reconnecting(
    session_id: String,
    reconnect_service: State<'_, Arc<AutoReconnectService>>,
) -> Result<bool, String> {
    Ok(reconnect_service.is_reconnecting(&session_id))
}
