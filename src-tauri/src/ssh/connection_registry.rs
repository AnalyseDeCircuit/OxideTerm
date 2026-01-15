//! SSH Connection Registry
//!
//! 独立的 SSH 连接池管理，与前端界面完全解耦。
//!
//! # 架构
//!
//! ```text
//! ┌──────────────────────────────────────────────────────────────┐
//! │  SshConnectionRegistry                                       │
//! │  ┌────────────────────────────────────────────────────────┐  │
//! │  │  ConnectionEntry                                        │  │
//! │  │  ├── handle_controller: HandleController               │  │
//! │  │  ├── config: SessionConfig                              │  │
//! │  │  ├── ref_count: AtomicU32                               │  │
//! │  │  └── idle_timer: Option<JoinHandle>                     │  │
//! │  └────────────────────────────────────────────────────────┘  │
//! └──────────────────────────────────────────────────────────────┘
//!          │
//!          │  HandleController (clone)
//!          │
//!    ┌─────┴─────┬─────────────┬─────────────┐
//!    ▼           ▼             ▼             ▼
//! Terminal   Terminal      SFTP       Forwarding
//!  Tab 1      Tab 2
//! ```
//!
//! # 空闲超时策略
//!
//! - 引用计数归零时，启动空闲计时器（默认 30 分钟）
//! - 计时器到期前有新使用者：取消计时器，复用连接
//! - 计时器到期：断开连接，释放资源
//! - keep_alive=true：忽略空闲超时

use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tokio::sync::{Mutex, RwLock};
use tokio::task::JoinHandle;
use tracing::{debug, error, info, warn};

use super::handle_owner::HandleController;
use super::{AuthMethod as SshAuthMethod, SshClient, SshConfig};
use crate::session::{AuthMethod, SessionConfig};

/// 默认空闲超时时间（30 分钟）
const DEFAULT_IDLE_TIMEOUT: Duration = Duration::from_secs(30 * 60);

/// 心跳间隔（30 秒）
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(30);

/// 心跳连续失败次数阈值，达到后标记为 LinkDown
const HEARTBEAT_FAIL_THRESHOLD: u32 = 3;

/// 重连间隔（初始值，使用指数退避）
const RECONNECT_INITIAL_DELAY: Duration = Duration::from_secs(2);

/// 重连最大间隔
const RECONNECT_MAX_DELAY: Duration = Duration::from_secs(60);

/// 普通模式最大重连次数
const RECONNECT_MAX_ATTEMPTS: u32 = 5;

/// 连接池配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionPoolConfig {
    /// 空闲超时时间（秒）
    #[serde(default = "default_idle_timeout_secs")]
    pub idle_timeout_secs: u64,

    /// 最大连接数（0 = 无限制）
    #[serde(default)]
    pub max_connections: usize,

    /// 是否在应用退出时保护连接（graceful shutdown）
    #[serde(default = "default_true")]
    pub protect_on_exit: bool,
}

fn default_idle_timeout_secs() -> u64 {
    DEFAULT_IDLE_TIMEOUT.as_secs()
}

fn default_true() -> bool {
    true
}

impl Default for ConnectionPoolConfig {
    fn default() -> Self {
        Self {
            idle_timeout_secs: DEFAULT_IDLE_TIMEOUT.as_secs(),
            max_connections: 0,
            protect_on_exit: true,
        }
    }
}

/// 连接状态
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionState {
    /// 连接中
    Connecting,
    /// 已连接，有活跃使用者
    Active,
    /// 已连接，无使用者，等待超时
    Idle,
    /// 链路断开（心跳失败），等待重连
    LinkDown,
    /// 正在重连
    Reconnecting,
    /// 正在断开
    Disconnecting,
    /// 已断开
    Disconnected,
    /// 连接错误
    Error(String),
}

/// SSH 连接信息（用于前端显示）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionInfo {
    pub id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub state: ConnectionState,
    pub ref_count: u32,
    pub keep_alive: bool,
    pub created_at: String,
    pub last_active: String,
    /// 关联的 session IDs
    pub terminal_ids: Vec<String>,
    /// 关联的 SFTP session ID
    pub sftp_session_id: Option<String>,
    /// 关联的 forward IDs
    pub forward_ids: Vec<String>,
}

/// 单个 SSH 连接条目
pub struct ConnectionEntry {
    /// 连接唯一 ID
    pub id: String,

    /// 连接配置
    pub config: SessionConfig,

    /// Handle 控制器（可克隆，用于打开 channel）
    pub handle_controller: HandleController,

    /// 连接状态
    state: RwLock<ConnectionState>,

    /// 引用计数（Terminal + SFTP + Forwarding）
    ref_count: AtomicU32,

    /// 最后活动时间戳（Unix 时间戳，秒）
    last_active: AtomicU64,

    /// 是否保持连接（用户设置）
    keep_alive: RwLock<bool>,

    /// 创建时间
    pub created_at: chrono::DateTime<chrono::Utc>,

    /// 空闲计时器句柄（用于取消）
    idle_timer: Mutex<Option<JoinHandle<()>>>,

    /// 关联的 terminal session IDs
    terminal_ids: RwLock<Vec<String>>,

