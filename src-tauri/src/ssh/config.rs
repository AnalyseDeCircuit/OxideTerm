//! SSH Configuration

use serde::{Deserialize, Serialize};

/// SSH connection configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConfig {
    /// Remote host address
    pub host: String,
    
    /// SSH port (default: 22)
    #[serde(default = "default_port")]
    pub port: u16,
    
    /// Username for authentication
    pub username: String,
    
    /// Authentication method
    pub auth: AuthMethod,
    
    /// Connection timeout in seconds
    #[serde(default = "default_timeout")]
    pub timeout_secs: u64,
    
    /// Terminal columns
    #[serde(default = "default_cols")]
    pub cols: u32,
    
    /// Terminal rows
    #[serde(default = "default_rows")]
    pub rows: u32,
}

/// Authentication methods supported
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum AuthMethod {
    /// Password authentication
    Password(String),
    
    /// SSH key authentication
    Key {
        /// Path to private key file
        key_path: String,
        /// Optional passphrase for encrypted keys
        passphrase: Option<String>,
    },
    
    /// SSH agent authentication
    Agent,
}

fn default_port() -> u16 {
    22
}

fn default_timeout() -> u64 {
    30
}

fn default_cols() -> u32 {
    80
}

fn default_rows() -> u32 {
    24
}

impl Default for SshConfig {
    fn default() -> Self {
        Self {
            host: String::new(),
            port: 22,
            username: String::new(),
            auth: AuthMethod::Password(String::new()),
            timeout_secs: 30,
            cols: 80,
            rows: 24,
        }
    }
}
