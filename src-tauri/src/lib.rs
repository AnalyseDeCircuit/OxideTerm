//! OxideTerm - A modern SSH terminal client
//!
//! Built with Rust, Tauri, and xterm.js for high-performance terminal emulation.

pub mod ssh;
pub mod bridge;
pub mod commands;
pub mod session;

use std::sync::Arc;
use bridge::BridgeManager;
use session::SessionRegistry;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// Initialize logging
fn init_logging() {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with(tracing_subscriber::fmt::layer())
        .init();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_logging();

    tracing::info!("Starting OxideTerm...");

    // Create shared session registry
    let registry = Arc::new(SessionRegistry::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(BridgeManager::new())
        .manage(registry)
        .invoke_handler(tauri::generate_handler![
            // Legacy commands (v1)
            commands::ssh_connect,
            commands::ssh_connect_key,
            commands::list_sessions,
            commands::disconnect_session,
            commands::resize_session,
            commands::get_session_count,
            // New commands (v2 with registry)
            commands::connect_v2,
            commands::disconnect_v2,
            commands::list_sessions_v2,
            commands::get_session_stats,
            commands::get_session,
            commands::resize_session_v2,
            commands::reorder_sessions,
            commands::check_ssh_keys,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
