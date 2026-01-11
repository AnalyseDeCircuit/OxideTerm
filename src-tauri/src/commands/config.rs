//! Configuration Commands
//!
//! Tauri commands for managing saved connections and SSH config import.

use crate::config::{
    ConfigFile, ConfigStorage, Keychain, SavedAuth, SavedConnection, SshConfigHost,
    parse_ssh_config, default_ssh_config_path,
};
use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Arc;
use parking_lot::RwLock;

/// Shared config state
pub struct ConfigState {
    storage: ConfigStorage,
    config: RwLock<ConfigFile>,
    keychain: Keychain,
}

impl ConfigState {
    /// Create new config state, loading from disk
    pub async fn new() -> Result<Self, String> {
        let storage = ConfigStorage::new().map_err(|e| e.to_string())?;
        let config = storage.load().await.map_err(|e| e.to_string())?;
        
        Ok(Self {
            storage,
            config: RwLock::new(config),
            keychain: Keychain::new(),
        })
    }
    
    /// Save config to disk
    async fn save(&self) -> Result<(), String> {
        let config = self.config.read().clone();
        self.storage.save(&config).await.map_err(|e| e.to_string())
    }
}

/// Connection info for frontend (without sensitive data)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionInfo {
    pub id: String,
    pub name: String,
    pub group: Option<String>,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: String, // "password", "key", "agent"
    pub key_path: Option<String>,
    pub created_at: String,
    pub last_used_at: Option<String>,
    pub color: Option<String>,
    pub tags: Vec<String>,
}

impl From<&SavedConnection> for ConnectionInfo {
    fn from(conn: &SavedConnection) -> Self {
        let (auth_type, key_path) = match &conn.auth {
            SavedAuth::Password { .. } => ("password".to_string(), None),
            SavedAuth::Key { key_path, .. } => ("key".to_string(), Some(key_path.clone())),
            SavedAuth::Agent => ("agent".to_string(), None),
        };
        
        Self {
            id: conn.id.clone(),
            name: conn.name.clone(),
            group: conn.group.clone(),
            host: conn.host.clone(),
            port: conn.port,
            username: conn.username.clone(),
            auth_type,
            key_path,
            created_at: conn.created_at.to_rfc3339(),
            last_used_at: conn.last_used_at.map(|t| t.to_rfc3339()),
            color: conn.color.clone(),
            tags: conn.tags.clone(),
        }
    }
}

/// Request to create/update a connection
#[derive(Debug, Clone, Deserialize)]
pub struct SaveConnectionRequest {
    pub id: Option<String>, // None = create new, Some = update
    pub name: String,
    pub group: Option<String>,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: String, // "password", "key", "agent"
    pub password: Option<String>, // Only for password auth
    pub key_path: Option<String>, // Only for key auth
    pub color: Option<String>,
    pub tags: Vec<String>,
}

/// SSH config host info for frontend
#[derive(Debug, Clone, Serialize)]
pub struct SshHostInfo {
    pub alias: String,
    pub hostname: String,
    pub user: Option<String>,
    pub port: u16,
    pub identity_file: Option<String>,
}

impl From<&SshConfigHost> for SshHostInfo {
    fn from(host: &SshConfigHost) -> Self {
        Self {
            alias: host.alias.clone(),
            hostname: host.effective_hostname().to_string(),
            user: host.user.clone(),
            port: host.effective_port(),
            identity_file: host.identity_file.clone(),
        }
    }
}

// =============================================================================
// Tauri Commands
// =============================================================================

/// Get all saved connections
#[tauri::command]
pub async fn get_connections(
    state: State<'_, Arc<ConfigState>>,
) -> Result<Vec<ConnectionInfo>, String> {
    let config = state.config.read();
    Ok(config.connections.iter().map(ConnectionInfo::from).collect())
}

/// Get recent connections
#[tauri::command]
pub async fn get_recent_connections(
    state: State<'_, Arc<ConfigState>>,
    limit: Option<usize>,
) -> Result<Vec<ConnectionInfo>, String> {
    let config = state.config.read();
    let limit = limit.unwrap_or(5);
    Ok(config.get_recent(limit).into_iter().map(ConnectionInfo::from).collect())
}