    /// 关联的 SFTP session ID
    sftp_session_id: RwLock<Option<String>>,

    /// 关联的 forward IDs
    forward_ids: RwLock<Vec<String>>,

    /// 心跳任务句柄
    heartbeat_task: Mutex<Option<JoinHandle<()>>>,

    /// 连续心跳失败次数
    heartbeat_failures: AtomicU32,

    /// 重连任务句柄
    reconnect_task: Mutex<Option<JoinHandle<()>>>,

    /// 是否正在重连
    is_reconnecting: AtomicBool,

    /// 重连尝试次数
    reconnect_attempts: AtomicU32,
}

impl ConnectionEntry {
    /// 增加引用计数
    pub fn add_ref(&self) -> u32 {
        let count = self.ref_count.fetch_add(1, Ordering::SeqCst) + 1;
        debug!("Connection {} ref count increased to {}", self.id, count);
        self.update_activity();
        count
    }

    /// 减少引用计数
    pub fn release(&self) -> u32 {
        let prev = self.ref_count.fetch_sub(1, Ordering::SeqCst);
        let count = prev.saturating_sub(1);
        debug!("Connection {} ref count decreased to {}", self.id, count);
        self.update_activity();
        count
    }

    /// 获取当前引用计数
    pub fn ref_count(&self) -> u32 {
        self.ref_count.load(Ordering::SeqCst)
    }

    /// 更新活动时间
    pub fn update_activity(&self) {
        let now = Utc::now().timestamp() as u64;
        self.last_active.store(now, Ordering::SeqCst);
    }

    /// 获取最后活动时间
    pub fn last_active(&self) -> i64 {
        self.last_active.load(Ordering::SeqCst) as i64
    }

    /// 获取连接状态
    pub async fn state(&self) -> ConnectionState {
        self.state.read().await.clone()
    }

    /// 设置连接状态
    pub async fn set_state(&self, state: ConnectionState) {
        *self.state.write().await = state;
    }

    /// 获取 keep_alive 标志
    pub async fn is_keep_alive(&self) -> bool {
        *self.keep_alive.read().await
    }

    /// 设置 keep_alive 标志
    pub async fn set_keep_alive(&self, keep_alive: bool) {
        *self.keep_alive.write().await = keep_alive;
    }

    /// 取消空闲计时器
    pub async fn cancel_idle_timer(&self) {
        let mut timer = self.idle_timer.lock().await;
        if let Some(handle) = timer.take() {
            handle.abort();
            debug!("Connection {} idle timer cancelled", self.id);
        }
    }

    /// 设置空闲计时器
    pub async fn set_idle_timer(&self, handle: JoinHandle<()>) {
        let mut timer = self.idle_timer.lock().await;
        // 取消之前的计时器
        if let Some(old_handle) = timer.take() {
            old_handle.abort();
        }
        *timer = Some(handle);
    }

    /// 添加关联的 terminal session ID
    pub async fn add_terminal(&self, session_id: String) {
        self.terminal_ids.write().await.push(session_id);
    }

    /// 移除关联的 terminal session ID
    pub async fn remove_terminal(&self, session_id: &str) {
        self.terminal_ids.write().await.retain(|id| id != session_id);
    }

    /// 获取关联的 terminal session IDs
    pub async fn terminal_ids(&self) -> Vec<String> {
        self.terminal_ids.read().await.clone()
    }

    /// 设置关联的 SFTP session ID
    pub async fn set_sftp_session(&self, session_id: Option<String>) {
        *self.sftp_session_id.write().await = session_id;
    }

    /// 获取关联的 SFTP session ID
    pub async fn sftp_session_id(&self) -> Option<String> {
        self.sftp_session_id.read().await.clone()
    }

    /// 添加关联的 forward ID
    pub async fn add_forward(&self, forward_id: String) {
        self.forward_ids.write().await.push(forward_id);
    }

    /// 移除关联的 forward ID
    pub async fn remove_forward(&self, forward_id: &str) {
        self.forward_ids.write().await.retain(|id| id != forward_id);
    }

    /// 获取关联的 forward IDs
    pub async fn forward_ids(&self) -> Vec<String> {
        self.forward_ids.read().await.clone()
    }

    /// 转换为 ConnectionInfo
    pub async fn to_info(&self) -> ConnectionInfo {
        ConnectionInfo {
            id: self.id.clone(),
            host: self.config.host.clone(),
            port: self.config.port,
            username: self.config.username.clone(),
            state: self.state().await,
            ref_count: self.ref_count(),
            keep_alive: self.is_keep_alive().await,
            created_at: self.created_at.to_rfc3339(),
            last_active: chrono::DateTime::from_timestamp(self.last_active(), 0)
                .unwrap_or_default()
                .to_rfc3339(),
            terminal_ids: self.terminal_ids().await,
            sftp_session_id: self.sftp_session_id().await,
            forward_ids: self.forward_ids().await,
        }
    }

    /// 重置心跳失败计数
    pub fn reset_heartbeat_failures(&self) {
        self.heartbeat_failures.store(0, Ordering::SeqCst);
    }

    /// 增加心跳失败计数并返回新值
    pub fn increment_heartbeat_failures(&self) -> u32 {
        self.heartbeat_failures.fetch_add(1, Ordering::SeqCst) + 1
    }

