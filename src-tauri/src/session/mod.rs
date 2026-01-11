//! Session Management Module
//!
//! Provides a global session registry with:
//! - State machine for session lifecycle
//! - Concurrent connection limiting
//! - Thread-safe session access via DashMap

mod registry;
mod state;
mod types;
pub mod auth;

pub use registry::{SessionRegistry, RegistryError};
pub use state::{SessionState, SessionStateMachine};
pub use types::{SessionConfig, SessionEntry, SessionStats, SessionInfo, AuthMethod};
pub use auth::{KeyAuth, load_private_key};