/// Get connections by group
#[tauri::command]
pub async fn get_connections_by_group(
    state: State<'_, Arc<ConfigState>>,
    group: Option<String>,
) -> Result<Vec<ConnectionInfo>, String> {
    let config = state.config.read();
    Ok(config
        .get_by_group(group.as_deref())
        .into_iter()
        .map(ConnectionInfo::from)
        .collect())
}

/// Search connections
#[tauri::command]
pub async fn search_connections(
    state: State<'_, Arc<ConfigState>>,
    query: String,
) -> Result<Vec<ConnectionInfo>, String> {
    let config = state.config.read();
    Ok(config.search(&query).into_iter().map(ConnectionInfo::from).collect())
}

/// Get all groups
#[tauri::command]
pub async fn get_groups(
    state: State<'_, Arc<ConfigState>>,
) -> Result<Vec<String>, String> {
    let config = state.config.read();
    Ok(config.groups.clone())
}

/// Save (create or update) a connection
#[tauri::command]
pub async fn save_connection(
    state: State<'_, Arc<ConfigState>>,
    request: SaveConnectionRequest,
) -> Result<ConnectionInfo, String> {
    // Handle auth
    let auth = match request.auth_type.as_str() {
        "password" => {
            let password = request.password.ok_or("Password required for password auth")?;
            let keychain_id = state.keychain.store_new(&password).map_err(|e| e.to_string())?;
            SavedAuth::Password { keychain_id }
        }
        "key" => {
            let key_path = request.key_path.ok_or("Key path required for key auth")?;
            SavedAuth::Key {
                key_path,
                has_passphrase: false,
                passphrase_keychain_id: None,
            }
        }
        "agent" => SavedAuth::Agent,
        _ => return Err(format!("Unknown auth type: {}", request.auth_type)),
    };
    
    let connection = {
        let mut config = state.config.write();
        
        let connection = if let Some(id) = request.id {
            // Update existing
            let conn = config.get_connection_mut(&id).ok_or("Connection not found")?;
            
            // If auth changed and was password, delete old keychain entry
            if let SavedAuth::Password { keychain_id } = &conn.auth {
                if !matches!(&auth, SavedAuth::Password { keychain_id: new_id } if new_id == keychain_id) {
                    let _ = state.keychain.delete(keychain_id);
                }
            }
            
            conn.name = request.name;
            conn.group = request.group;
            conn.host = request.host;
            conn.port = request.port;
            conn.username = request.username;
            conn.auth = auth;
            conn.color = request.color;
            conn.tags = request.tags;
            
            conn.clone()
        } else {
            // Create new
            let mut conn = match &auth {
                SavedAuth::Password { keychain_id } => {
                    SavedConnection::new_password(
                        request.name,
                        request.host,
                        request.port,
                        request.username,
                        keychain_id.clone(),
                    )
                }
                SavedAuth::Key { key_path, .. } => {
                    SavedConnection::new_key(
                        request.name,
                        request.host,
                        request.port,
                        request.username,
                        key_path.clone(),
                    )
                }
                SavedAuth::Agent => {
                    let mut c = SavedConnection::new_key(
                        request.name,
                        request.host,
                        request.port,
                        request.username,
                        "",
                    );
                    c.auth = SavedAuth::Agent;
                    c
                }
            };
            
            conn.group = request.group;
            conn.color = request.color;
            conn.tags = request.tags;
            
            config.add_connection(conn.clone());
            conn
        };
        
        // Add group if new
        if let Some(ref group) = connection.group {
            if !config.groups.contains(group) {
                config.groups.push(group.clone());
            }
        }
        
        connection
    }; // config lock dropped here
    
    state.save().await?;
    
    Ok(ConnectionInfo::from(&connection))
}