    /// 获取心跳失败计数
    pub fn heartbeat_failures(&self) -> u32 {
        self.heartbeat_failures.load(Ordering::SeqCst)
    }

    /// 取消心跳任务
    pub async fn cancel_heartbeat(&self) {
        let mut task = self.heartbeat_task.lock().await;
        if let Some(handle) = task.take() {
            handle.abort();
            debug!("Connection {} heartbeat task cancelled", self.id);
        }
    }

    /// 设置心跳任务句柄
    pub async fn set_heartbeat_task(&self, handle: JoinHandle<()>) {
        let mut task = self.heartbeat_task.lock().await;
        if let Some(old_handle) = task.take() {
            old_handle.abort();
        }
        *task = Some(handle);
    }

    /// 取消重连任务
    pub async fn cancel_reconnect(&self) {
        let mut task = self.reconnect_task.lock().await;
        if let Some(handle) = task.take() {
            handle.abort();
            debug!("Connection {} reconnect task cancelled", self.id);
        }
        self.is_reconnecting.store(false, Ordering::SeqCst);
        self.reconnect_attempts.store(0, Ordering::SeqCst);
    }

    /// 设置重连任务句柄
    pub async fn set_reconnect_task(&self, handle: JoinHandle<()>) {
        let mut task = self.reconnect_task.lock().await;
        if let Some(old_handle) = task.take() {
            old_handle.abort();
        }
        *task = Some(handle);
        self.is_reconnecting.store(true, Ordering::SeqCst);
    }

    /// 检查是否正在重连
    pub fn is_reconnecting(&self) -> bool {
        self.is_reconnecting.load(Ordering::SeqCst)
    }

    /// 增加重连尝试次数并返回新值
    pub fn increment_reconnect_attempts(&self) -> u32 {
        self.reconnect_attempts.fetch_add(1, Ordering::SeqCst) + 1
    }

    /// 获取重连尝试次数
    pub fn reconnect_attempts(&self) -> u32 {
        self.reconnect_attempts.load(Ordering::SeqCst)
    }

    /// 重置重连状态
    pub fn reset_reconnect_state(&self) {
        self.is_reconnecting.store(false, Ordering::SeqCst);
        self.reconnect_attempts.store(0, Ordering::SeqCst);
    }
}

/// SSH 连接注册表错误
#[derive(Debug, thiserror::Error)]
pub enum ConnectionRegistryError {
    #[error("Connection not found: {0}")]
    NotFound(String),

    #[error("Connection limit reached: {current}/{max}")]
    LimitReached { current: usize, max: usize },

    #[error("Connection failed: {0}")]
    ConnectionFailed(String),

    #[error("Already disconnected")]
    AlreadyDisconnected,

    #[error("Invalid state transition: {0}")]
    InvalidState(String),
}

/// SSH 连接注册表
pub struct SshConnectionRegistry {
    /// 所有活跃的 SSH 连接
    connections: DashMap<String, Arc<ConnectionEntry>>,

    /// 连接池配置
    config: RwLock<ConnectionPoolConfig>,

    /// Tauri App Handle（用于发送事件）
    app_handle: RwLock<Option<AppHandle>>,
}

impl Default for SshConnectionRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl SshConnectionRegistry {
    /// 创建新的连接注册表
    pub fn new() -> Self {
        Self {
            connections: DashMap::new(),
            config: RwLock::new(ConnectionPoolConfig::default()),
            app_handle: RwLock::new(None),
        }
    }

    /// 使用自定义配置创建
    pub fn with_config(config: ConnectionPoolConfig) -> Self {
        Self {
            connections: DashMap::new(),
            config: RwLock::new(config),
            app_handle: RwLock::new(None),
        }
    }

    /// 设置 AppHandle（用于发送事件）
    pub async fn set_app_handle(&self, handle: AppHandle) {
        *self.app_handle.write().await = Some(handle);
    }

    /// 获取配置
    pub async fn config(&self) -> ConnectionPoolConfig {
        self.config.read().await.clone()
    }

    /// 更新配置
    pub async fn set_config(&self, config: ConnectionPoolConfig) {
        *self.config.write().await = config;
    }

    /// 获取空闲超时时间
    pub async fn idle_timeout(&self) -> Duration {
        Duration::from_secs(self.config.read().await.idle_timeout_secs)
    }

