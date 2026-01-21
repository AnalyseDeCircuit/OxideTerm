//! State persistence using redb + MessagePack (rmp-serde)
//! Handles session metadata and forward rules persistence

pub mod forwarding;
pub mod session;
pub mod store;

pub use forwarding::PersistedForward;
pub use session::{BufferConfig, PersistedSession, SessionPersistence};
pub use store::{StateError, StateStore};
