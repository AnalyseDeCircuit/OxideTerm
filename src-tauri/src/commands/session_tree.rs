//! Session Tree Commands
//!
//! Tauri commands for managing the dynamic jump host session tree.

use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::sync::RwLock;

use crate::session::tree::{FlatNode, NodeConnection, NodeOrigin, NodeState, SessionTree};
use crate::session::types::SessionConfig;
use crate::session::AuthMethod;
use crate::ssh::SshConnectionRegistry;

/// Session Tree 状态（全局单例）
pub struct SessionTreeState {
    pub tree: RwLock<SessionTree>,
}

impl Default for SessionTreeState {
    fn default() -> Self {
        Self::new()
    }
}

impl SessionTreeState {
    pub fn new() -> Self {
        Self {
            tree: RwLock::new(SessionTree::new()),
        }
    }
}

// ============================================================================
// Request/Response Types
// ============================================================================

/// 连接请求
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectServerRequest {
    pub host: String,
    pub port: u16,
    pub username: String,
    #[serde(default = "default_auth_type")]
    pub auth_type: String,
    pub password: Option<String>,
    pub key_path: Option<String>,
    pub passphrase: Option<String>,
    pub display_name: Option<String>,
}

fn default_auth_type() -> String {
    "agent".to_string()
}

/// 钻入请求
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DrillDownRequest {
    pub parent_node_id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    #[serde(default = "default_auth_type")]
    pub auth_type: String,
    pub password: Option<String>,
    pub key_path: Option<String>,
    pub passphrase: Option<String>,
    pub display_name: Option<String>,
}

/// 预设链连接请求
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectPresetChainRequest {
    pub saved_connection_id: String,
    pub hops: Vec<HopInfo>,
    pub target: HopInfo,
}

/// 跳板机信息
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HopInfo {
    pub host: String,
    pub port: u16,
    pub username: String,
    #[serde(default = "default_auth_type")]
    pub auth_type: String,
    pub password: Option<String>,
    pub key_path: Option<String>,
    pub passphrase: Option<String>,
}

/// 会话树摘要信息
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionTreeSummary {
    pub total_nodes: usize,
    pub root_count: usize,
    pub connected_count: usize,
    pub max_depth: u32,
}

// ============================================================================
// Helper Functions
// ============================================================================

fn build_auth(
    auth_type: &str,
    password: Option<String>,
    key_path: Option<String>,
    passphrase: Option<String>,
) -> Result<AuthMethod, String> {
    match auth_type {
        "password" => {
            let pwd = password.ok_or("Password required for password authentication")?;
            Ok(AuthMethod::Password { password: pwd })
        }
        "key" => {
            let path = key_path.ok_or("Key path required for key authentication")?;
            Ok(AuthMethod::Key {
                key_path: path,
                passphrase,
            })
        }
        "agent" => Ok(AuthMethod::Agent),
        _ => Err(format!("Unknown auth type: {}", auth_type)),
    }
}