    /// 创建新的 SSH 连接
    ///
    /// # Arguments
    /// * `config` - SSH 连接配置
    ///
    /// # Returns
    /// * `Ok(connection_id)` - 连接成功，返回连接 ID
    /// * `Err(e)` - 连接失败
    pub async fn connect(
        &self,
        config: SessionConfig,
    ) -> Result<String, ConnectionRegistryError> {
        // 检查连接数限制
        let pool_config = self.config.read().await;
        if pool_config.max_connections > 0
            && self.connections.len() >= pool_config.max_connections
        {
            return Err(ConnectionRegistryError::LimitReached {
                current: self.connections.len(),
                max: pool_config.max_connections,
            });
        }
        drop(pool_config);

        let connection_id = uuid::Uuid::new_v4().to_string();

        info!(
            "Creating SSH connection {} -> {}@{}:{}",
            connection_id, config.username, config.host, config.port
        );

        // 转换 SessionConfig 到 SshConfig
        let ssh_config = SshConfig {
            host: config.host.clone(),
            port: config.port,
            username: config.username.clone(),
            auth: match &config.auth {
                AuthMethod::Password { password } => SshAuthMethod::Password(password.clone()),
                AuthMethod::Key {
                    key_path,
                    passphrase,
                } => SshAuthMethod::Key {
                    key_path: key_path.clone(),
                    passphrase: passphrase.clone(),
                },
                AuthMethod::Agent => SshAuthMethod::Agent,
            },
            timeout_secs: 30,
            cols: config.cols,
            rows: config.rows,
            proxy_chain: None,
            strict_host_key_checking: false,
        };

        // 建立 SSH 连接
        let client = SshClient::new(ssh_config);
        let session = client
            .connect()
            .await
            .map_err(|e| ConnectionRegistryError::ConnectionFailed(e.to_string()))?;

        info!("SSH connection {} established", connection_id);

        // 启动 Handle Owner Task，获取 HandleController
        let handle_controller = session.start(connection_id.clone());

        // 创建连接条目
        let entry = Arc::new(ConnectionEntry {
            id: connection_id.clone(),
            config,
            handle_controller,
            state: RwLock::new(ConnectionState::Active),
            ref_count: AtomicU32::new(0),
            last_active: AtomicU64::new(Utc::now().timestamp() as u64),
            keep_alive: RwLock::new(false),
            created_at: Utc::now(),
            idle_timer: Mutex::new(None),
            terminal_ids: RwLock::new(Vec::new()),
            sftp_session_id: RwLock::new(None),
            forward_ids: RwLock::new(Vec::new()),
            heartbeat_task: Mutex::new(None),
            heartbeat_failures: AtomicU32::new(0),
            reconnect_task: Mutex::new(None),
            is_reconnecting: AtomicBool::new(false),
            reconnect_attempts: AtomicU32::new(0),
        });

        self.connections.insert(connection_id.clone(), entry);

        Ok(connection_id)
    }

    /// 根据配置查找已存在的连接
    ///
    /// 用于复用已有连接
    pub fn find_by_config(&self, config: &SessionConfig) -> Option<String> {
        for entry in self.connections.iter() {
            let conn = entry.value();
            if conn.config.host == config.host
                && conn.config.port == config.port
                && conn.config.username == config.username
            {
                // 检查连接是否还活着
                if conn.handle_controller.is_connected() {
                    return Some(entry.key().clone());
                }
            }
        }
        None
    }

    /// 获取连接（增加引用计数）
    ///
    /// 调用者使用完后必须调用 `release`
    pub async fn acquire(
        &self,
        connection_id: &str,
    ) -> Result<HandleController, ConnectionRegistryError> {
        let entry = self
            .connections
            .get(connection_id)
            .ok_or_else(|| ConnectionRegistryError::NotFound(connection_id.to_string()))?;

        let conn = entry.value();

        // 检查连接状态
        let state = conn.state().await;
        if state == ConnectionState::Disconnected || state == ConnectionState::Disconnecting {
            return Err(ConnectionRegistryError::AlreadyDisconnected);
        }

        // 增加引用计数
        let prev_count = conn.ref_count();
        conn.add_ref();

        // 如果从 0 变为 1，取消空闲计时器，状态变为 Active
        if prev_count == 0 {
            conn.cancel_idle_timer().await;
            conn.set_state(ConnectionState::Active).await;
            info!(
                "Connection {} reactivated (ref_count: 0 -> 1)",
                connection_id
            );
        }

        Ok(conn.handle_controller.clone())
    }

    /// 释放连接引用（减少引用计数）
    ///
    /// 当引用计数归零时，启动空闲计时器
    pub async fn release(&self, connection_id: &str) -> Result<(), ConnectionRegistryError> {
        let entry = self
            .connections
            .get(connection_id)
            .ok_or_else(|| ConnectionRegistryError::NotFound(connection_id.to_string()))?;

        let conn = entry.value().clone();
        drop(entry); // 释放 DashMap 锁

        // 减少引用计数
        let new_count = conn.release();

        // 如果引用计数归零，启动空闲计时器
        if new_count == 0 {
            let keep_alive = conn.is_keep_alive().await;
            if keep_alive {
                info!(
                    "Connection {} idle but keep_alive=true, not starting timer",
                    connection_id
                );
                conn.set_state(ConnectionState::Idle).await;
            } else {
                self.start_idle_timer(&conn).await;
            }
        }

        Ok(())
    }

