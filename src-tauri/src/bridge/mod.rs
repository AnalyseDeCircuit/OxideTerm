//! WebSocket Bridge module
//! 
//! This module provides WebSocket server functionality for bridging
//! SSH sessions to the frontend xterm.js terminal.

mod server;
mod manager;
mod protocol;

pub use server::WsBridge;
pub use manager::BridgeManager;
pub use protocol::{Frame, FrameCodec, MessageType, data_frame, resize_frame, heartbeat_frame, error_frame};
