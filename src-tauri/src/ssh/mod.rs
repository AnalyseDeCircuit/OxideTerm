//! SSH module - handles SSH connections and sessions
//!
//! This module provides the core SSH functionality using russh library.
//!
//! # Features
//! - Direct SSH connections
//! - ProxyJump (jump host) support for HPC environments
//! - Port forwarding (local, remote, dynamic)
//! - SSH config file parsing

mod client;
mod config;
mod error;
mod handle_owner;
mod proxy;
mod session;

pub use client::{ClientHandler, SshClient};
pub use config::{AuthMethod, ProxyHopConfig, SshConfig};
pub use error::SshError;
pub use handle_owner::{spawn_handle_owner_task, HandleCommand, HandleController};
pub use proxy::{connect_via_proxy, connect_via_single_hop, ProxyChain, ProxyConnection, ProxyHop};
pub use session::{ExtendedSessionHandle, SessionCommand, SessionHandle, SshSession};
