//! Session Events Module
//!
//! Defines Tauri events for session state changes, reconnection progress,
//! and network status. These events are emitted from the backend and
//! listened to by the frontend.

use serde::{Deserialize, Serialize};

/// Event payload for session disconnection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionDisconnectedPayload {
    pub session_id: String,
    pub reason: String,
    pub recoverable: bool,
}

/// Event payload for reconnection progress
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionReconnectingPayload {
    pub session_id: String,
    pub attempt: u32,
    pub max_attempts: u32,
    pub delay_ms: u64,
    pub next_attempt_at: Option<u64>, // Unix timestamp in milliseconds
}

/// Event payload for successful reconnection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionReconnectedPayload {
    pub session_id: String,
    pub attempt: u32,
}

/// Event payload for failed reconnection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionReconnectFailedPayload {
    pub session_id: String,
    pub total_attempts: u32,
    pub error: String,
}

/// Event payload for reconnection cancelled
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionReconnectCancelledPayload {
    pub session_id: String,
}

/// Event names as constants
pub mod event_names {
    /// Session disconnected (triggers reconnect flow)
    pub const SESSION_DISCONNECTED: &str = "session:disconnected";
    /// Reconnection in progress
    pub const SESSION_RECONNECTING: &str = "session:reconnecting";
    /// Reconnection successful
    pub const SESSION_RECONNECTED: &str = "session:reconnected";
    /// Reconnection failed (all attempts exhausted)
    pub const SESSION_RECONNECT_FAILED: &str = "session:reconnect_failed";
    /// Reconnection cancelled by user
    pub const SESSION_RECONNECT_CANCELLED: &str = "session:reconnect_cancelled";
    /// Network status changed
    pub const NETWORK_STATUS_CHANGED: &str = "network:status_changed";
}

/// Network status payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkStatusPayload {
    pub online: bool,
}
