//! SFTP Tauri commands
//!
//! Exposes SFTP functionality to the frontend.
//!
//! Note: SFTP opens its own SSH channel on the already-connected session handle.

use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tracing::info;

use crate::session::SessionRegistry;
use crate::sftp::{
    error::SftpError,
    session::{SftpRegistry, SftpSession},
    types::*,
};

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

    // Get the HandleController to open a new channel
    let handle_controller = session_registry
        .get_handle_controller(&session_id)
        .ok_or_else(|| SftpError::SessionNotFound(session_id.clone()))?;

    // Create SFTP session using HandleController
    let sftp = SftpSession::new(handle_controller, session_id.clone()).await?;
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

/// Preview more hex data (incremental loading)
#[tauri::command]
pub async fn sftp_preview_hex(
    session_id: String,
    path: String,
    offset: u64,
    sftp_registry: State<'_, Arc<SftpRegistry>>,
) -> Result<PreviewContent, SftpError> {
    let sftp = sftp_registry
        .get(&session_id)
        .ok_or_else(|| SftpError::NotInitialized(session_id.clone()))?;

    let sftp = sftp.lock().await;
    sftp.preview_with_offset(&path, offset).await
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

/// Delete file or directory recursively
#[tauri::command]
pub async fn sftp_delete_recursive(
    session_id: String,
    path: String,
    sftp_registry: State<'_, Arc<SftpRegistry>>,
) -> Result<u64, SftpError> {
    let sftp = sftp_registry
        .get(&session_id)
        .ok_or_else(|| SftpError::NotInitialized(session_id.clone()))?;

    let sftp = sftp.lock().await;
    sftp.delete_recursive(&path).await
}

/// Download directory recursively
#[tauri::command]
pub async fn sftp_download_dir(
    session_id: String,
    remote_path: String,
    local_path: String,
    app: AppHandle,
    sftp_registry: State<'_, Arc<SftpRegistry>>,
) -> Result<u64, SftpError> {
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
    sftp.download_dir(&remote_path, &local_path, Some(tx)).await
}

/// Upload directory recursively
#[tauri::command]
pub async fn sftp_upload_dir(
    session_id: String,
    local_path: String,
    remote_path: String,
    app: AppHandle,
    sftp_registry: State<'_, Arc<SftpRegistry>>,
) -> Result<u64, SftpError> {
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
    sftp.upload_dir(&local_path, &remote_path, Some(tx)).await
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

// ============ Transfer Control Commands ============

/// Cancel a specific transfer
#[tauri::command]
pub async fn sftp_cancel_transfer(
    transfer_id: String,
    transfer_manager: State<'_, Arc<crate::sftp::TransferManager>>,
) -> Result<bool, SftpError> {
    Ok(transfer_manager.cancel(&transfer_id))
}

/// Pause a specific transfer
#[tauri::command]
pub async fn sftp_pause_transfer(
    transfer_id: String,
    transfer_manager: State<'_, Arc<crate::sftp::TransferManager>>,
) -> Result<bool, SftpError> {
    Ok(transfer_manager.pause(&transfer_id))
}

/// Resume a specific transfer
#[tauri::command]
pub async fn sftp_resume_transfer(
    transfer_id: String,
    transfer_manager: State<'_, Arc<crate::sftp::TransferManager>>,
) -> Result<bool, SftpError> {
    Ok(transfer_manager.resume(&transfer_id))
}

/// Get transfer manager stats
#[tauri::command]
pub async fn sftp_transfer_stats(
    transfer_manager: State<'_, Arc<crate::sftp::TransferManager>>,
) -> Result<(usize, usize), SftpError> {
    Ok((
        transfer_manager.active_count(),
        transfer_manager.max_concurrent(),
    ))
}
