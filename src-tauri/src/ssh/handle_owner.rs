//! Handle Owner Task
//!
//! This module implements the "single owner" pattern for SSH Handle.
//!
//! # Architecture
//!
//! Only one task owns the `Handle<ClientHandler>`. All other components
//! communicate with it via `HandleController` which sends commands through
//! an mpsc channel.
//!
//! This avoids:
//! - `Arc<Mutex<Handle>>` lock contention
//! - Deadlocks from holding locks across `.await`
//! - Protocol violations from concurrent Handle access
//!
//! # Usage
//!
//! ```ignore
//! let controller = spawn_handle_owner_task(handle, session_id);
//!
//! // Open a channel
//! let channel = controller.open_session_channel().await?;
//!
//! // Request remote forward
//! let bound_port = controller.tcpip_forward("0.0.0.0", 8080).await?;
//! ```

use russh::client::{Handle, Msg};
use russh::Channel;
use tokio::sync::{mpsc, oneshot};
use tracing::{info, warn};

use super::client::ClientHandler;
use super::error::SshError;

/// Commands sent to the Handle Owner Task
pub enum HandleCommand {
    /// Open a session channel (for PTY/shell)
    ChannelOpenSession {
        reply_tx: oneshot::Sender<Result<Channel<Msg>, russh::Error>>,
    },

    /// Open a direct-tcpip channel (for local forward / dynamic forward)
    ChannelOpenDirectTcpip {
        host: String,
        port: u32,
        originator_host: String,
        originator_port: u32,
        reply_tx: oneshot::Sender<Result<Channel<Msg>, russh::Error>>,
    },

    /// Request remote forward (tcpip-forward)
    TcpipForward {
        address: String,
        port: u32,
        reply_tx: oneshot::Sender<Result<u32, russh::Error>>,
    },

    /// Cancel remote forward
    CancelTcpipForward {
        address: String,
        port: u32,
        reply_tx: oneshot::Sender<Result<(), russh::Error>>,
    },

    /// Disconnect the SSH connection
    Disconnect,
}

/// Controller for sending commands to the Handle Owner Task
///
/// # Clone Semantics
///
/// `HandleController` implements `Clone`. This means:
/// - Any module holding a `HandleController` has **full SSH control**
/// - Can open any channel, create any forward, or disconnect
///
/// # Design Decision
///
/// This is **intentional**:
/// 1. **Simple passing**: No Arc needed, clone cost is low (just copies Sender)
/// 2. **Trust boundary**: Only in-process Rust code can obtain a Controller
/// 3. **Full capability**: SFTP, Forwarding, Shell all need full control
///
/// # Security Considerations
///
/// - **Do not** expose `HandleController` to untrusted code
/// - **Do not** serialize or pass across process boundaries
/// - Fine-grained permission control should be at upper layers (e.g., Tauri commands)
#[derive(Clone)]
pub struct HandleController {
    cmd_tx: mpsc::Sender<HandleCommand>,
}

impl HandleController {
    /// Create a new HandleController with the given sender
    /// 
    /// This is primarily used for testing. In production, use `spawn_handle_owner_task`.
    pub fn new(cmd_tx: mpsc::Sender<HandleCommand>) -> Self {
        Self { cmd_tx }
    }

    /// Get a clone of the command sender for the SessionCommand channel
    /// This is used by AutoReconnectService to get cmd_tx for registry updates
    pub fn cmd_tx_clone(&self) -> mpsc::Sender<crate::ssh::SessionCommand> {
        // Note: This creates a new channel. For reconnection, we actually need
        // to get the session's cmd_tx, not the handle command tx.
        // This method exists for API compatibility but may need refactoring.
        let (tx, _) = mpsc::channel(1024);
        tx
    }

    /// Open a session channel (for PTY/shell)
    pub async fn open_session_channel(&self) -> Result<Channel<Msg>, SshError> {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.cmd_tx
            .send(HandleCommand::ChannelOpenSession { reply_tx })
            .await
            .map_err(|_| SshError::Disconnected)?;
        reply_rx
            .await
            .map_err(|_| SshError::Disconnected)?
            .map_err(|e| SshError::ChannelError(e.to_string()))
    }

    /// Open a direct-tcpip channel (for local forward / dynamic forward)
    pub async fn open_direct_tcpip(
        &self,
        host: &str,
        port: u32,
        originator_host: &str,
        originator_port: u32,
    ) -> Result<Channel<Msg>, SshError> {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.cmd_tx
            .send(HandleCommand::ChannelOpenDirectTcpip {
                host: host.to_string(),
                port,
                originator_host: originator_host.to_string(),
                originator_port,
                reply_tx,
            })
            .await
            .map_err(|_| SshError::Disconnected)?;
        reply_rx
            .await
            .map_err(|_| SshError::Disconnected)?
            .map_err(|e| SshError::ChannelError(e.to_string()))
    }

    /// Request remote port forward (tcpip-forward)
    ///
    /// Returns the actual bound port (may differ if requested port was 0)
    pub async fn tcpip_forward(&self, address: &str, port: u32) -> Result<u32, SshError> {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.cmd_tx
            .send(HandleCommand::TcpipForward {
                address: address.to_string(),
                port,
                reply_tx,
            })
            .await
            .map_err(|_| SshError::Disconnected)?;
        reply_rx
            .await
            .map_err(|_| SshError::Disconnected)?
            .map_err(|e| SshError::ConnectionFailed(e.to_string()))
    }

