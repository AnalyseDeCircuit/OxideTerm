//! Port Forwarding Module
//!
//! Provides local, remote, and dynamic port forwarding for SSH connections.
//! Designed for HPC/supercomputing workflows (Jupyter, TensorBoard, etc.)

mod local;
pub mod remote;
mod dynamic;
pub mod manager;

pub use local::{LocalForward, LocalForwardHandle, start_local_forward};
pub use remote::{RemoteForward, RemoteForwardHandle, start_remote_forward, RemoteForwardRegistry};
pub use dynamic::{DynamicForward, DynamicForwardHandle, start_dynamic_forward};
pub use manager::{ForwardingManager, ForwardRule, ForwardRuleUpdate, ForwardStatus, ForwardType, ForwardStats};