    /// 启动空闲计时器
    async fn start_idle_timer(&self, conn: &Arc<ConnectionEntry>) {
        let connection_id = conn.id.clone();
        let timeout = self.idle_timeout().await;

        info!(
            "Connection {} idle, starting {} minute timer",
            connection_id,
            timeout.as_secs() / 60
        );

        conn.set_state(ConnectionState::Idle).await;

        let conn_clone = conn.clone();
        let connections = self.connections.clone();

        let handle = tokio::spawn(async move {
            tokio::time::sleep(timeout).await;

            // 超时到期，检查是否仍然空闲
            if conn_clone.ref_count() == 0 {
                info!(
                    "Connection {} idle timeout expired, disconnecting",
                    connection_id
                );

                // 断开连接
                conn_clone.handle_controller.disconnect().await;
                conn_clone.set_state(ConnectionState::Disconnected).await;

                // 从注册表移除
                connections.remove(&connection_id);

                info!("Connection {} removed from registry", connection_id);
            } else {
                debug!(
                    "Connection {} idle timer expired but ref_count > 0, ignoring",
                    connection_id
                );
            }
        });

        conn.set_idle_timer(handle).await;
    }

    /// 强制断开连接
    pub async fn disconnect(
        &self,
        connection_id: &str,
    ) -> Result<(), ConnectionRegistryError> {
        let entry = self
            .connections
            .get(connection_id)
            .ok_or_else(|| ConnectionRegistryError::NotFound(connection_id.to_string()))?;

        let conn = entry.value().clone();
        drop(entry);

        info!("Force disconnecting connection {}", connection_id);

        // 取消空闲计时器
        conn.cancel_idle_timer().await;

        // 设置状态为断开中
        conn.set_state(ConnectionState::Disconnecting).await;

        // 断开 SSH 连接
        conn.handle_controller.disconnect().await;

        // 设置状态为已断开
        conn.set_state(ConnectionState::Disconnected).await;

        // 从注册表移除
        self.connections.remove(connection_id);

        info!("Connection {} disconnected and removed", connection_id);

        Ok(())
    }

    /// 断开所有连接（应用退出时调用）
    pub async fn disconnect_all(&self) {
        info!("Disconnecting all SSH connections...");

        let connection_ids: Vec<String> = self.connections.iter().map(|e| e.key().clone()).collect();

        for connection_id in connection_ids {
            if let Err(e) = self.disconnect(&connection_id).await {
                warn!("Failed to disconnect {}: {}", connection_id, e);
            }
        }

        info!("All SSH connections disconnected");
    }

    /// 检查连接是否存活
    pub fn is_alive(&self, connection_id: &str) -> bool {
        self.connections
            .get(connection_id)
            .map(|e| e.handle_controller.is_connected())
            .unwrap_or(false)
    }

    /// 获取连接信息
    pub async fn get_info(
        &self,
        connection_id: &str,
    ) -> Option<ConnectionInfo> {
        let entry = self.connections.get(connection_id)?;
        Some(entry.value().to_info().await)
    }

    /// 列出所有连接
    pub async fn list_connections(&self) -> Vec<ConnectionInfo> {
        let mut result = Vec::with_capacity(self.connections.len());
        for entry in self.connections.iter() {
            result.push(entry.value().to_info().await);
        }
        result
    }

    /// 注册已存在的连接（用于 connect_v2 集成）
    ///
    /// 将 connect_v2 创建的 HandleController 注册到连接池，
    /// 使连接池面板能够显示这些连接。
    ///
    /// # Arguments
    /// * `connection_id` - 连接 ID（通常使用 session_id）
    /// * `config` - 会话配置
    /// * `handle_controller` - 已创建的 HandleController
    /// * `session_id` - 关联的 terminal session ID
    ///
    /// # Returns
    /// * 返回连接 ID
    pub async fn register_existing(
        &self,
        connection_id: String,
        config: SessionConfig,
        handle_controller: HandleController,
        session_id: String,
    ) -> String {
        info!(
            "Registering existing connection {} for session {}",
            connection_id, session_id
        );

        // 创建连接条目
        let entry = Arc::new(ConnectionEntry {
            id: connection_id.clone(),
            config,
            handle_controller,
            state: RwLock::new(ConnectionState::Active),
            ref_count: AtomicU32::new(1), // 初始引用计数为 1（对应 terminal）
            last_active: AtomicU64::new(Utc::now().timestamp() as u64),
            keep_alive: RwLock::new(false),
            created_at: Utc::now(),
            idle_timer: Mutex::new(None),
            terminal_ids: RwLock::new(vec![session_id]),
            sftp_session_id: RwLock::new(None),
            forward_ids: RwLock::new(Vec::new()),
            heartbeat_task: Mutex::new(None),
            heartbeat_failures: AtomicU32::new(0),
            reconnect_task: Mutex::new(None),
            is_reconnecting: AtomicBool::new(false),
            reconnect_attempts: AtomicU32::new(0),
        });

        self.connections.insert(connection_id.clone(), entry);

        info!(
            "Connection {} registered, total connections: {}",
            connection_id,
            self.connections.len()
        );

        connection_id
    }

    /// 获取连接数量
    pub fn connection_count(&self) -> usize {
        self.connections.len()
    }

    /// 设置 keep_alive 标志
    pub async fn set_keep_alive(
        &self,
        connection_id: &str,
        keep_alive: bool,
    ) -> Result<(), ConnectionRegistryError> {
        let entry = self
            .connections
            .get(connection_id)
            .ok_or_else(|| ConnectionRegistryError::NotFound(connection_id.to_string()))?;

        let conn = entry.value();
        conn.set_keep_alive(keep_alive).await;

        info!(
            "Connection {} keep_alive set to {}",
            connection_id, keep_alive
        );

        // 如果当前是空闲状态且 keep_alive=true，取消计时器
        if keep_alive && conn.state().await == ConnectionState::Idle {
            conn.cancel_idle_timer().await;
        }

        Ok(())
    }

