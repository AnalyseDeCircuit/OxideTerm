//! SSH Connection Manager Commands
//!
//! 这些命令提供独立的 SSH 连接管理，不依赖任何前端界面。

use serde::Deserialize;
use std::sync::Arc;
use tauri::State;

use crate::session::{KeyAuth, SessionConfig};
use crate::ssh::{ConnectionInfo, SshConnectionManager};

/// 创建 SSH 连接的请求
#[derive(Debug, Deserialize)]
pub struct CreateConnectionRequest {
    pub host: String,
    pub port: u16,
    pub username: String,
    #[serde(flatten)]
    pub auth: AuthRequest,
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

/// 创建 SSH 连接（独立于前端）
#[tauri::command]
pub async fn create_ssh_connection(
    request: CreateConnectionRequest,
    manager: State<'_, Arc<SshConnectionManager>>,
) -> Result<String, String> {
    // 转换为 SessionConfig
    let config = SessionConfig {
        host: request.host,
        port: request.port,
        username: request.username,
        auth: match request.auth {
            AuthRequest::Password { password } => crate::session::AuthMethod::Password {
                password,
            },
            AuthRequest::Key {
                key_path,
                passphrase,
            } => crate::session::AuthMethod::Key {
                key_path,
                passphrase,
            },
            AuthRequest::DefaultKey { passphrase } => {
                // Use default SSH key paths
                let key_auth = KeyAuth::from_default_locations(passphrase.as_deref())
                    .map_err(|e| format!("No SSH key found: {}", e))?;
                crate::session::AuthMethod::Key {
                    key_path: key_auth.key_path.to_string_lossy().to_string(),
                    passphrase,
                }
            }
            AuthRequest::Agent => crate::session::AuthMethod::Agent,
        },
        name: None,       // Auto-generated
        color: None,      // Auto-generated
        cols: 80,         // Default terminal size
        rows: 24,         // Default terminal size
    };

    manager.create_connection(config).await
}

/// 关闭 SSH 连接
#[tauri::command]
pub async fn close_ssh_connection(
    connection_id: String,
    manager: State<'_, Arc<SshConnectionManager>>,
) -> Result<(), String> {
    manager.close_connection(&connection_id).await
}

/// 列出所有 SSH 连接
#[tauri::command]
pub async fn list_ssh_connections(
    manager: State<'_, Arc<SshConnectionManager>>,
) -> Result<Vec<ConnectionInfo>, String> {
    Ok(manager.list_connections())
}

/// 设置连接为 keep_alive 模式
#[tauri::command]
pub async fn set_connection_keep_alive(
    connection_id: String,
    keep_alive: bool,
    manager: State<'_, Arc<SshConnectionManager>>,
) -> Result<(), String> {
    manager.set_keep_alive(&connection_id, keep_alive).await
}

/// 增加连接引用计数（组件 attach 时调用）
#[tauri::command]
pub async fn add_connection_ref(
    connection_id: String,
    manager: State<'_, Arc<SshConnectionManager>>,
) -> Result<(), String> {
    manager.add_connection_ref(&connection_id).await
}

/// 减少连接引用计数（组件 detach 时调用）
#[tauri::command]
pub async fn release_connection_ref(
    connection_id: String,
    manager: State<'_, Arc<SshConnectionManager>>,
) -> Result<u32, String> {
    manager.release_connection_ref(&connection_id).await
}
