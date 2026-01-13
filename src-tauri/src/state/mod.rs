//! State persistence using redb + bincode
//! Handles session metadata and forward rules persistence

pub mod store;
pub mod session;
pub mod forwarding;

pub use store::{StateStore, StateError};
pub use session::PersistedSession;
pub use forwarding::PersistedForward;