    /// 获取 HandleController（不增加引用计数）
    ///
    /// 用于内部操作，调用者需要自行管理生命周期
    pub fn get_handle_controller(&self, connection_id: &str) -> Option<HandleController> {
        self.connections
            .get(connection_id)
            .map(|e| e.handle_controller.clone())
    }

    /// 添加关联的 terminal session
    pub async fn add_terminal(
        &self,
        connection_id: &str,
        session_id: String,
    ) -> Result<(), ConnectionRegistryError> {
        let entry = self
            .connections
            .get(connection_id)
            .ok_or_else(|| ConnectionRegistryError::NotFound(connection_id.to_string()))?;

        entry.value().add_terminal(session_id).await;
        Ok(())
    }

    /// 移除关联的 terminal session
    pub async fn remove_terminal(
        &self,
        connection_id: &str,
        session_id: &str,
    ) -> Result<(), ConnectionRegistryError> {
        let entry = self
            .connections
            .get(connection_id)
            .ok_or_else(|| ConnectionRegistryError::NotFound(connection_id.to_string()))?;

        entry.value().remove_terminal(session_id).await;
        Ok(())
    }

    /// 设置关联的 SFTP session
    pub async fn set_sftp_session(
        &self,
        connection_id: &str,
        session_id: Option<String>,
    ) -> Result<(), ConnectionRegistryError> {
        let entry = self
            .connections
            .get(connection_id)
            .ok_or_else(|| ConnectionRegistryError::NotFound(connection_id.to_string()))?;

        entry.value().set_sftp_session(session_id).await;
        Ok(())
    }

    /// 添加关联的 forward
    pub async fn add_forward(
        &self,
        connection_id: &str,
        forward_id: String,
    ) -> Result<(), ConnectionRegistryError> {
        let entry = self
            .connections
            .get(connection_id)
            .ok_or_else(|| ConnectionRegistryError::NotFound(connection_id.to_string()))?;

        entry.value().add_forward(forward_id).await;
        Ok(())
    }

    /// 移除关联的 forward
    pub async fn remove_forward(
        &self,
        connection_id: &str,
        forward_id: &str,
    ) -> Result<(), ConnectionRegistryError> {
        let entry = self
            .connections
            .get(connection_id)
            .ok_or_else(|| ConnectionRegistryError::NotFound(connection_id.to_string()))?;

        entry.value().remove_forward(forward_id).await;
        Ok(())
    }

    /// 根据 session_id 查找 connection_id
    pub async fn find_by_terminal(&self, session_id: &str) -> Option<String> {
        for entry in self.connections.iter() {
            let terminal_ids = entry.value().terminal_ids().await;
            if terminal_ids.contains(&session_id.to_string()) {
                return Some(entry.key().clone());
            }
        }
        None
    }

    /// 启动连接的心跳监控任务
    ///
    /// 每 30 秒发送一次心跳，连续 3 次失败后标记为 LinkDown 并启动重连
    pub fn start_heartbeat(self: &Arc<Self>, connection_id: &str) {
        let Some(entry) = self.connections.get(connection_id) else {
            warn!("Cannot start heartbeat for non-existent connection {}", connection_id);
            return;
        };

        let conn = entry.value().clone();
        let registry = Arc::clone(self);
        let connection_id = connection_id.to_string();

        let task = tokio::spawn(async move {
            info!("Heartbeat task started for connection {}", connection_id);
            let mut interval = tokio::time::interval(HEARTBEAT_INTERVAL);

            loop {
                interval.tick().await;

                // 检查连接状态，如果正在重连或已断开，停止心跳
                let state = conn.state().await;
                if matches!(state, ConnectionState::Reconnecting | ConnectionState::Disconnecting | ConnectionState::Disconnected) {
                    debug!("Connection {} state is {:?}, stopping heartbeat", connection_id, state);
                    break;
                }

                // 发送心跳 ping
                let is_alive = conn.handle_controller.ping().await;

                if is_alive {
                    // 心跳成功，重置失败计数
                    conn.reset_heartbeat_failures();
                    conn.update_activity();
                    debug!("Connection {} heartbeat OK", connection_id);
                } else {
                    // 心跳失败
                    let failures = conn.increment_heartbeat_failures();
                    warn!(
                        "Connection {} heartbeat failed ({}/{})",
                        connection_id, failures, HEARTBEAT_FAIL_THRESHOLD
                    );

                    if failures >= HEARTBEAT_FAIL_THRESHOLD {
                        // 达到失败阈值，标记为 LinkDown
                        error!("Connection {} marked as LinkDown after {} heartbeat failures", 
                               connection_id, failures);
                        conn.set_state(ConnectionState::LinkDown).await;

                        // 广播状态变更事件
                        registry.emit_connection_status_changed(&connection_id, "link_down").await;

                        // 启动重连
                        registry.start_reconnect(&connection_id).await;

                        break;
                    }
                }
            }

            info!("Heartbeat task stopped for connection {}", connection_id);
        });

        // 保存任务句柄（需要在 spawn 之后异步设置）
        let conn = entry.value().clone();
        tokio::spawn(async move {
            conn.set_heartbeat_task(task).await;
        });
    }

