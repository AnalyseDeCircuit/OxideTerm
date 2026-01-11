//! SFTP Tauri commands
//!
//! Exposes SFTP functionality to the frontend.
//! 
//! Note: SFTP uses a separate SSH connection from the terminal session.
//! This is a common pattern as SFTP requires its own channel.

use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tracing::{info, error};

use crate::session::SessionRegistry;
use crate::sftp::{
    error::SftpError,
    session::{SftpRegistry, SftpSession},
    types::*,
};
use crate::ssh::{SshClient, SshConfig, AuthMethod as SshAuthMethod};
use crate::session::AuthMethod;

/// Initialize SFTP for a session
#[tauri::command]
pub async fn sftp_init(
    session_id: String,
    session_registry: State<'_, Arc<SessionRegistry>>,
    sftp_registry: State<'_, Arc<SftpRegistry>>,
) -> Result<String, SftpError> {
    info!("Initializing SFTP for session {}", session_id);

    // Check if already initialized
    if sftp_registry.has_sftp(&session_id) {
        if let Some(sftp) = sftp_registry.get(&session_id) {
            let sftp = sftp.lock().await;
            return Ok(sftp.cwd().to_string());
        }
    }

    // Get session config to establish new SSH connection for SFTP
    let config = session_registry
        .get_config(&session_id)
        .ok_or_else(|| SftpError::SessionNotFound(session_id.clone()))?;

    // Convert auth method
    let ssh_auth = match &config.auth {
        AuthMethod::Password { password } => SshAuthMethod::Password(password.clone()),
        AuthMethod::Key { key_path, passphrase } => SshAuthMethod::Key {
            key_path: key_path.clone(),
            passphrase: passphrase.clone(),
        },
        AuthMethod::Agent => {
            return Err(SftpError::SubsystemNotAvailable("SSH Agent not supported yet".to_string()));
        }
    };

    let ssh_config = SshConfig {
        host: config.host.clone(),
        port: config.port,
        username: config.username.clone(),
        auth: ssh_auth,
        timeout_secs: 30,
        cols: 80,
        rows: 24,
        proxy_chain: None,
    };

    // Establish new SSH connection for SFTP
    let client = SshClient::new(ssh_config);
    let ssh_session = client
        .connect()
        .await
        .map_err(|e| SftpError::ChannelError(e.to_string()))?;

    // Get the underlying handle for SFTP
    let handle = ssh_session.into_handle();

    // Create SFTP session
    let sftp = SftpSession::new(&handle, session_id.clone()).await?;
    let cwd = sftp.cwd().to_string();

    // Register SFTP session
    sftp_registry.register(session_id.clone(), sftp);

    info!("SFTP initialized for session {}, cwd: {}", session_id, cwd);
    Ok(cwd)
}

/// List directory contents
#[tauri::command]
pub async fn sftp_list_dir(
    session_id: String,
    path: String,
    filter: Option<ListFilter>,
    sftp_registry: State<'_, Arc<SftpRegistry>>,
) -> Result<Vec<FileInfo>, SftpError> {
    let sftp = sftp_registry
        .get(&session_id)
        .ok_or_else(|| SftpError::NotInitialized(session_id.clone()))?;

    let sftp = sftp.lock().await;
    sftp.list_dir(&path, filter).await
}

/// Get file/directory info
#[tauri::command]
pub async fn sftp_stat(
    session_id: String,
    path: String,
    sftp_registry: State<'_, Arc<SftpRegistry>>,
) -> Result<FileInfo, SftpError> {
    let sftp = sftp_registry
        .get(&session_id)
        .ok_or_else(|| SftpError::NotInitialized(session_id.clone()))?;

    let sftp = sftp.lock().await;
    sftp.stat(&path).await
}

/// Preview file content
#[tauri::command]
pub async fn sftp_preview(
    session_id: String,
    path: String,
    sftp_registry: State<'_, Arc<SftpRegistry>>,
) -> Result<PreviewContent, SftpError> {
    let sftp = sftp_registry
        .get(&session_id)
        .ok_or_else(|| SftpError::NotInitialized(session_id.clone()))?;

    let sftp = sftp.lock().await;
    sftp.preview(&path).await
}

