//! OxideTerm - A modern SSH terminal client
//!
//! Built with Rust, Tauri, and xterm.js for high-performance terminal emulation.

pub mod ssh;
pub mod bridge;
pub mod commands;
pub mod session;
pub mod config;
pub mod forwarding;
pub mod sftp;

use std::sync::Arc;
use bridge::BridgeManager;
use session::SessionRegistry;
use commands::config::ConfigState;
use commands::HealthRegistry;
use sftp::session::SftpRegistry;
use sftp::TransferManager;
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
    
    // Create forwarding registry
    let forwarding_registry = commands::ForwardingRegistry::new();
    
    // Create health registry
    let health_registry = HealthRegistry::new();
    
    // Create SFTP registry
    let sftp_registry = Arc::new(SftpRegistry::new());
    
    // Create transfer manager for concurrent transfer control
    let transfer_manager = Arc::new(TransferManager::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(BridgeManager::new())
        .manage(registry)
        .manage(forwarding_registry)
        .manage(health_registry)
        .manage(sftp_registry)
        .manage(transfer_manager)
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
            // Session commands (v2 with registry)
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
            // Port forwarding commands
            commands::create_port_forward,
            commands::stop_port_forward,
            commands::list_port_forwards,
            commands::forward_jupyter,
            commands::forward_tensorboard,
            commands::forward_vscode,
            commands::stop_all_forwards,
            commands::delete_port_forward,
            commands::restart_port_forward,
            commands::update_port_forward,
            commands::get_port_forward_stats,
            // Health check commands
            commands::get_connection_health,
            commands::get_quick_health,
            commands::get_all_health_status,
            commands::get_health_for_display,
            commands::simulate_health_response,
            // SFTP commands
            commands::sftp_init,
            commands::sftp_list_dir,
            commands::sftp_stat,
            commands::sftp_preview,
            commands::sftp_preview_hex,
            commands::sftp_download,
            commands::sftp_upload,
            commands::sftp_delete,
            commands::sftp_delete_recursive,
            commands::sftp_download_dir,
            commands::sftp_upload_dir,
            commands::sftp_mkdir,
            commands::sftp_rename,
            commands::sftp_pwd,
            commands::sftp_cd,
            commands::sftp_close,
            commands::sftp_is_initialized,
            // Transfer control commands
            commands::sftp_cancel_transfer,
            commands::sftp_pause_transfer,
            commands::sftp_resume_transfer,
            commands::sftp_transfer_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
