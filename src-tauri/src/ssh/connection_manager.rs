//! SSH Connection Manager
//!
//! 独立的 SSH 连接管理，不依赖任何前端界面。
//!
//! # Liveness 管理
//!
//! 使用**引用计数 + 延迟清理**策略：
//! - 每个使用该连接的组件（终端/SFTP/转发）增加引用计数
//! - 引用计数归零时，延迟 30 秒后自动清理（除非 keep_alive=true）
//!
//! # 设计原则
//!
//! - **完全独立**：不包含任何前端相关代码（WebSocket、UI）
//! - **资源安全**：自动清理空闲连接，避免泄漏
//! - **用户控制**：keep_alive 设置允许持久化连接

use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use dashmap::DashMap;
use tokio::sync::Mutex;
use tokio::time::interval;
use tracing::{debug, info};
use once_cell::sync::OnceCell;

use super::handle_owner::HandleController;
use super::{AuthMethod, SshClient, SshConfig};
use crate::session::SessionConfig;

/// 连接自动清理延迟（引用计数归零后）
const AUTO_CLOSE_DELAY: Duration = Duration::from_secs(30);

/// 清理任务执行间隔
const CLEANUP_INTERVAL: Duration = Duration::from_secs(10);

/// SSH 连接信息（用于前端显示）
#[derive(Debug, Clone, serde::Serialize)]
pub struct ConnectionInfo {
    pub id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub state: String,
    pub ref_count: u32,
    pub keep_alive: bool,
    pub created_at: String,
    pub last_activity: String,
}

/// 单个 SSH 连接（不包含前端相关代码）
pub struct SshConnection {
    /// 连接唯一 ID
    pub id: String,
    /// 连接配置
    pub config: SessionConfig,
    /// Handle 控制器（可克隆，用于打开 channel）
    pub handle_controller: HandleController,
    /// 连接状态
    pub state: ConnectionState,
    /// 引用计数（终端/SFTP/转发各+1）
    ref_count: AtomicU32,
    /// 最后活动时间戳（Unix 时间戳，秒）
    last_activity: AtomicU64,
    /// 是否保持连接（用户设置）
    keep_alive: bool,
    /// 创建时间
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// 连接状态
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionState {
    Connecting,
    Connected,
    Disconnecting,
    Error(String),
}

impl SshConnection {
    /// 增加引用计数
    pub fn add_ref(&self) -> u32 {
        let count = self.ref_count.fetch_add(1, Ordering::Relaxed) + 1;
        debug!("Connection {} ref count: {}", self.id, count);
        self.update_activity();
        count
    }

    /// 减少引用计数
    pub fn release(&self) -> u32 {
        let count = self.ref_count.fetch_sub(1, Ordering::Relaxed) - 1;
        debug!("Connection {} ref count: {}", self.id, count);
        self.update_activity();
        count
    }

    /// 获取当前引用计数
    pub fn ref_count(&self) -> u32 {
        self.ref_count.load(Ordering::Relaxed)
    }

    /// 更新活动时间
    pub fn update_activity(&self) {
        let now = Utc::now().timestamp() as u64;
        self.last_activity.store(now, Ordering::Relaxed);
    }

    /// 获取最后活动时间
    pub fn last_activity(&self) -> i64 {
        self.last_activity.load(Ordering::Relaxed) as i64
    }

    /// 设置 keep_alive 标志
    pub fn set_keep_alive(&mut self, keep_alive: bool) {
        self.keep_alive = keep_alive;
    }

    /// 获取 keep_alive 标志
    pub fn is_keep_alive(&self) -> bool {
        self.keep_alive
    }
}

/// SSH 连接管理器（独立于前端）
pub struct SshConnectionManager {
    /// 所有活跃的 SSH 连接
    connections: DashMap<String, Arc<Mutex<SshConnection>>>,
    /// Cleanup task 是否已启动
    cleanup_started: OnceCell<()>,
}

impl SshConnectionManager {
    /// 创建新的连接管理器
    pub fn new() -> Self {
        Self {
            connections: DashMap::new(),
            cleanup_started: OnceCell::new(),
        }
    }

    /// 确保 cleanup task 已启动（延迟初始化）
    fn ensure_cleanup_task(&self) {
        // 使用 OnceCell 确保 cleanup task 只启动一次
        let _ = self.cleanup_started.get_or_init(|| {
            self.spawn_cleanup_task();
            ()
        });
    }

    /// 创建新的 SSH 连接（不依赖前端）
    pub async fn create_connection(
        &self,
        config: SessionConfig,
    ) -> Result<String, String> {
        // 确保 cleanup task 已启动（延迟到第一次使用时）
        self.ensure_cleanup_task();

        let connection_id = uuid::Uuid::new_v4().to_string();

        info!(
            "Creating SSH connection {} -> {}@{}:{}",
            connection_id, config.username, config.host, config.port
        );

        // 1. 转换 SessionConfig 到 SshConfig
        let ssh_config = SshConfig {
            host: config.host.clone(),
            port: config.port,
            username: config.username.clone(),
            auth: match &config.auth {
                crate::session::AuthMethod::Password { password } => {
                    AuthMethod::Password(password.clone())
                }
                crate::session::AuthMethod::Key {
                    key_path,
                    passphrase,
                } => AuthMethod::Key {
                    key_path: key_path.clone(),
                    passphrase: passphrase.clone(),
                },
                crate::session::AuthMethod::Agent => AuthMethod::Agent,
            },
            timeout_secs: 30,
            cols: 80,  // 默认值，后续创建终端时可调整
            rows: 24,
            proxy_chain: None,  // TODO: 支持 proxy_chain
            strict_host_key_checking: false,
        };

        // 2. 建立 SSH 连接（调用 SshClient）
        let client = SshClient::new(ssh_config);
        let session = client.connect().await.map_err(|e| e.to_string())?;

        info!("SSH connection {} established", connection_id);

        // 3. 启动 Handle Owner Task，获取 HandleController
        let handle_controller = session.start(connection_id.clone());

        // 4. 创建连接对象
        let connection = SshConnection {
            id: connection_id.clone(),
            config: config.clone(),
            handle_controller,
            state: ConnectionState::Connected,
            ref_count: AtomicU32::new(0), // 初始引用计数为 0
            last_activity: AtomicU64::new(Utc::now().timestamp() as u64),
            keep_alive: false,
            created_at: Utc::now(),
        };

        // 5. 注册到管理器
        self.connections.insert(
            connection_id.clone(),
            Arc::new(Mutex::new(connection)),
        );

        Ok(connection_id)
    }

