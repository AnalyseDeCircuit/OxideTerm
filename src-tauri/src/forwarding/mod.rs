//! Port Forwarding Module
//!
//! Provides local, remote, and dynamic port forwarding for SSH connections.
//! Designed for HPC/supercomputing workflows (Jupyter, TensorBoard, etc.)

mod local;
mod remote;
mod manager;

pub use local::{LocalForward, LocalForwardHandle, start_local_forward};
pub use remote::{RemoteForward, RemoteForwardHandle, start_remote_forward};
pub use manager::{ForwardingManager, ForwardRule, ForwardStatus, ForwardType};