fn build_connection(
    host: String,
    port: u16,
    username: String,
    auth: AuthMethod,
    display_name: Option<String>,
) -> NodeConnection {
    let mut conn = NodeConnection::new(host, port, username);
    conn.auth = auth;
    conn.display_name = display_name;
    conn
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// 获取扁平化的会话树（用于前端渲染）
#[tauri::command]
pub async fn get_session_tree(
    state: State<'_, Arc<SessionTreeState>>,
) -> Result<Vec<FlatNode>, String> {
    let tree = state.tree.read().await;
    Ok(tree.flatten())
}

/// 获取会话树摘要信息
#[tauri::command]
pub async fn get_session_tree_summary(
    state: State<'_, Arc<SessionTreeState>>,
) -> Result<SessionTreeSummary, String> {
    let tree = state.tree.read().await;
    let flat = tree.flatten();
    
    let connected_count = flat.iter().filter(|n| {
        matches!(n.state, crate::session::tree::FlatNodeState::Connected)
    }).count();
    
    let max_depth = flat.iter().map(|n| n.depth).max().unwrap_or(0);
    
    Ok(SessionTreeSummary {
        total_nodes: tree.len(),
        root_count: tree.root_nodes().len(),
        connected_count,
        max_depth,
    })
}

/// 添加直连节点（depth=0）
/// 
/// 注意：此命令仅在树中添加节点，不建立实际 SSH 连接。
/// 实际连接由 `connect_tree_node` 命令完成。
#[tauri::command]
pub async fn add_root_node(
    state: State<'_, Arc<SessionTreeState>>,
    request: ConnectServerRequest,
) -> Result<String, String> {
    let auth = build_auth(
        &request.auth_type,
        request.password,
        request.key_path,
        request.passphrase,
    )?;
    
    let connection = build_connection(
        request.host,
        request.port,
        request.username,
        auth,
        request.display_name,
    );
    
    let mut tree = state.tree.write().await;
    let node_id = tree.add_root_node(connection, NodeOrigin::Direct);
    
    tracing::info!("Added root node: {}", node_id);
    Ok(node_id)
}

/// 从已连接节点钻入新服务器（模式3: 动态钻入）
/// 
/// 注意：此命令仅在树中添加子节点，不建立实际 SSH 连接。
/// 实际连接由 `connect_tree_node` 命令完成。
#[tauri::command]
pub async fn tree_drill_down(
    state: State<'_, Arc<SessionTreeState>>,
    request: DrillDownRequest,
) -> Result<String, String> {
    let auth = build_auth(
        &request.auth_type,
        request.password,
        request.key_path,
        request.passphrase,
    )?;
    
    let connection = build_connection(
        request.host,
        request.port,
        request.username,
        auth,
        request.display_name,
    );
    
    let mut tree = state.tree.write().await;
    let node_id = tree.drill_down(&request.parent_node_id, connection)
        .map_err(|e| e.to_string())?;
    
    tracing::info!("Drilled down from {} to new node {}", request.parent_node_id, node_id);
    Ok(node_id)
}

/// 展开静态手工预设链（模式1）
/// 
/// 将 proxy_chain 配置展开为树节点。
#[tauri::command]
pub async fn expand_manual_preset(
    state: State<'_, Arc<SessionTreeState>>,
    request: ConnectPresetChainRequest,
) -> Result<String, String> {
    let mut hops = Vec::new();
    for hop in &request.hops {
        let auth = build_auth(&hop.auth_type, hop.password.clone(), hop.key_path.clone(), hop.passphrase.clone())?;
        hops.push(build_connection(hop.host.clone(), hop.port, hop.username.clone(), auth, None));
    }
    
    let target_auth = build_auth(
        &request.target.auth_type,
        request.target.password.clone(),
        request.target.key_path.clone(),
        request.target.passphrase.clone(),
    )?;
    let target = build_connection(
        request.target.host.clone(),
        request.target.port,
        request.target.username.clone(),
        target_auth,
        None,
    );
    
    let mut tree = state.tree.write().await;
    let target_id = tree.expand_manual_preset(&request.saved_connection_id, hops, target)
        .map_err(|e| e.to_string())?;
    
    tracing::info!("Expanded manual preset chain, target node: {}", target_id);
    Ok(target_id)
}

/// 更新节点状态
#[tauri::command]
pub async fn update_tree_node_state(
    state: State<'_, Arc<SessionTreeState>>,
    node_id: String,
    new_state: String,
    error: Option<String>,
) -> Result<(), String> {
    let node_state = match new_state.as_str() {
        "pending" => NodeState::Pending,
        "connecting" => NodeState::Connecting,
        "connected" => NodeState::Connected,
        "disconnected" => NodeState::Disconnected,
        "failed" => NodeState::Failed {
            error: error.unwrap_or_else(|| "Unknown error".to_string()),
        },
        _ => return Err(format!("Unknown state: {}", new_state)),
    };
    
    let mut tree = state.tree.write().await;
    tree.update_state(&node_id, node_state)
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

/// 关联 SSH 连接 ID 到节点
#[tauri::command]
pub async fn set_tree_node_connection(
    state: State<'_, Arc<SessionTreeState>>,
    node_id: String,
    connection_id: String,
) -> Result<(), String> {
    let mut tree = state.tree.write().await;
    tree.set_ssh_connection_id(&node_id, connection_id)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 关联终端会话 ID 到节点
#[tauri::command]
pub async fn set_tree_node_terminal(
    state: State<'_, Arc<SessionTreeState>>,
    node_id: String,
    session_id: String,
) -> Result<(), String> {
    let mut tree = state.tree.write().await;
    tree.set_terminal_session_id(&node_id, session_id)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 关联 SFTP 会话 ID 到节点
#[tauri::command]
pub async fn set_tree_node_sftp(
    state: State<'_, Arc<SessionTreeState>>,
    node_id: String,
    session_id: String,
) -> Result<(), String> {
    let mut tree = state.tree.write().await;
    tree.set_sftp_session_id(&node_id, session_id)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 移除节点（递归移除所有子节点）
/// 
/// 此命令会：
/// 1. 收集要移除的节点及其关联的 SSH 连接 ID
/// 2. 断开所有关联的 SSH 连接（从 ConnectionRegistry 中移除）
/// 3. 从会话树中移除节点
/// 
/// 这确保了节点删除后不会有残留的连接在 Registry 中继续运行心跳/重连
#[tauri::command]
pub async fn remove_tree_node(
    state: State<'_, Arc<SessionTreeState>>,
    connection_registry: State<'_, Arc<SshConnectionRegistry>>,
    node_id: String,
) -> Result<Vec<String>, String> {
    // 1. 收集要移除的节点及其 connection_id（先不从树中移除）
    let nodes_to_remove: Vec<(String, Option<String>)> = {
        let tree = state.tree.read().await;
        
        fn collect_subtree(
            tree: &SessionTree, 
            node_id: &str, 
            result: &mut Vec<(String, Option<String>)>
        ) {
            if let Some(node) = tree.get_node(node_id) {
                // 先处理子节点（自底向上的顺序收集）
                for child_id in &node.children_ids {
                    collect_subtree(tree, child_id, result);
                }
                // 最后处理自己
                result.push((node_id.to_string(), node.ssh_connection_id.clone()));
            }
        }
        
        let mut nodes = Vec::new();
        collect_subtree(&tree, &node_id, &mut nodes);
        nodes
    };
    
    if nodes_to_remove.is_empty() {
        return Err(format!("Node not found: {}", node_id));
    }
    
    // 2. 断开所有关联的 SSH 连接（自底向上，先断子连接再断父连接）
    for (nid, ssh_id) in &nodes_to_remove {
        if let Some(ssh_connection_id) = ssh_id {
            tracing::info!(
                "Disconnecting SSH connection {} for node {} before removal", 
                ssh_connection_id, 
                nid
            );
            if let Err(e) = connection_registry.disconnect(ssh_connection_id).await {
                // 只记录警告，不中断删除流程（连接可能已经断开）
                tracing::warn!(
                    "Failed to disconnect SSH connection {} for node {}: {}", 
                    ssh_connection_id, 
                    nid, 
                    e
                );
            }
        }
    }
    
    // 3. 从树中移除节点
    let mut tree = state.tree.write().await;
    let removed = tree.remove_node(&node_id)
        .map_err(|e| e.to_string())?;
    
    tracing::info!(
        "Removed {} nodes starting from {} (connections cleaned up)", 
        removed.len(), 
        node_id
    );
    Ok(removed)
}

/// 获取节点详情
#[tauri::command]
pub async fn get_tree_node(
    state: State<'_, Arc<SessionTreeState>>,
    node_id: String,
) -> Result<Option<FlatNode>, String> {
    let tree = state.tree.read().await;
    
    if let Some(node) = tree.get_node(&node_id) {
        // 判断是否是最后一个子节点
        let is_last = if let Some(ref parent_id) = node.parent_id {
            tree.get_node(parent_id)
                .map(|p| p.children_ids.last() == Some(&node_id))
                .unwrap_or(true)
        } else {
            true
        };
        
        Ok(Some(FlatNode::from_node(node, is_last)))
    } else {
        Ok(None)
    }
}

/// 获取节点到根的完整路径
#[tauri::command]
pub async fn get_tree_node_path(
    state: State<'_, Arc<SessionTreeState>>,
    node_id: String,
) -> Result<Vec<FlatNode>, String> {
    let tree = state.tree.read().await;
    
    let path = tree.get_path_to_node(&node_id);
    let path_len = path.len();
    let flat_path: Vec<FlatNode> = path.into_iter().enumerate().map(|(i, node)| {
        // 最后一个节点（目标节点）标记为 is_last_child
        FlatNode::from_node(node, i == path_len - 1)
    }).collect();
    
    Ok(flat_path)
}

/// 清空会话树
#[tauri::command]
pub async fn clear_session_tree(
    state: State<'_, Arc<SessionTreeState>>,
) -> Result<(), String> {
    let mut tree = state.tree.write().await;
    *tree = SessionTree::new();
    tracing::info!("Session tree cleared");
    Ok(())
}

/// 连接会话树节点请求
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectTreeNodeRequest {
    pub node_id: String,
    /// 终端宽度
    #[serde(default = "default_cols")]
    pub cols: u32,
    /// 终端高度
    #[serde(default = "default_rows")]
    pub rows: u32,
}

fn default_cols() -> u32 { 80 }
fn default_rows() -> u32 { 24 }

/// 连接会话树节点响应
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectTreeNodeResponse {
    pub node_id: String,
    pub ssh_connection_id: String,
    pub parent_connection_id: Option<String>,
}

/// 连接会话树中的节点
/// 
/// 此命令负责建立实际的 SSH 连接：
/// - 对于根节点（depth=0），直接建立 SSH 连接
/// - 对于子节点（depth>0），通过父节点的隧道建立连接
#[tauri::command]
pub async fn connect_tree_node(
    state: State<'_, Arc<SessionTreeState>>,
    connection_registry: State<'_, Arc<SshConnectionRegistry>>,
    request: ConnectTreeNodeRequest,
) -> Result<ConnectTreeNodeResponse, String> {
    let node_id = request.node_id.clone();
    
    // 1. 获取节点信息并构建 SessionConfig
    let (session_config, parent_node_id) = {
        let tree = state.tree.read().await;
        let node = tree.get_node(&node_id)
            .ok_or_else(|| format!("Node not found: {}", node_id))?;
        
        // 确保节点状态允许连接
        match &node.state {
            NodeState::Pending | NodeState::Disconnected => {}
            NodeState::Failed { .. } => {}
            NodeState::Connecting => {
                return Err(format!("Node {} is already connecting", node_id));
            }
            NodeState::Connected => {
                return Err(format!("Node {} is already connected", node_id));
            }
        }
        
        // 构建 SessionConfig
        let config = SessionConfig {
            host: node.connection.host.clone(),
            port: node.connection.port,
            username: node.connection.username.clone(),
            auth: node.connection.auth.clone(),
            name: node.connection.display_name.clone(),
            color: None,
            cols: request.cols,
            rows: request.rows,
        };
        
        (config, node.parent_id.clone())
    };
    
    // 2. 更新节点状态为 Connecting
    {
        let mut tree = state.tree.write().await;
        tree.update_state(&node_id, NodeState::Connecting)
            .map_err(|e| e.to_string())?;
    }
    
    // 3. 根据是否有父节点决定连接方式
    let connect_result = if let Some(ref parent_id) = parent_node_id {
        // 有父节点 - 先获取父节点的 SSH 连接 ID
        let parent_ssh_id = {
            let tree = state.tree.read().await;
            let parent_node = tree.get_node(parent_id)
                .ok_or_else(|| format!("Parent node not found: {}", parent_id))?;
            
            parent_node.ssh_connection_id.clone()
                .ok_or_else(|| format!("Parent node {} has no SSH connection", parent_id))?
        };
        
        // 通过父连接建立隧道连接
        tracing::info!(
            "Connecting node {} via tunnel from parent {} (ssh_id: {})",
            node_id, parent_id, parent_ssh_id
        );
        
        connection_registry
            .establish_tunneled_connection(&parent_ssh_id, session_config)
            .await
            .map(|id| (id, Some(parent_ssh_id)))
            .map_err(|e| e.to_string())
    } else {
        // 无父节点 - 直接连接
        tracing::info!("Connecting root node {} directly", node_id);
        
        connection_registry
            .connect(session_config)
            .await
            .map(|id| (id, None))
            .map_err(|e| e.to_string())
    };
    
    // 4. 根据连接结果更新节点状态
    match connect_result {
        Ok((ssh_connection_id, parent_connection_id)) => {
            let mut tree = state.tree.write().await;
            
            // 更新状态为已连接
            tree.update_state(&node_id, NodeState::Connected)
                .map_err(|e| e.to_string())?;
            
            // 关联 SSH 连接 ID
            tree.set_ssh_connection_id(&node_id, ssh_connection_id.clone())
                .map_err(|e| e.to_string())?;
            
            tracing::info!(
                "Node {} connected with ssh_id: {}, parent_ssh_id: {:?}",
                node_id, ssh_connection_id, parent_connection_id
            );
            
            Ok(ConnectTreeNodeResponse {
                node_id,
                ssh_connection_id,
                parent_connection_id,
            })
        }
        Err(e) => {
            let mut tree = state.tree.write().await;
            
            // 更新状态为失败
            tree.update_state(&node_id, NodeState::Failed { error: e.clone() })
                .map_err(|err| err.to_string())?;
            
            tracing::error!("Failed to connect node {}: {}", node_id, e);
            Err(e)
        }
    }
}

/// 断开会话树节点
/// 
/// 断开节点的 SSH 连接，并递归断开所有子节点
#[tauri::command]
pub async fn disconnect_tree_node(
    state: State<'_, Arc<SessionTreeState>>,
    connection_registry: State<'_, Arc<SshConnectionRegistry>>,
    node_id: String,
) -> Result<Vec<String>, String> {
    // 1. 收集需要断开的节点（自底向上的顺序）
    let nodes_to_disconnect: Vec<(String, Option<String>)> = {
        let tree = state.tree.read().await;
        
        // 获取从此节点开始的所有子树节点
        fn collect_subtree(tree: &SessionTree, node_id: &str, result: &mut Vec<(String, Option<String>)>) {
            if let Some(node) = tree.get_node(node_id) {
                // 先处理所有子节点
                for child_id in &node.children_ids {
                    collect_subtree(tree, child_id, result);
                }
                // 最后处理自己
                result.push((node_id.to_string(), node.ssh_connection_id.clone()));
            }
        }
        
        let mut nodes = Vec::new();
        collect_subtree(&tree, &node_id, &mut nodes);
        nodes
    };
    
    if nodes_to_disconnect.is_empty() {
        return Err(format!("Node not found: {}", node_id));
    }
    
    let mut disconnected_ids = Vec::new();
    
    // 2. 按顺序断开连接（先子节点，后父节点）
    for (nid, ssh_id) in nodes_to_disconnect {
        if let Some(ssh_connection_id) = ssh_id {
            // 断开 SSH 连接
            if let Err(e) = connection_registry.disconnect(&ssh_connection_id).await {
                tracing::warn!("Failed to disconnect SSH connection {}: {}", ssh_connection_id, e);
            }
        }
        
        // 更新节点状态和清除所有会话元数据
        let mut tree = state.tree.write().await;
        if let Err(e) = tree.update_state(&nid, NodeState::Disconnected) {
            tracing::warn!("Failed to update node {} state: {}", nid, e);
        }
        
        // 清除所有关联的会话 ID
        if let Some(node) = tree.get_node_mut(&nid) {
            node.ssh_connection_id = None;
            node.terminal_session_id = None;
            node.sftp_session_id = None;
        }
        
        disconnected_ids.push(nid);
    }
    
    tracing::info!("Disconnected {} nodes starting from {}", disconnected_ids.len(), node_id);
    Ok(disconnected_ids)
}

/// 连接预设的手工跳板链（模式1: 静态全手工）
/// 
/// 此命令会：
/// 1. 展开 proxy_chain 为树节点
/// 2. 按顺序从根到叶建立 SSH 连接
/// 3. 返回目标节点的连接信息
#[tauri::command]
pub async fn connect_manual_preset(
    state: State<'_, Arc<SessionTreeState>>,
    connection_registry: State<'_, Arc<SshConnectionRegistry>>,
    request: ConnectPresetChainRequest,
    #[allow(unused)] cols: Option<u32>,
    #[allow(unused)] rows: Option<u32>,
) -> Result<ConnectManualPresetResponse, String> {
    let cols = cols.unwrap_or(80);
    let rows = rows.unwrap_or(24);
    
    // 1. 构建连接信息
    let mut hops = Vec::new();
    for hop in &request.hops {
        let auth = build_auth(&hop.auth_type, hop.password.clone(), hop.key_path.clone(), hop.passphrase.clone())?;
        hops.push(build_connection(hop.host.clone(), hop.port, hop.username.clone(), auth, None));
    }
    
    let target_auth = build_auth(
        &request.target.auth_type,
        request.target.password.clone(),
        request.target.key_path.clone(),
        request.target.passphrase.clone(),
    )?;
    let target = build_connection(
        request.target.host.clone(),
        request.target.port,
        request.target.username.clone(),
        target_auth,
        None,
    );
    
    // 2. 展开为树节点
    let target_node_id = {
        let mut tree = state.tree.write().await;
        tree.expand_manual_preset(&request.saved_connection_id, hops, target)
            .map_err(|e| e.to_string())?
    };
    
    tracing::info!(
        "Expanded manual preset chain '{}', target node: {}",
        request.saved_connection_id,
        target_node_id
    );
    
    // 3. 收集从根到目标的路径
    let path_node_ids: Vec<String> = {
        let tree = state.tree.read().await;
        tree.get_path_to_node(&target_node_id)
            .iter()
            .map(|n| n.id.clone())
            .collect()
    };
    
    if path_node_ids.is_empty() {
        return Err("Failed to get path to target node".to_string());
    }
    
    tracing::info!(
        "Connecting {} nodes in chain: {:?}",
        path_node_ids.len(),
        path_node_ids
    );
    
    // 4. 按顺序连接每个节点
    let mut connected_node_ids = Vec::new();
    let mut last_error: Option<String> = None;
    
    for node_id in &path_node_ids {
        // 获取节点信息并构建 SessionConfig
        let (session_config, parent_ssh_id) = {
            let tree = state.tree.read().await;
            let node = tree.get_node(node_id)
                .ok_or_else(|| format!("Node not found: {}", node_id))?;
            
            let config = SessionConfig {
                host: node.connection.host.clone(),
                port: node.connection.port,
                username: node.connection.username.clone(),
                auth: node.connection.auth.clone(),
                name: node.connection.display_name.clone(),
                color: None,
                cols,
                rows,
            };
            
            // 获取父节点的 SSH 连接 ID（如果有）
            let parent_ssh_id = if let Some(ref parent_id) = node.parent_id {
                tree.get_node(parent_id)
                    .and_then(|p| p.ssh_connection_id.clone())
            } else {
                None
            };
            
            (config, parent_ssh_id)
        };
        
        // 更新节点状态为 Connecting
        {
            let mut tree = state.tree.write().await;
            tree.update_state(node_id, NodeState::Connecting)
                .map_err(|e| e.to_string())?;
        }
        
        // 建立连接
        let connect_result = if let Some(parent_ssh_id) = parent_ssh_id {
            // 通过父连接隧道
            tracing::info!("Connecting node {} via tunnel from {}", node_id, parent_ssh_id);
            connection_registry
                .establish_tunneled_connection(&parent_ssh_id, session_config)
                .await
                .map_err(|e| e.to_string())
        } else {
            // 直连（第一跳）
            tracing::info!("Connecting root node {} directly", node_id);
            connection_registry
                .connect(session_config)
                .await
                .map_err(|e| e.to_string())
        };
        
        match connect_result {
            Ok(ssh_connection_id) => {
                let mut tree = state.tree.write().await;
                tree.update_state(node_id, NodeState::Connected)
                    .map_err(|e| e.to_string())?;
                tree.set_ssh_connection_id(node_id, ssh_connection_id.clone())
                    .map_err(|e| e.to_string())?;
                
                connected_node_ids.push(node_id.clone());
                tracing::info!("Node {} connected with ssh_id: {}", node_id, ssh_connection_id);
            }
            Err(e) => {
                let mut tree = state.tree.write().await;
                tree.update_state(node_id, NodeState::Failed { error: e.clone() })
                    .map_err(|err| err.to_string())?;
                
                tracing::error!("Failed to connect node {}: {}", node_id, e);
                last_error = Some(e);
                break; // 链中任何一环失败则停止
            }
        }
    }
    
    // 5. 检查是否全部连接成功
    if let Some(error) = last_error {
        // 回滚：断开已连接的节点（逆序）
        for node_id in connected_node_ids.iter().rev() {
            let ssh_id = {
                let tree = state.tree.read().await;
                tree.get_node(node_id)
                    .and_then(|n| n.ssh_connection_id.clone())
            };
            
            if let Some(ssh_connection_id) = ssh_id {
                if let Err(e) = connection_registry.disconnect(&ssh_connection_id).await {
                    tracing::warn!("Failed to rollback connection {}: {}", ssh_connection_id, e);
                }
            }
            
            let mut tree = state.tree.write().await;
            let _ = tree.update_state(node_id, NodeState::Disconnected);
            if let Some(node) = tree.get_node_mut(node_id) {
                node.ssh_connection_id = None;
            }
        }
        
        return Err(format!("Chain connection failed: {}", error));
    }
    
    // 6. 获取目标节点的最终信息
    let target_ssh_id = {
        let tree = state.tree.read().await;
        tree.get_node(&target_node_id)
            .and_then(|n| n.ssh_connection_id.clone())
            .ok_or_else(|| "Target node has no SSH connection".to_string())?
    };
    
    tracing::info!(
        "Manual preset chain '{}' connected successfully. Target: {} (ssh_id: {})",
        request.saved_connection_id,
        target_node_id,
        target_ssh_id
    );
    
    Ok(ConnectManualPresetResponse {
        target_node_id,
        target_ssh_connection_id: target_ssh_id,
        connected_node_ids,
        chain_depth: path_node_ids.len() as u32,
    })
}

/// 连接手工预设响应
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectManualPresetResponse {
    /// 目标节点 ID
    pub target_node_id: String,
    /// 目标节点的 SSH 连接 ID
    pub target_ssh_connection_id: String,
    /// 所有已连接的节点 ID（从根到目标）
    pub connected_node_ids: Vec<String>,
    /// 链的深度（跳板数量 + 1）
    pub chain_depth: u32,
}

// ============================================================================
// Auto-Route Commands (Mode 2: Static Auto-Route)
// ============================================================================

use crate::session::topology_graph::{NetworkTopology, TopologyNodeInfo, TopologyEdge, TopologyEdgesConfig};
use super::config::ConfigState;

/// Get topology nodes (auto-generated from saved connections)
#[tauri::command]
pub async fn get_topology_nodes(
    config_state: State<'_, Arc<ConfigState>>,
) -> Result<Vec<TopologyNodeInfo>, String> {
    // Load saved connections from config snapshot
    let config = config_state.get_config_snapshot();
    let connections = &config.connections;
    
    // Build topology from connections
    let topology = NetworkTopology::build_from_connections(connections);
    
    Ok(topology.get_all_nodes())
}

/// Get topology edges
#[tauri::command]
pub async fn get_topology_edges(
    config_state: State<'_, Arc<ConfigState>>,
) -> Result<Vec<TopologyEdge>, String> {
    let config = config_state.get_config_snapshot();
    let connections = &config.connections;
    let topology = NetworkTopology::build_from_connections(connections);
    Ok(topology.get_all_edges())
}

/// Get custom edges overlay config
#[tauri::command]
pub async fn get_topology_edges_overlay() -> Result<TopologyEdgesConfig, String> {
    Ok(NetworkTopology::get_edges_overlay())
}

/// Add a custom edge to topology
#[tauri::command]
pub async fn add_topology_edge(from: String, to: String, cost: Option<i32>) -> Result<(), String> {
    NetworkTopology::add_custom_edge(from, to, cost.unwrap_or(1))
}

/// Remove a custom edge from topology
#[tauri::command]
pub async fn remove_topology_edge(from: String, to: String) -> Result<(), String> {
    NetworkTopology::remove_custom_edge(&from, &to)
}

/// Exclude an auto-generated edge
#[tauri::command]
pub async fn exclude_topology_edge(from: String, to: String) -> Result<(), String> {
    NetworkTopology::exclude_edge(from, to)
}

/// Auto-route expand request
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpandAutoRouteRequest {
    /// Target node ID (topology node id, same as saved connection id)
    pub target_id: String,
    /// Optional display name override
    pub display_name: Option<String>,
}

/// Auto-route expand response
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpandAutoRouteResponse {
    /// Target node ID (in SessionTree)
    pub target_node_id: String,
    /// Computed route path (intermediate hop node IDs)
    pub route: Vec<String>,
    /// Total route cost
    pub total_cost: i32,
    /// All expanded node IDs (from root to target)
    pub all_node_ids: Vec<String>,
}

/// Expand auto-route node chain (Mode 2: Static Auto-Route)
///
/// Auto-computes optimal path to target node and expands SessionTree nodes.
/// 
/// # Workflow
/// 1. Build topology from saved connections
/// 2. Use Dijkstra to compute shortest path
/// 3. Convert path to SessionTree nodes
/// 4. Return expanded node info
#[tauri::command]
pub async fn expand_auto_route(
    state: State<'_, Arc<SessionTreeState>>,
    config_state: State<'_, Arc<ConfigState>>,
    request: ExpandAutoRouteRequest,
) -> Result<ExpandAutoRouteResponse, String> {
    // 1. Build topology from saved connections
    let config = config_state.get_config_snapshot();
    let connections = &config.connections;
    let topology = NetworkTopology::build_from_connections(connections);
    
    // 2. Compute route
    let route_result = topology.compute_route(&request.target_id)?;
    tracing::info!(
        "Auto-route computed: local -> {} -> {} (cost: {})",
        route_result.path.join(" -> "),
        request.target_id,
        route_result.total_cost
    );
    
    // 3. Get target node config
    let target_config = topology.get_node(&request.target_id)
        .ok_or_else(|| format!("Target node '{}' not found", request.target_id))?;
    
    // 4. Build NodeConnection list for path nodes
    let mut hop_connections = Vec::new();
    for hop_id in &route_result.path {
        let hop_config = topology.get_node(hop_id)
            .ok_or_else(|| format!("Hop node '{}' not found", hop_id))?;
        
        let auth = topology_auth_to_session_auth(&hop_config.auth_type, &hop_config.key_path)?;
        let mut conn = NodeConnection::new(
            hop_config.host.clone(),
            hop_config.port,
            hop_config.username.clone(),
        );
        conn.auth = auth;
        conn.display_name = hop_config.display_name.clone();
        hop_connections.push(conn);
    }
    
    // 5. Build target NodeConnection
    let target_auth = topology_auth_to_session_auth(&target_config.auth_type, &target_config.key_path)?;
    let mut target_conn = NodeConnection::new(
        target_config.host.clone(),
        target_config.port,
        target_config.username.clone(),
    );
    target_conn.auth = target_auth;
    target_conn.display_name = request.display_name.or(target_config.display_name.clone());
    
    // 6. Generate route_id
    let route_id = uuid::Uuid::new_v4().to_string();
    
    // 7. Expand to SessionTree
    let mut tree = state.tree.write().await;
    let target_node_id = tree.expand_auto_route(
        &target_config.host,
        &route_id,
        hop_connections,
        target_conn,
    ).map_err(|e| e.to_string())?;
    
    // 8. Collect all node IDs (backtrack from target to root)
    let mut all_node_ids = Vec::new();
    let mut current_id = Some(target_node_id.clone());
    while let Some(id) = current_id {
        all_node_ids.push(id.clone());
        current_id = tree.get_node(&id).and_then(|n| n.parent_id.clone());
    }
    all_node_ids.reverse();
    
    tracing::info!(
        "Auto-route expanded: {} nodes created, target: {}",
        all_node_ids.len(),
        target_node_id
    );
    
    Ok(ExpandAutoRouteResponse {
        target_node_id,
        route: route_result.path,
        total_cost: route_result.total_cost,
        all_node_ids,
    })
}

/// Convert topology auth type to SessionTree auth method
fn topology_auth_to_session_auth(
    auth_type: &str,
    key_path: &Option<String>,
) -> Result<AuthMethod, String> {
    match auth_type {
        "password" => Err("Password authentication requires password which is not stored in topology".to_string()),
        "key" => {
            let path = key_path.clone().ok_or("Key path required for key authentication")?;
            Ok(AuthMethod::Key {
                key_path: path,
                passphrase: None,
            })
        }
        "agent" | _ => Ok(AuthMethod::Agent),
    }
}
