//! Session Management Module
//!
//! Provides a global session registry with:
//! - State machine for session lifecycle
//! - Concurrent connection limiting
//! - Thread-safe session access via DashMap
//! - Silent reconnection with exponential backoff
//! - Connection health monitoring
//! - Tauri event emission for frontend state sync

pub mod auth;
pub mod auto_reconnect;
pub mod events;
mod health;
mod reconnect;
mod registry;
mod state;
pub mod types;

pub use auth::{load_private_key, KeyAuth};
pub use auto_reconnect::AutoReconnectService;
pub use events::{
    event_names, NetworkStatusPayload, SessionDisconnectedPayload, SessionReconnectedPayload,
    SessionReconnectFailedPayload, SessionReconnectingPayload,
};
pub use health::{HealthMetrics, HealthStatus, HealthThresholds, HealthTracker, QuickHealthCheck};
pub use reconnect::{
    ReconnectConfig, ReconnectError, ReconnectEvent, ReconnectState, SessionReconnector,
};
pub use registry::{RegistryError, SessionRegistry};
pub use state::{SessionState, SessionStateMachine};
pub use types::{AuthMethod, SessionConfig, SessionEntry, SessionInfo, SessionStats};
