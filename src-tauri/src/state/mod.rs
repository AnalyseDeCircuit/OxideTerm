//! State persistence using redb + bincode
//! Handles session metadata and forward rules persistence

pub mod forwarding;
pub mod session;
pub mod store;

pub use forwarding::PersistedForward;
pub use session::PersistedSession;
pub use store::{StateError, StateStore};
