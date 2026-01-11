//! SSH module - handles SSH connections and sessions
//! 
//! This module provides the core SSH functionality using russh library.

mod client;
mod session;
mod config;
mod error;

pub use client::{SshClient, ClientHandler};
pub use session::{SshSession, SessionHandle, ExtendedSessionHandle, SessionCommand};
pub use config::{SshConfig, AuthMethod};
pub use error::SshError;