    /// 启动连接重连任务
    async fn start_reconnect(self: &Arc<Self>, connection_id: &str) {
        let Some(entry) = self.connections.get(connection_id) else {
            return;
        };

        let conn = entry.value().clone();
        if conn.is_reconnecting() {
            debug!("Connection {} already reconnecting, skip", connection_id);
            return;
        }

        let is_pinned = conn.is_keep_alive().await;
        let registry = Arc::clone(self);
        let connection_id = connection_id.to_string();
        let config = conn.config.clone();
        let conn_for_task = conn.clone();

        let task = tokio::spawn(async move {
            info!(
                "Reconnect task started for connection {} (pinned={})",
                connection_id, is_pinned
            );

            conn_for_task.set_state(ConnectionState::Reconnecting).await;
            registry.emit_connection_status_changed(&connection_id, "reconnecting").await;

            let mut delay = RECONNECT_INITIAL_DELAY;
            let max_attempts = if is_pinned { u32::MAX } else { RECONNECT_MAX_ATTEMPTS };

            loop {
                let attempt = conn_for_task.increment_reconnect_attempts();
                info!(
                    "Connection {} reconnect attempt {}/{}",
                    connection_id,
                    attempt,
                    if is_pinned { "∞".to_string() } else { max_attempts.to_string() }
                );

                // 等待延迟
                tokio::time::sleep(delay).await;

                // 尝试重连
                match registry.try_reconnect(&connection_id, &config).await {
                    Ok(new_controller) => {
                        info!("Connection {} reconnected successfully", connection_id);

                        // 获取关联的 terminal IDs 和 forward IDs（在更新前获取）
                        let terminal_ids = conn_for_task.terminal_ids().await;
                        let forward_ids = conn_for_task.forward_ids().await;

                        // 更新 handle_controller - 需要替换整个连接条目
                        // 注意：由于 ConnectionEntry 的字段是不可变的，我们需要创建新条目
                        // 这里简化处理：更新现有条目的状态，新的 handle_controller 通过事件传递
                        
                        conn_for_task.reset_heartbeat_failures();
                        conn_for_task.reset_reconnect_state();
                        conn_for_task.set_state(ConnectionState::Active).await;

                        // 用新的 HandleController 替换旧的连接条目
                        registry.replace_handle_controller(&connection_id, new_controller.clone()).await;

                        // 广播重连成功事件（包含需要恢复的 terminal 和 forward 信息）
                        registry.emit_connection_reconnected(
                            &connection_id,
                            terminal_ids,
                            forward_ids,
                        ).await;

                        // 广播状态变更事件
                        registry.emit_connection_status_changed(&connection_id, "connected").await;

                        // 重新启动心跳
                        registry.start_heartbeat(&connection_id);

                        break;
                    }
                    Err(e) => {
                        warn!("Connection {} reconnect attempt {} failed: {}", connection_id, attempt, e);

                        if !is_pinned && attempt >= max_attempts {
                            // 普通模式：达到最大重连次数，放弃
                            error!(
                                "Connection {} reconnect failed after {} attempts, giving up",
                                connection_id, attempt
                            );
                            conn_for_task.set_state(ConnectionState::Disconnected).await;
                            registry.emit_connection_status_changed(&connection_id, "disconnected").await;

                            // 清理连接
                            registry.connections.remove(&connection_id);
                            break;
                        }

                        // 增加延迟（指数退避）
                        delay = std::cmp::min(delay * 2, RECONNECT_MAX_DELAY);
                    }
                }
            }

            info!("Reconnect task stopped for connection {}", connection_id);
        });

        // 保存任务句柄
        tokio::spawn(async move {
            conn.set_reconnect_task(task).await;
        });
    }

    /// 尝试重连
    async fn try_reconnect(
        &self,
        _connection_id: &str,
        config: &SessionConfig,
    ) -> Result<HandleController, String> {
        // 转换 SessionConfig 到 SshConfig
        let ssh_config = SshConfig {
            host: config.host.clone(),
            port: config.port,
            username: config.username.clone(),
            auth: match &config.auth {
                AuthMethod::Password { password } => SshAuthMethod::Password(password.clone()),
                AuthMethod::Key {
                    key_path,
                    passphrase,
                } => SshAuthMethod::Key {
                    key_path: key_path.clone(),
                    passphrase: passphrase.clone(),
                },
                AuthMethod::Agent => SshAuthMethod::Agent,
            },
            timeout_secs: 30,
            cols: config.cols,
            rows: config.rows,
            proxy_chain: None,
            strict_host_key_checking: false,
        };

        // 尝试建立新连接
        let client = SshClient::new(ssh_config);
        let session = client
            .connect()
            .await
            .map_err(|e| e.to_string())?;

        // 启动 Handle Owner Task
        let handle_controller = session.start(_connection_id.to_string());

        Ok(handle_controller)
    }

