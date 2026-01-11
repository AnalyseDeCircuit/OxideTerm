//! ProxyJump Implementation for SSH
//!
//! Implements SSH connection through jump hosts (bastion hosts).
//! Supports single-hop proxy for HPC/supercomputing scenarios.

use std::net::ToSocketAddrs;
use std::sync::Arc;
use std::time::Duration;

use russh::client::{self, Handle};
use tracing::{debug, info, warn};

use super::client::ClientHandler;
use super::config::AuthMethod;
use super::error::SshError;

/// Proxy hop configuration
#[derive(Debug, Clone)]
pub struct ProxyHop {
    /// Hostname of the jump host
    pub host: String,
    /// Port of the jump host (default: 22)
    pub port: u16,
    /// Username for authentication
    pub username: String,
    /// Authentication method
    pub auth: AuthMethod,
}

impl ProxyHop {
    /// Create a new proxy hop with password authentication
    pub fn with_password(host: impl Into<String>, username: impl Into<String>, password: impl Into<String>) -> Self {
        Self {
            host: host.into(),
            port: 22,
            username: username.into(),
            auth: AuthMethod::Password(password.into()),
        }
    }
    
    /// Create a new proxy hop with key authentication
    pub fn with_key(host: impl Into<String>, username: impl Into<String>, key_path: impl Into<String>) -> Self {
        Self {
            host: host.into(),
            port: 22,
            username: username.into(),
            auth: AuthMethod::Key { key_path: key_path.into(), passphrase: None },
        }
    }
    
    /// Set custom port
    pub fn port(mut self, port: u16) -> Self {
        self.port = port;
        self
    }
}

/// Proxy chain for multi-hop SSH connections
#[derive(Debug, Clone, Default)]
pub struct ProxyChain {
    /// List of jump hosts (in order)
    pub hops: Vec<ProxyHop>,
}

impl ProxyChain {
    /// Create an empty proxy chain
    pub fn new() -> Self {
        Self { hops: Vec::new() }
    }
    
    /// Add a hop to the chain
    pub fn add_hop(mut self, hop: ProxyHop) -> Self {
        self.hops.push(hop);
        self
    }
    
    /// Check if the chain is empty
    pub fn is_empty(&self) -> bool {
        self.hops.is_empty()
    }
    
    /// Get the number of hops
    pub fn len(&self) -> usize {
        self.hops.len()
    }
    
    /// Get the first hop
    pub fn first(&self) -> Option<&ProxyHop> {
        self.hops.first()
    }
}

/// Result of a proxy connection, containing the jump host handle and
/// an open channel to the target.
pub struct ProxyConnection {
    /// Handle to the jump host SSH session
    pub jump_handle: Handle<ClientHandler>,
    /// Direct-tcpip channel to the final target
    pub channel: russh::Channel<russh::client::Msg>,
}

/// Connect directly to a single SSH host (internal helper)
async fn direct_connect(hop: &ProxyHop, timeout_secs: u64) -> Result<Handle<ClientHandler>, SshError> {
    let addr = format!("{}:{}", hop.host, hop.port);
    let socket_addr = addr
        .to_socket_addrs()
        .map_err(|e| SshError::ConnectionFailed(format!("Failed to resolve {}: {}", addr, e)))?
        .next()
        .ok_or_else(|| SshError::ConnectionFailed(format!("No address found for {}", addr)))?;
    
    info!("Connecting to jump host at {}", addr);
    
    // Create SSH config with keepalive
    let ssh_config = client::Config {
        inactivity_timeout: Some(Duration::from_secs(300)),
        keepalive_interval: Some(Duration::from_secs(30)),
        keepalive_max: 3,
        ..Default::default()
    };
    
    let handler = ClientHandler;
    
    // Connect with timeout
    let mut handle = tokio::time::timeout(
        Duration::from_secs(timeout_secs),
        client::connect(Arc::new(ssh_config), socket_addr, handler),
    )
    .await
    .map_err(|_| SshError::Timeout(format!("Connection to {} timed out", addr)))?
    .map_err(|e| SshError::ConnectionFailed(e.to_string()))?;
    
    debug!("SSH handshake with jump host completed");
    
    // Authenticate
    let authenticated = match &hop.auth {
        AuthMethod::Password(password) => {
            info!("Authenticating to jump host with password");
            handle
                .authenticate_password(&hop.username, password)
                .await
                .map_err(|e| SshError::AuthenticationFailed(e.to_string()))?
        }
        AuthMethod::Key { key_path, passphrase } => {
            info!("Authenticating to jump host with key: {}", key_path);
            let key = russh_keys::load_secret_key(key_path, passphrase.as_deref())
                .map_err(|e| SshError::KeyError(e.to_string()))?;
            
            handle
                .authenticate_publickey(&hop.username, Arc::new(key))
                .await
                .map_err(|e| SshError::AuthenticationFailed(e.to_string()))?
        }
        AuthMethod::Agent => {
            return Err(SshError::AuthenticationFailed(
                "SSH agent authentication not yet supported for proxy hops".into(),
            ));
        }
    };
    
    if !authenticated {
        return Err(SshError::AuthenticationFailed(
            format!("Authentication to {} rejected", hop.host),
        ));
    }
    
    info!("Authenticated to jump host {}", hop.host);
    Ok(handle)
}