/// Delete a connection
#[tauri::command]
pub async fn delete_connection(
    state: State<'_, Arc<ConfigState>>,
    id: String,
) -> Result<(), String> {
    {
        let mut config = state.config.write();
        
        // Delete keychain entry if password auth
        if let Some(conn) = config.get_connection(&id) {
            if let SavedAuth::Password { keychain_id } = &conn.auth {
                let _ = state.keychain.delete(keychain_id);
            }
        }
        
        config.remove_connection(&id).ok_or("Connection not found")?;
    } // config lock dropped here
    
    state.save().await?;
    
    Ok(())
}

/// Mark connection as used (update last_used_at and recent list)
#[tauri::command]
pub async fn mark_connection_used(
    state: State<'_, Arc<ConfigState>>,
    id: String,
) -> Result<(), String> {
    {
        let mut config = state.config.write();
        config.mark_used(&id);
    }
    state.save().await?;
    Ok(())
}

/// Get password for a connection (from keychain)
#[tauri::command]
pub async fn get_connection_password(
    state: State<'_, Arc<ConfigState>>,
    id: String,
) -> Result<String, String> {
    let config = state.config.read();
    let conn = config.get_connection(&id).ok_or("Connection not found")?;
    
    match &conn.auth {
        SavedAuth::Password { keychain_id } => {
            state.keychain.get(keychain_id).map_err(|e| e.to_string())
        }
        _ => Err("Connection does not use password auth".to_string()),
    }
}

/// Import hosts from SSH config
#[tauri::command]
pub async fn list_ssh_config_hosts() -> Result<Vec<SshHostInfo>, String> {
    let hosts = parse_ssh_config(None).await.map_err(|e| e.to_string())?;
    Ok(hosts.iter().map(SshHostInfo::from).collect())
}

/// Import a single SSH config host as a saved connection
#[tauri::command]
pub async fn import_ssh_host(
    state: State<'_, Arc<ConfigState>>,
    alias: String,
) -> Result<ConnectionInfo, String> {
    // Parse SSH config
    let hosts = parse_ssh_config(None).await.map_err(|e| e.to_string())?;
    let host = hosts.iter().find(|h| h.alias == alias)
        .ok_or_else(|| format!("Host '{}' not found in SSH config", alias))?;
    
    // Create connection
    let auth = if let Some(ref key_path) = host.identity_file {
        SavedAuth::Key {
            key_path: key_path.clone(),
            has_passphrase: false,
            passphrase_keychain_id: None,
        }
    } else {
        SavedAuth::Agent
    };
    
    let username = host.user.clone().unwrap_or_else(|| whoami::username());
    
    let conn = SavedConnection {
        id: uuid::Uuid::new_v4().to_string(),
        version: crate::config::CONFIG_VERSION,
        name: alias.clone(),
        group: Some("Imported".to_string()),
        host: host.effective_hostname().to_string(),
        port: host.effective_port(),
        username,
        auth,
        options: Default::default(),
        created_at: chrono::Utc::now(),
        last_used_at: None,
        color: None,
        tags: vec!["ssh-config".to_string()],
    };
    
    {
        let mut config = state.config.write();
        config.add_connection(conn.clone());
        
        if !config.groups.contains(&"Imported".to_string()) {
            config.groups.push("Imported".to_string());
        }
    } // config lock dropped here
    
    state.save().await?;
    
    Ok(ConnectionInfo::from(&conn))
}

/// Get SSH config file path
#[tauri::command]
pub async fn get_ssh_config_path() -> Result<String, String> {
    default_ssh_config_path()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

/// Create groups
#[tauri::command]
pub async fn create_group(
    state: State<'_, Arc<ConfigState>>,
    name: String,
) -> Result<(), String> {
    {
        let mut config = state.config.write();
        if !config.groups.contains(&name) {
            config.groups.push(name);
        }
    }
    state.save().await?;
    Ok(())
}

/// Delete a group (moves connections to ungrouped)
#[tauri::command]
pub async fn delete_group(
    state: State<'_, Arc<ConfigState>>,
    name: String,
) -> Result<(), String> {
    {
        let mut config = state.config.write();
        config.groups.retain(|g| g != &name);
        
        // Move connections to ungrouped
        for conn in &mut config.connections {
            if conn.group.as_ref() == Some(&name) {
                conn.group = None;
            }
        }
    }
    state.save().await?;
    Ok(())
}