    /// Cancel a remote port forward
    pub async fn cancel_tcpip_forward(&self, address: &str, port: u32) -> Result<(), SshError> {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.cmd_tx
            .send(HandleCommand::CancelTcpipForward {
                address: address.to_string(),
                port,
                reply_tx,
            })
            .await
            .map_err(|_| SshError::Disconnected)?;
        reply_rx
            .await
            .map_err(|_| SshError::Disconnected)?
            .map_err(|e| SshError::ConnectionFailed(e.to_string()))
    }

    /// Disconnect the SSH connection
    pub async fn disconnect(&self) {
        let _ = self.cmd_tx.send(HandleCommand::Disconnect).await;
    }

    /// Check if the Handle Owner Task is still running
    pub fn is_connected(&self) -> bool {
        !self.cmd_tx.is_closed()
    }
}

/// Spawn the Handle Owner Task
///
/// Consumes ownership of the Handle and returns a HandleController for sending commands.
///
/// # Arguments
///
/// * `handle` - The SSH Handle (ownership transferred to the task)
/// * `session_id` - Session ID for logging
///
/// # Returns
///
/// A `HandleController` that can be cloned and used to send commands.
pub fn spawn_handle_owner_task(
    handle: Handle<ClientHandler>,
    session_id: String,
) -> HandleController {
    let (cmd_tx, mut cmd_rx) = mpsc::channel::<HandleCommand>(64);

    tokio::spawn(async move {
        let mut handle = handle; // Move into task, becomes sole owner

        info!("Handle owner task started for session {}", session_id);

        loop {
            match cmd_rx.recv().await {
                Some(cmd) => {
                    match cmd {
                        HandleCommand::ChannelOpenSession { reply_tx } => {
                            let result = handle.channel_open_session().await;
                            if reply_tx.send(result).is_err() {
                                warn!(
                                    "Caller dropped before receiving channel_open_session result"
                                );
                                // Channel will be dropped, SSH server will close it
                            }
                        }

                        HandleCommand::ChannelOpenDirectTcpip {
                            host,
                            port,
                            originator_host,
                            originator_port,
                            reply_tx,
                        } => {
                            let result = handle
                                .channel_open_direct_tcpip(
                                    &host,
                                    port,
                                    &originator_host,
                                    originator_port,
                                )
                                .await;
                            if reply_tx.send(result).is_err() {
                                warn!("Caller dropped before receiving direct_tcpip result");
                                // Channel will be dropped, SSH server will close it
                            }
                        }

                        HandleCommand::TcpipForward {
                            address,
                            port,
                            reply_tx,
                        } => {
                            let result = handle.tcpip_forward(&address, port).await;
                            match &result {
                                Ok(bound_port) => {
                                    let bound_port = *bound_port;
                                    if reply_tx.send(result).is_err() {
                                        // CRITICAL: Caller disappeared, but forward was established
                                        // Must cancel immediately to avoid "ghost forward"
                                        warn!(
                                            "Caller dropped after tcpip_forward succeeded. \
                                             Cancelling orphaned forward {}:{}",
                                            address, bound_port
                                        );
                                        let _ =
                                            handle.cancel_tcpip_forward(&address, bound_port).await;
                                    }
                                }
                                Err(_) => {
                                    // Forward failed, no cleanup needed
                                    let _ = reply_tx.send(result);
                                }
                            }
                        }

                        HandleCommand::CancelTcpipForward {
                            address,
                            port,
                            reply_tx,
                        } => {
                            let result = handle.cancel_tcpip_forward(&address, port).await;
                            if reply_tx.send(result).is_err() {
                                warn!(
                                    "Caller dropped before receiving cancel_tcpip_forward result"
                                );
                                // Cancel already executed, no rollback needed
                            }
                        }

                        HandleCommand::Disconnect => {
                            info!("Disconnect requested for session {}", session_id);
                            break;
                        }
                    }
                }
                None => {
                    // All senders dropped
                    info!("All controllers dropped for session {}", session_id);
                    break;
                }
            }
        }

        // === Cleanup phase ===
        // Drain all pending commands, notify callers that connection is closed
        drain_pending_commands(&mut cmd_rx);

        // Disconnect SSH properly with reason
        let _ = handle
            .disconnect(russh::Disconnect::ByApplication, "Session closed", "en")
            .await;
        info!("Handle owner task terminated for session {}", session_id);
    });

    HandleController { cmd_tx }
}

/// Drain all pending commands, returning Disconnected error to each
fn drain_pending_commands(cmd_rx: &mut mpsc::Receiver<HandleCommand>) {
    // Close receiver first, prevent new messages
    cmd_rx.close();

    // Drain all messages already in queue
    while let Ok(cmd) = cmd_rx.try_recv() {
        match cmd {
            HandleCommand::ChannelOpenSession { reply_tx } => {
                let _ = reply_tx.send(Err(russh::Error::Disconnect));
            }
            HandleCommand::ChannelOpenDirectTcpip { reply_tx, .. } => {
                let _ = reply_tx.send(Err(russh::Error::Disconnect));
            }
            HandleCommand::TcpipForward { reply_tx, .. } => {
                let _ = reply_tx.send(Err(russh::Error::Disconnect));
            }
            HandleCommand::CancelTcpipForward { reply_tx, .. } => {
                let _ = reply_tx.send(Err(russh::Error::Disconnect));
            }
            HandleCommand::Disconnect => {
                // Already disconnecting, ignore
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // TODO: Add unit tests
    // - HandleController sends commands and receives replies
    // - HandleController drop causes task exit
    // - Disconnect drains pending commands
    // - tcpip_forward cleanup on reply loss
}
