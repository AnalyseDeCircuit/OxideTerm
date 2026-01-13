//! Session Management Module
//!
//! Provides a global session registry with:
//! - State machine for session lifecycle
//! - Concurrent connection limiting
//! - Thread-safe session access via DashMap
//! - Silent reconnection with exponential backoff
//! - Connection health monitoring

mod registry;
mod state;
pub mod types;
mod reconnect;
mod health;
pub mod auth;

pub use registry::{SessionRegistry, RegistryError};
pub use state::{SessionState, SessionStateMachine};
pub use types::{SessionConfig, SessionEntry, SessionStats, SessionInfo, AuthMethod};
pub use auth::{KeyAuth, load_private_key};
pub use reconnect::{SessionReconnector, ReconnectConfig, ReconnectState, ReconnectEvent, ReconnectError};
pub use health::{HealthTracker, HealthStatus, HealthMetrics, HealthThresholds, QuickHealthCheck};