/// Connect to a target host through a single jump host (ProxyJump)
/// 
/// This is the main entry point for single-hop proxy connections.
/// It returns a ProxyConnection that contains:
/// - The handle to the jump host (for cleanup)
/// - An open channel to the target (for SSH-over-SSH)
pub async fn connect_via_single_hop(
    jump_host: &ProxyHop,
    target_host: &str,
    target_port: u16,
    timeout_secs: u64,
) -> Result<ProxyConnection, SshError> {
    info!(
        "Connecting to {}:{} via jump host {}:{}",
        target_host, target_port, jump_host.host, jump_host.port
    );
    
    // Step 1: Connect to the jump host
    let jump_handle = direct_connect(jump_host, timeout_secs).await?;
    
    // Step 2: Open direct-tcpip channel to target
    info!("Opening direct-tcpip channel to {}:{}", target_host, target_port);
    
    let channel = jump_handle
        .channel_open_direct_tcpip(
            target_host,
            target_port as u32,
            "127.0.0.1",  // originator address (not used by most servers)
            0,            // originator port (not used by most servers)
        )
        .await
        .map_err(|e| SshError::ConnectionFailed(format!(
            "Failed to open channel to {}:{}: {}", 
            target_host, target_port, e
        )))?;
    
    info!("Direct-tcpip channel opened to {}:{}", target_host, target_port);
    
    Ok(ProxyConnection {
        jump_handle,
        channel,
    })
}

/// Connect through a proxy chain (multi-hop)
/// 
/// For multi-hop scenarios, we currently only support the first hop
/// and require SSH agent forwarding or pre-configured keys on jump hosts
/// for subsequent hops.
pub async fn connect_via_proxy(
    chain: &ProxyChain,
    target_host: &str,
    target_port: u16,
    timeout_secs: u64,
) -> Result<ProxyConnection, SshError> {
    if chain.is_empty() {
        return Err(SshError::ConnectionFailed(
            "Proxy chain is empty".into(),
        ));
    }
    
    if chain.len() > 1 {
        warn!(
            "Multi-hop proxy chain detected ({} hops). Only single-hop is fully supported. \
             Configure SSH agent forwarding on jump hosts for multi-hop scenarios.",
            chain.len()
        );
    }
    
    // Use the first hop as the jump host
    let jump_host = chain.first().unwrap();
    connect_via_single_hop(jump_host, target_host, target_port, timeout_secs).await
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_proxy_chain_builder() {
        let chain = ProxyChain::new()
            .add_hop(ProxyHop::with_password("jump1.example.com", "user1", "pass1"))
            .add_hop(ProxyHop::with_key("jump2.example.com", "user2", "~/.ssh/id_rsa").port(2222));
        
        assert_eq!(chain.len(), 2);
        assert_eq!(chain.hops[0].host, "jump1.example.com");
        assert_eq!(chain.hops[1].port, 2222);
    }
    
    #[test]
    fn test_proxy_hop_with_password() {
        let hop = ProxyHop::with_password("bastion.example.com", "admin", "secret123");
        
        assert_eq!(hop.host, "bastion.example.com");
        assert_eq!(hop.username, "admin");
        assert_eq!(hop.port, 22);
        match hop.auth {
            AuthMethod::Password(p) => assert_eq!(p, "secret123"),
            _ => panic!("Expected password auth"),
        }
    }
    
    #[test]
    fn test_proxy_hop_with_key() {
        let hop = ProxyHop::with_key("bastion.example.com", "admin", "~/.ssh/id_ed25519").port(22);
        
        assert_eq!(hop.host, "bastion.example.com");
        assert_eq!(hop.username, "admin");
        assert_eq!(hop.port, 22);
        match hop.auth {
            AuthMethod::Key { key_path, passphrase } => {
                assert_eq!(key_path, "~/.ssh/id_ed25519");
                assert!(passphrase.is_none());
            }
            _ => panic!("Expected key auth"),
        }
    }
    
    #[test]
    fn test_empty_proxy_chain() {
        let chain = ProxyChain::new();
        assert!(chain.is_empty());
        assert_eq!(chain.len(), 0);
        assert!(chain.first().is_none());
    }
}
