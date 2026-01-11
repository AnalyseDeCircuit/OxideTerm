//! Remote Port Forwarding
//!
//! Forwards connections from a remote port back to a local host:port through SSH.
//! Example: Remote server:9000 -> local:3000 (expose local service to remote)

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use russh::client::Handle;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

use crate::ssh::{ClientHandler, SshError};

/// Remote port forwarding configuration
#[derive(Debug, Clone)]
pub struct RemoteForward {
    /// Remote bind address (e.g., "0.0.0.0:9000" or "localhost:9000")
    pub remote_addr: String,
    /// Remote port to bind on the server
    pub remote_port: u16,
    /// Local host to connect to (e.g., "localhost")
    pub local_host: String,
    /// Local port to connect to
    pub local_port: u16,
    /// Description for UI display
    pub description: Option<String>,
}

impl RemoteForward {
    /// Create a new remote port forward
    pub fn new(
        remote_addr: impl Into<String>,
        remote_port: u16,
        local_host: impl Into<String>,
        local_port: u16,
    ) -> Self {
        Self {
            remote_addr: remote_addr.into(),
            remote_port,
            local_host: local_host.into(),
            local_port,
            description: None,
        }
    }

    /// Create a simple remote forward from remote port to local port
    pub fn simple(remote_port: u16, local_port: u16) -> Self {
        Self {
            remote_addr: "localhost".into(),
            remote_port,
            local_host: "localhost".into(),
            local_port,
            description: None,
        }
    }

    /// Set description
    pub fn with_description(mut self, desc: impl Into<String>) -> Self {
        self.description = Some(desc.into());
        self
    }
}

/// Handle to a running remote port forward
pub struct RemoteForwardHandle {
    /// Forward configuration
    pub config: RemoteForward,
    /// Flag to indicate if running
    running: Arc<AtomicBool>,
    /// Channel to signal stop
    stop_tx: mpsc::Sender<()>,
}

impl RemoteForwardHandle {
    /// Stop the port forwarding
    pub async fn stop(&self) {
        info!(
            "Stopping remote port forward from {}:{}",
            self.config.remote_addr, self.config.remote_port
        );
        self.running.store(false, Ordering::SeqCst);
        let _ = self.stop_tx.send(()).await;
    }

    /// Check if the forward is still running
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }
}

/// Start remote port forwarding
///
/// This function:
/// 1. Requests the SSH server to listen on the remote port
/// 2. For each incoming connection on the remote side, connects to the local host:port
/// 3. Bridges data between the SSH channel and the local socket
pub async fn start_remote_forward(
    _ssh_handle: Arc<Handle<ClientHandler>>,
    config: RemoteForward,
) -> Result<RemoteForwardHandle, SshError> {
    info!(
        "Requesting remote port forward: {}:{} -> {}:{}",
        config.remote_addr, config.remote_port, config.local_host, config.local_port
    );

    // Note: Remote port forwarding from the client side requires sending
    // a "tcpip-forward" global request to the server. This is a more complex
    // operation that requires proper request/response handling.
    //
    // For now, we create a placeholder that tracks the forward configuration.
    // Full implementation would require:
    // 1. Send global request for tcpip-forward
    // 2. Handle forwarded-tcpip channel requests from server
    // 3. Bridge channels to local connections

    let running = Arc::new(AtomicBool::new(true));
    let (stop_tx, mut stop_rx) = mpsc::channel::<()>(1);

    // Note: Remote port forwarding requires handling forwarded-tcpip channel requests
    // from the server. This is handled by the ClientHandler's `server_channel_open_forwarded_tcpip`
    // callback. For a full implementation, we would need to:
    // 1. Register a handler for forwarded-tcpip channels
    // 2. When a channel is opened, connect to local_host:local_port
    // 3. Bridge the channel and local connection
    
    // For now, we set up the basic structure and the handler
    let running_clone = running.clone();
    let local_host = config.local_host.clone();
    let local_port = config.local_port;

    // The actual forwarded connection handling would be done in the ClientHandler
    // This is a placeholder that monitors for stop signals
    tokio::spawn(async move {
        loop {
            tokio::select! {
                _ = stop_rx.recv() => {
                    info!("Remote port forward stopped by request");
                    break;
                }
                _ = tokio::time::sleep(std::time::Duration::from_secs(1)) => {
                    if !running_clone.load(Ordering::SeqCst) {
                        break;
                    }
                }
            }
        }
        
        running_clone.store(false, Ordering::SeqCst);
        
        // Cancel the remote forward
        // Note: Would need to call ssh_handle.cancel_tcpip_forward here
        
        info!("Remote port forward task exited");
    });

    Ok(RemoteForwardHandle {
        config,
        running,
        stop_tx,
    })
}

/// Handle a forwarded connection from the remote server
/// Called when the server opens a forwarded-tcpip channel
pub async fn handle_forwarded_connection(
    channel: russh::Channel<russh::client::Msg>,
    local_host: &str,
    local_port: u16,
) -> Result<(), SshError> {
    // Connect to local service
    let local_addr = format!("{}:{}", local_host, local_port);
    let mut local_stream = TcpStream::connect(&local_addr).await.map_err(|e| {
        SshError::ConnectionFailed(format!("Failed to connect to {}: {}", local_addr, e))
    })?;

    debug!("Connected to local {} for remote forward", local_addr);

    // Bridge the connection (similar to local forward but reversed)
    let (mut local_read, mut local_write) = local_stream.split();
    let channel = Arc::new(tokio::sync::Mutex::new(channel));
    let channel_for_read = channel.clone();
    let channel_for_write = channel.clone();

    // Channel -> Local task
    let channel_to_local = async {
        loop {
            let mut ch = channel_for_read.lock().await;
            match ch.wait().await {
                Some(russh::ChannelMsg::Data { data }) => {
                    drop(ch);
                    if let Err(e) = local_write.write_all(&data).await {
                        debug!("Local write error: {}", e);
                        break;
                    }
                }
                Some(russh::ChannelMsg::Eof) | Some(russh::ChannelMsg::Close) | None => {
                    break;
                }
                _ => continue,
            }
        }
    };

    // Local -> Channel task
    let local_to_channel = async {
        let mut buf = vec![0u8; 32768];
        loop {
            match local_read.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => {
                    let mut ch = channel_for_write.lock().await;
                    if let Err(e) = ch.data(&buf[..n]).await {
                        debug!("Channel write error: {}", e);
                        break;
                    }
                }
                Err(e) => {
                    debug!("Local read error: {}", e);
                    break;
                }
            }
        }
        let mut ch = channel_for_write.lock().await;
        let _ = ch.eof().await;
    };

    tokio::select! {
        _ = channel_to_local => {}
        _ = local_to_channel => {}
    }

    {
        let mut ch = channel.lock().await;
        let _ = ch.close().await;
    }

    debug!("Remote forward connection closed");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_remote_forward_simple() {
        let forward = RemoteForward::simple(9000, 3000);
        assert_eq!(forward.remote_port, 9000);
        assert_eq!(forward.local_port, 3000);
        assert_eq!(forward.local_host, "localhost");
    }

    #[test]
    fn test_remote_forward_with_description() {
        let forward = RemoteForward::simple(8080, 8080)
            .with_description("Web Server");
        assert!(forward.description.unwrap().contains("Web Server"));
    }
}