    /// 增加连接引用计数（组件 attach 时调用）
    pub async fn add_connection_ref(&self, connection_id: &str) -> Result<(), String> {
        let conn = self
            .connections
            .get(connection_id)
            .ok_or("Connection not found")?;

        let conn = conn.lock().await;
        conn.add_ref();
        Ok(())
    }

    /// 减少连接引用计数（组件 detach 时调用）
    pub async fn release_connection_ref(&self, connection_id: &str) -> Result<u32, String> {
        let conn = self
            .connections
            .get(connection_id)
            .ok_or("Connection not found")?;

        let conn = conn.lock().await;
        Ok(conn.release())
    }

    /// 获取连接的 HandleController（供 SFTP/Forwarding 使用）
    pub fn get_handle_controller(&self, connection_id: &str) -> Option<HandleController> {
        self.connections.get(connection_id).and_then(|conn| {
            let conn = conn.try_lock().ok()?;
            Some(conn.handle_controller.clone())
        })
    }

    /// 设置连接为 keep_alive 模式
    pub async fn set_keep_alive(
        &self,
        connection_id: &str,
        keep_alive: bool,
    ) -> Result<(), String> {
        let conn = self
            .connections
            .get(connection_id)
            .ok_or("Connection not found")?;

        let mut conn = conn.lock().await;
        conn.set_keep_alive(keep_alive);
        info!(
            "Connection {} keep_alive set to {}",
            connection_id, keep_alive
        );
        Ok(())
    }

    /// 手动关闭 SSH 连接（用户点击"断开连接"时调用）
    pub async fn close_connection(&self, connection_id: &str) -> Result<(), String> {
        info!("Manually closing connection {}", connection_id);

        if let Some((_, _conn)) = self.connections.remove(connection_id) {
            // Drop 会自动清理 HandleController 和 SSH 连接
            // TODO: 如果需要优雅关闭，可以在这里发送 Disconnect 命令
            Ok(())
        } else {
            Err("Connection not found".to_string())
        }
    }

    /// 列出所有连接
    pub fn list_connections(&self) -> Vec<ConnectionInfo> {
        self.connections
            .iter()
            .map(|entry| {
                let conn = entry.value();
                // 使用 try_lock 避免阻塞
                if let Ok(conn) = conn.try_lock() {
                    ConnectionInfo {
                        id: conn.id.clone(),
                        host: conn.config.host.clone(),
                        port: conn.config.port,
                        username: conn.config.username.clone(),
                        state: format!("{:?}", conn.state),
                        ref_count: conn.ref_count(),
                        keep_alive: conn.keep_alive,
                        created_at: conn.created_at.to_rfc3339(),
                        last_activity: {
                            let timestamp = conn.last_activity();
                            chrono::DateTime::from_timestamp(timestamp, 0)
                                .unwrap_or_default()
                                .to_rfc3339()
                        },
                    }
                } else {
                    // 如果获取锁失败，返回基本信息
                    ConnectionInfo {
                        id: entry.key().clone(),
                        host: "?".to_string(),
                        port: 0,
                        username: "?".to_string(),
                        state: "Unknown".to_string(),
                        ref_count: 0,
                        keep_alive: false,
                        created_at: Utc::now().to_rfc3339(),
                        last_activity: Utc::now().to_rfc3339(),
                    }
                }
            })
            .collect()
    }

    /// 启动后台清理任务
    fn spawn_cleanup_task(&self) {
        let connections = self.connections.clone();

        tokio::spawn(async move {
            let mut interval = interval(CLEANUP_INTERVAL);
            loop {
                interval.tick().await;

                let now = Utc::now().timestamp();

                // 收集需要清理的连接ID
                let mut to_remove = Vec::new();

                for entry in connections.iter() {
                    let connection_id = entry.key().clone();
                    if let Ok(conn) = entry.value().try_lock() {
                        // 检查是否需要自动清理
                        if conn.ref_count() == 0 && !conn.is_keep_alive() {
                            let last_activity = conn.last_activity();
                            let idle_seconds = now - last_activity;

                            if idle_seconds >= AUTO_CLOSE_DELAY.as_secs() as i64 {
                                info!(
                                    "Auto-closing idle connection {} (idle for {}s)",
                                    connection_id, idle_seconds
                                );
                                to_remove.push(connection_id);
                            }
                        }
                    }
                }

                // 清理标记的连接
                for connection_id in to_remove {
                    if let Some((_, _conn)) = connections.remove(&connection_id) {
                        info!("Closed connection {}", connection_id);
                        // Drop 会自动清理 HandleController 和 SSH 连接
                    }
                }
            }
        });
    }
}
