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
mod session;
mod config;
mod error;
mod proxy;
mod handle_owner;

pub use client::{SshClient, ClientHandler};
pub use session::{SshSession, SessionHandle, ExtendedSessionHandle, SessionCommand};
pub use config::{SshConfig, AuthMethod, ProxyHopConfig};
pub use error::SshError;
pub use proxy::{ProxyChain, ProxyHop, ProxyConnection, connect_via_proxy, connect_via_single_hop};
pub use handle_owner::{HandleController, HandleCommand, spawn_handle_owner_task};