/// Download file
#[tauri::command]
pub async fn sftp_download(
    session_id: String,
    remote_path: String,
    local_path: String,
    app: AppHandle,
    sftp_registry: State<'_, Arc<SftpRegistry>>,
) -> Result<(), SftpError> {
    let sftp = sftp_registry
        .get(&session_id)
        .ok_or_else(|| SftpError::NotInitialized(session_id.clone()))?;

    // Create progress channel
    let (tx, mut rx) = tokio::sync::mpsc::channel::<TransferProgress>(100);

    // Spawn progress event emitter
    let app_clone = app.clone();
    let session_id_clone = session_id.clone();
    tokio::spawn(async move {
        while let Some(progress) = rx.recv().await {
            let _ = app_clone.emit(&format!("sftp:progress:{}", session_id_clone), &progress);
        }
    });

    let sftp = sftp.lock().await;
    sftp.download(&remote_path, &local_path, Some(tx)).await
}

/// Upload file
#[tauri::command]
pub async fn sftp_upload(
    session_id: String,
    local_path: String,
    remote_path: String,
    app: AppHandle,
    sftp_registry: State<'_, Arc<SftpRegistry>>,
) -> Result<(), SftpError> {
    let sftp = sftp_registry
        .get(&session_id)
        .ok_or_else(|| SftpError::NotInitialized(session_id.clone()))?;

    // Create progress channel
    let (tx, mut rx) = tokio::sync::mpsc::channel::<TransferProgress>(100);

    // Spawn progress event emitter
    let app_clone = app.clone();
    let session_id_clone = session_id.clone();
    tokio::spawn(async move {
        while let Some(progress) = rx.recv().await {
            let _ = app_clone.emit(&format!("sftp:progress:{}", session_id_clone), &progress);
        }
    });

    let sftp = sftp.lock().await;
    sftp.upload(&local_path, &remote_path, Some(tx)).await
}

/// Delete file or directory
#[tauri::command]
pub async fn sftp_delete(
    session_id: String,
    path: String,
    sftp_registry: State<'_, Arc<SftpRegistry>>,
) -> Result<(), SftpError> {
    let sftp = sftp_registry
        .get(&session_id)
        .ok_or_else(|| SftpError::NotInitialized(session_id.clone()))?;

    let sftp = sftp.lock().await;
    sftp.delete(&path).await
}

/// Create directory
#[tauri::command]
pub async fn sftp_mkdir(
    session_id: String,
    path: String,
    sftp_registry: State<'_, Arc<SftpRegistry>>,
) -> Result<(), SftpError> {
    let sftp = sftp_registry
        .get(&session_id)
        .ok_or_else(|| SftpError::NotInitialized(session_id.clone()))?;

    let sftp = sftp.lock().await;
    sftp.mkdir(&path).await
}

/// Rename/move file or directory
#[tauri::command]
pub async fn sftp_rename(
    session_id: String,
    old_path: String,
    new_path: String,
    sftp_registry: State<'_, Arc<SftpRegistry>>,
) -> Result<(), SftpError> {
    let sftp = sftp_registry
        .get(&session_id)
        .ok_or_else(|| SftpError::NotInitialized(session_id.clone()))?;

    let sftp = sftp.lock().await;
    sftp.rename(&old_path, &new_path).await
}

/// Get current working directory
#[tauri::command]
pub async fn sftp_pwd(
    session_id: String,
    sftp_registry: State<'_, Arc<SftpRegistry>>,
) -> Result<String, SftpError> {
    let sftp = sftp_registry
        .get(&session_id)
        .ok_or_else(|| SftpError::NotInitialized(session_id.clone()))?;

    let sftp = sftp.lock().await;
    Ok(sftp.cwd().to_string())
}

/// Change working directory
#[tauri::command]
pub async fn sftp_cd(
    session_id: String,
    path: String,
    sftp_registry: State<'_, Arc<SftpRegistry>>,
) -> Result<String, SftpError> {
    let sftp = sftp_registry
        .get(&session_id)
        .ok_or_else(|| SftpError::NotInitialized(session_id.clone()))?;

    let mut sftp = sftp.lock().await;
    
    // Validate path exists and is a directory
    let info = sftp.stat(&path).await?;
    if info.file_type != FileType::Directory {
        return Err(SftpError::InvalidPath("Not a directory".to_string()));
    }

    sftp.set_cwd(info.path.clone());
    Ok(info.path)
}

/// Close SFTP session
#[tauri::command]
pub async fn sftp_close(
    session_id: String,
    sftp_registry: State<'_, Arc<SftpRegistry>>,
) -> Result<(), SftpError> {
    info!("Closing SFTP for session {}", session_id);
    sftp_registry.remove(&session_id);
    Ok(())
}

/// Check if SFTP is initialized for a session
#[tauri::command]
pub async fn sftp_is_initialized(
    session_id: String,
    sftp_registry: State<'_, Arc<SftpRegistry>>,
) -> Result<bool, SftpError> {
    Ok(sftp_registry.has_sftp(&session_id))
}
