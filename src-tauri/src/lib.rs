//! OxideTerm - A modern SSH terminal client
//!
//! Built with Rust, Tauri, and xterm.js for high-performance terminal emulation.

pub mod ssh;
pub mod bridge;
pub mod commands;
pub mod session;
pub mod config;

use std::sync::Arc;
use bridge::BridgeManager;
use session::SessionRegistry;
use commands::config::ConfigState;
use tauri::Manager;
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
        .setup(|app| {
            // Initialize config state asynchronously
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match ConfigState::new().await {
                    Ok(config_state) => {
                        handle.manage(Arc::new(config_state));
                        tracing::info!("Config state initialized");
                    }
                    Err(e) => {
                        tracing::error!("Failed to initialize config state: {}", e);
                    }
                }
            });
            Ok(())
        })
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
            // Config commands
            commands::config::get_connections,
            commands::config::get_recent_connections,
            commands::config::get_connections_by_group,
            commands::config::search_connections,
            commands::config::get_groups,
            commands::config::save_connection,
            commands::config::delete_connection,
            commands::config::mark_connection_used,
            commands::config::get_connection_password,
            commands::config::list_ssh_config_hosts,
            commands::config::import_ssh_host,
            commands::config::get_ssh_config_path,
            commands::config::create_group,
            commands::config::delete_group,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
