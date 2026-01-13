//! SSH Client implementation using russh

use std::net::ToSocketAddrs;
use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use russh::*;
use russh_keys::PublicKey;
use tracing::{debug, info, warn};

use super::config::{AuthMethod, SshConfig};
use super::error::SshError;
use super::session::SshSession;

/// SSH Client handler for russh
pub struct SshClient {
    config: SshConfig,
}

impl SshClient {
    pub fn new(config: SshConfig) -> Self {
        Self { config }
    }

    /// Connect to the SSH server and return a session
    pub async fn connect(self) -> Result<SshSession, SshError> {
        let addr = format!("{}:{}", self.config.host, self.config.port);

        info!("Connecting to SSH server at {}", addr);

        // Resolve address
        let socket_addr = addr
            .to_socket_addrs()
            .map_err(|e| SshError::ConnectionFailed(format!("Failed to resolve address: {}", e)))?
            .next()
            .ok_or_else(|| SshError::ConnectionFailed("No address found".to_string()))?;

        // Configure SSH client with keepalive
        let ssh_config = client::Config {
            inactivity_timeout: Some(Duration::from_secs(300)), // 5 min inactivity timeout
            keepalive_interval: Some(Duration::from_secs(30)),  // Send keepalive every 30s
            keepalive_max: 3, // Disconnect after 3 missed keepalives (90s total)
            ..Default::default()
        };

        // Create SSH client handler
        let handler = ClientHandler;

        // Connect with timeout
        let mut handle = tokio::time::timeout(
            Duration::from_secs(self.config.timeout_secs),
            client::connect(Arc::new(ssh_config), socket_addr, handler),
        )
        .await
        .map_err(|_| SshError::Timeout("Connection timed out".to_string()))?
        .map_err(|e| SshError::ConnectionFailed(e.to_string()))?;

        debug!("SSH handshake completed");

        // Authenticate
        let authenticated = match &self.config.auth {
            AuthMethod::Password(password) => handle
                .authenticate_password(&self.config.username, password)
                .await
                .map_err(|e| SshError::AuthenticationFailed(e.to_string()))?,
            AuthMethod::Key {
                key_path,
                passphrase,
            } => {
                let key = if let Some(pass) = passphrase {
                    russh_keys::load_secret_key(key_path, Some(pass))
                        .map_err(|e| SshError::KeyError(e.to_string()))?
                } else {
                    russh_keys::load_secret_key(key_path, None)
                        .map_err(|e| SshError::KeyError(e.to_string()))?
                };

                handle
                    .authenticate_publickey(&self.config.username, Arc::new(key))
                    .await
                    .map_err(|e| SshError::AuthenticationFailed(e.to_string()))?
            }
            AuthMethod::Agent => {
                // Agent auth is more complex, simplify for now
                return Err(SshError::AuthenticationFailed(
                    "SSH agent authentication not yet implemented".to_string(),
                ));
            }
        };

        if !authenticated {
            return Err(SshError::AuthenticationFailed(
                "Authentication rejected by server".to_string(),
            ));
        }

        info!("SSH authentication successful");

        // Create session
        Ok(SshSession::new(handle, self.config.cols, self.config.rows))
    }
}

/// Client handler for russh callbacks
///
/// This handler processes server-initiated events, including:
/// - Host key verification
/// - Remote port forwarding (forwarded-tcpip channels)
pub struct ClientHandler;

#[async_trait]
impl client::Handler for ClientHandler {
    type Error = SshError;

    async fn check_server_key(
        &mut self,
        _server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        // In production, implement proper host key verification
        // For now, accept all keys (NOT SAFE FOR PRODUCTION)
        debug!("Server key check - accepting (TODO: implement proper verification)");
        Ok(true)
    }

    /// Called when the server opens a channel for a new remote port forwarding connection.
    /// This happens when someone connects to the forwarded port on the remote server.
    async fn server_channel_open_forwarded_tcpip(
        &mut self,
        channel: Channel<client::Msg>,
        connected_address: &str,
        connected_port: u32,
        originator_address: &str,
        originator_port: u32,
        _session: &mut client::Session,
    ) -> Result<(), Self::Error> {
        info!(
            "Server opened forwarded-tcpip channel: {}:{} from {}:{}",
            connected_address, connected_port, originator_address, originator_port
        );

        // Import the handler function from forwarding module
        use crate::forwarding::remote::handle_forwarded_connection;

        let connected_address = connected_address.to_string();
        let originator_address = originator_address.to_string();

        // Spawn a task to handle this forwarded connection
        // We can't block here as this is called from the SSH event loop
        tokio::spawn(async move {
            if let Err(e) = handle_forwarded_connection(
                channel,
                &connected_address,
                connected_port,
                &originator_address,
                originator_port,
            )
            .await
            {
                warn!(
                    "Failed to handle forwarded connection {}:{}: {}",
                    connected_address, connected_port, e
                );
            }
        });

        Ok(())
    }
}