    /// 广播连接状态变更事件
    async fn emit_connection_status_changed(&self, connection_id: &str, status: &str) {
        let app_handle = self.app_handle.read().await;
        if let Some(handle) = app_handle.as_ref() {
            use tauri::Emitter;
            
            #[derive(Clone, serde::Serialize)]
            struct ConnectionStatusEvent {
                connection_id: String,
                status: String,
            }

            let event = ConnectionStatusEvent {
                connection_id: connection_id.to_string(),
                status: status.to_string(),
            };

            if let Err(e) = handle.emit("connection_status_changed", event) {
                error!("Failed to emit connection_status_changed: {}", e);
            } else {
                debug!("Emitted connection_status_changed: {} -> {}", connection_id, status);
            }
        }
    }

    /// 替换连接的 HandleController（用于重连后更新）
    async fn replace_handle_controller(&self, connection_id: &str, new_controller: HandleController) {
        if let Some(entry) = self.connections.get(connection_id) {
            let old_entry = entry.value();
            
            // 创建新的连接条目，复用旧条目的元数据
            let new_entry = Arc::new(ConnectionEntry {
                id: old_entry.id.clone(),
                config: old_entry.config.clone(),
                handle_controller: new_controller,
                state: RwLock::new(ConnectionState::Active),
                ref_count: AtomicU32::new(old_entry.ref_count.load(Ordering::SeqCst)),
                last_active: AtomicU64::new(Utc::now().timestamp() as u64),
                keep_alive: RwLock::new(*old_entry.keep_alive.read().await),
                created_at: old_entry.created_at,
                idle_timer: Mutex::new(None),
                terminal_ids: RwLock::new(old_entry.terminal_ids.read().await.clone()),
                sftp_session_id: RwLock::new(old_entry.sftp_session_id.read().await.clone()),
                forward_ids: RwLock::new(old_entry.forward_ids.read().await.clone()),
                heartbeat_task: Mutex::new(None),
                heartbeat_failures: AtomicU32::new(0),
                reconnect_task: Mutex::new(None),
                is_reconnecting: AtomicBool::new(false),
                reconnect_attempts: AtomicU32::new(0),
            });
            
            drop(entry); // 释放引用
            
            // 替换条目
            self.connections.insert(connection_id.to_string(), new_entry);
            
            info!("Connection {} HandleController replaced after reconnect", connection_id);
        }
    }

    /// 广播连接重连成功事件（通知前端恢复 Shell 和 Forward）
    async fn emit_connection_reconnected(
        &self,
        connection_id: &str,
        terminal_ids: Vec<String>,
        forward_ids: Vec<String>,
    ) {
        let app_handle = self.app_handle.read().await;
        if let Some(handle) = app_handle.as_ref() {
            use tauri::Emitter;
            
            #[derive(Clone, serde::Serialize)]
            struct ConnectionReconnectedEvent {
                connection_id: String,
                terminal_ids: Vec<String>,
                forward_ids: Vec<String>,
            }

            let event = ConnectionReconnectedEvent {
                connection_id: connection_id.to_string(),
                terminal_ids,
                forward_ids,
            };

            if let Err(e) = handle.emit("connection_reconnected", event) {
                error!("Failed to emit connection_reconnected: {}", e);
            } else {
                info!("Emitted connection_reconnected for {}", connection_id);
            }
        }
    }

    /// 获取连接条目（用于外部访问）
    pub fn get_connection(&self, connection_id: &str) -> Option<Arc<ConnectionEntry>> {
        self.connections.get(connection_id).map(|e| e.value().clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_connection_pool_config_default() {
        let config = ConnectionPoolConfig::default();
        assert_eq!(config.idle_timeout_secs, 30 * 60);
        assert_eq!(config.max_connections, 0);
        assert!(config.protect_on_exit);
    }

    #[tokio::test]
    async fn test_ref_count() {
        let entry = ConnectionEntry {
            id: "test".to_string(),
            config: SessionConfig {
                host: "localhost".to_string(),
                port: 22,
                username: "user".to_string(),
                auth: AuthMethod::Password {
                    password: "pass".to_string(),
                },
                name: None,
                color: None,
                cols: 80,
                rows: 24,
            },
            handle_controller: {
                // 创建一个 mock controller
                let (tx, _rx) = tokio::sync::mpsc::channel(1);
                HandleController::new(tx)
            },
            state: RwLock::new(ConnectionState::Active),
            ref_count: AtomicU32::new(0),
            last_active: AtomicU64::new(0),
            keep_alive: RwLock::new(false),
            created_at: Utc::now(),
            idle_timer: Mutex::new(None),
            terminal_ids: RwLock::new(Vec::new()),
            sftp_session_id: RwLock::new(None),
            forward_ids: RwLock::new(Vec::new()),
            heartbeat_task: Mutex::new(None),
            heartbeat_failures: AtomicU32::new(0),
            reconnect_task: Mutex::new(None),
            is_reconnecting: AtomicBool::new(false),
            reconnect_attempts: AtomicU32::new(0),
        };

        assert_eq!(entry.ref_count(), 0);
        assert_eq!(entry.add_ref(), 1);
        assert_eq!(entry.add_ref(), 2);
        assert_eq!(entry.release(), 1);
        assert_eq!(entry.release(), 0);
    }
}
