//! OxideTerm - A modern SSH terminal client
//!
//! Built with Rust, Tauri, and xterm.js for high-performance terminal emulation.

pub mod bridge;
pub mod commands;
pub mod config;
pub mod forwarding;
pub mod oxide_file;
pub mod session;
pub mod sftp;
pub mod ssh;
pub mod state;

use bridge::BridgeManager;
use commands::config::ConfigState;
use commands::HealthRegistry;
use session::{AutoReconnectService, SessionRegistry};
use sftp::session::SftpRegistry;
use sftp::TransferManager;
use state::StateStore;
use std::fs::OpenOptions;
use std::io::Write;
use std::sync::Arc;
use tauri::Manager;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// Write startup log to file (useful for debugging Windows startup issues)
fn write_startup_log(message: &str) {
    if let Ok(log_dir) = config::storage::log_dir() {
        // Ensure log directory exists
        let _ = std::fs::create_dir_all(&log_dir);

        let log_file = log_dir.join("startup.log");
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_file) {
            let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
            let _ = writeln!(file, "[{}] {}", timestamp, message);
        }
    }
}

/// Initialize logging
fn init_logging() {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with(tracing_subscriber::fmt::layer())
        .init();
}

/// Show error dialog on Windows when startup fails
#[cfg(windows)]
fn show_startup_error(title: &str, message: &str) {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::ptr::null_mut;

    let title: Vec<u16> = OsStr::new(title).encode_wide().chain(Some(0)).collect();
    let message: Vec<u16> = OsStr::new(message).encode_wide().chain(Some(0)).collect();

    unsafe {
        #[link(name = "user32")]
        extern "system" {
            fn MessageBoxW(
                hwnd: *mut std::ffi::c_void,
                text: *const u16,
                caption: *const u16,
                type_: u32,
            ) -> i32;
        }
        MessageBoxW(null_mut(), message.as_ptr(), title.as_ptr(), 0x10); // MB_ICONERROR
    }
}

#[cfg(not(windows))]
fn show_startup_error(_title: &str, _message: &str) {
    // No-op on non-Windows platforms
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    write_startup_log("OxideTerm starting...");

    init_logging();

    tracing::info!("Starting OxideTerm...");
    write_startup_log("Logging initialized");

    // Initialize state store
    let state_db_path = match config::storage::config_dir() {
        Ok(dir) => dir.join("state.redb"),
        Err(e) => {
            let msg = format!("Failed to get config directory: {}", e);
            tracing::error!("{}", msg);
            write_startup_log(&msg);
            show_startup_error("OxideTerm Startup Error", &msg);
            return;
        }
    };

    write_startup_log(&format!("State DB path: {:?}", state_db_path));

    let state_store = match StateStore::new(state_db_path.clone()) {
        Ok(store) => Arc::new(store),
        Err(e) => {
            let msg = format!(
                "Failed to initialize state store at {:?}: {}",
                state_db_path, e
            );
            tracing::error!("{}", msg);
            write_startup_log(&msg);
            show_startup_error("OxideTerm Startup Error", &msg);
            return;
        }
    };

    write_startup_log("State store initialized");

    // Create shared session registry with state store
    let registry = Arc::new(SessionRegistry::new(state_store.clone()));

    // Create forwarding registry with state store (Arc for sharing with reconnect service)
    let forwarding_registry = Arc::new(commands::ForwardingRegistry::new_with_state(state_store.clone()));

    // Create health registry
    let health_registry = HealthRegistry::new();

    // Create SFTP registry
    let sftp_registry = Arc::new(SftpRegistry::new());

    // Create transfer manager for concurrent transfer control
    let transfer_manager = Arc::new(TransferManager::new());

    write_startup_log("All registries initialized, building Tauri app...");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(BridgeManager::new())
        .manage(registry.clone())
        .manage(forwarding_registry.clone())
        .manage(health_registry)
        .manage(sftp_registry)
        .manage(transfer_manager)
        .setup(move |app| {
            // Initialize config state synchronously (blocking)
            tracing::info!("Initializing config state...");
            write_startup_log("Initializing config state...");

            match tauri::async_runtime::block_on(ConfigState::new()) {
                Ok(config_state) => {
                    app.manage(Arc::new(config_state));
                    tracing::info!("Config state initialized successfully");
                    write_startup_log("Config state initialized successfully");
                }
                Err(e) => {
                    let msg = format!("Failed to initialize config state: {}", e);
                    tracing::error!("{}", msg);
                    write_startup_log(&msg);
                    return Err(e.into());
                }
            }

            // Initialize auto reconnect service
            let reconnect_service = Arc::new(AutoReconnectService::new(
                registry.clone(),
                forwarding_registry.clone(),
                app.handle().clone(),
            ));
            app.manage(reconnect_service);
            tracing::info!("Auto reconnect service initialized");

            write_startup_log("Tauri setup complete");
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
            commands::restore_sessions,
            commands::list_persisted_sessions,
            commands::delete_persisted_session,
            // Scroll buffer commands
            commands::get_scroll_buffer,
            commands::get_buffer_stats,
            commands::clear_buffer,
            commands::get_all_buffer_lines,
            // Search commands
            commands::search_terminal,
            commands::scroll_to_line,
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
            // Oxide file export/import commands
            commands::oxide_export::export_to_oxide,
            commands::oxide_import::validate_oxide_file,
            commands::oxide_import::import_from_oxide,
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
            commands::list_saved_forwards,
            commands::set_forward_auto_start,
            commands::delete_saved_forward,
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
            // Network and reconnect commands
            commands::network_status_changed,
            commands::cancel_reconnect,
            commands::is_reconnecting,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
