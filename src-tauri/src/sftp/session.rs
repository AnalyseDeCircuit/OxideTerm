//! SFTP Session management
//!
//! Provides SFTP file operations over an existing SSH connection.

use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;

use base64::Engine;
use parking_lot::RwLock;
use russh::client::Handle;
use russh_sftp::client::SftpSession as RusshSftpSession;
use russh_sftp::client::error::Error as SftpErrorInner;
use tokio::sync::mpsc;
use tracing::{debug, info};

use super::error::SftpError;
use super::types::*;
use crate::ssh::ClientHandler;

/// SFTP Session wrapper
pub struct SftpSession {
    /// russh SFTP session
    sftp: RusshSftpSession,
    /// Session ID this SFTP is associated with
    session_id: String,
    /// Current working directory
    cwd: String,
}

impl SftpSession {
    /// Create a new SFTP session from an SSH handle
    pub async fn new(
        handle: &Handle<ClientHandler>,
        session_id: String,
    ) -> Result<Self, SftpError> {
        info!("Opening SFTP subsystem for session {}", session_id);

        // Open a new channel for SFTP
        let channel = handle
            .channel_open_session()
            .await
            .map_err(|e| SftpError::ChannelError(e.to_string()))?;

        // Request SFTP subsystem
        let sftp = RusshSftpSession::new(channel.into_stream())
            .await
            .map_err(|e| SftpError::SubsystemNotAvailable(e.to_string()))?;

        info!("SFTP subsystem opened for session {}", session_id);

        // Get initial working directory
        let cwd = sftp
            .canonicalize(".")
            .await
            .map_err(|e| SftpError::ProtocolError(e.to_string()))?;

        Ok(Self {
            sftp,
            session_id,
            cwd,
        })
    }

    /// Get current working directory
    pub fn cwd(&self) -> &str {
        &self.cwd
    }

    /// Set current working directory
    pub fn set_cwd(&mut self, path: String) {
        self.cwd = path;
    }

    /// List directory contents
    pub async fn list_dir(
        &self,
        path: &str,
        filter: Option<ListFilter>,
    ) -> Result<Vec<FileInfo>, SftpError> {
        let canonical_path = self.resolve_path(path).await?;
        debug!("Listing directory: {}", canonical_path);

        let mut entries = Vec::new();
        
        // Use read_dir to get directory entries
        let read_dir = self
            .sftp
            .read_dir(&canonical_path)
            .await
            .map_err(|e| self.map_sftp_error(e, &canonical_path))?;

        // Iterate through entries
        for entry in read_dir {
            let name = entry.file_name();
            
            // Skip . and ..
            if name == "." || name == ".." {
                continue;
            }

            // Apply hidden file filter
            if let Some(ref f) = filter {
                if !f.show_hidden && name.starts_with('.') {
                    continue;
                }
            }

            let full_path = if canonical_path.ends_with('/') {
                format!("{}{}", canonical_path, name)
            } else {
                format!("{}/{}", canonical_path, name)
            };

            // Get file metadata
            let metadata = entry.metadata();
            
            // Determine file type
            let file_type = if metadata.is_dir() {
                FileType::Directory
            } else if metadata.is_symlink() {
                FileType::Symlink
            } else if metadata.is_regular() {
                FileType::File
            } else {
                FileType::Unknown
            };

            // Get symlink target if applicable
            let symlink_target = if file_type == FileType::Symlink {
                self.sftp.read_link(&full_path).await.ok()
            } else {
                None
            };

            // Convert permissions to octal string
            let permissions = metadata
                .permissions
                .map(|p| format!("{:o}", p & 0o777))
                .unwrap_or_else(|| "000".to_string());

            entries.push(FileInfo {
                name,
                path: full_path,
                file_type,
                size: metadata.size.unwrap_or(0),
                modified: metadata.mtime.map(|t| t as i64).unwrap_or(0),
                permissions,
                owner: metadata.uid.map(|u: u32| u.to_string()),
                group: metadata.gid.map(|g: u32| g.to_string()),
                is_symlink: file_type == FileType::Symlink,
                symlink_target,
            });
        }

        // Apply pattern filter
        if let Some(ref f) = filter {
            if let Some(ref pattern) = f.pattern {
                if let Ok(glob_pattern) = glob::Pattern::new(pattern) {
                    entries.retain(|e| glob_pattern.matches(&e.name));
                }
            }
        }

        // Sort entries
        let sort_order = filter.as_ref().map(|f| f.sort).unwrap_or_default();
        self.sort_entries(&mut entries, sort_order);

        debug!("Listed {} entries in {}", entries.len(), canonical_path);
        Ok(entries)
    }

    /// Sort file entries
    fn sort_entries(&self, entries: &mut Vec<FileInfo>, order: SortOrder) {
        // Directories always first
        entries.sort_by(|a, b| {
            let a_is_dir = a.file_type == FileType::Directory;
            let b_is_dir = b.file_type == FileType::Directory;

            if a_is_dir != b_is_dir {
                return b_is_dir.cmp(&a_is_dir);
            }

            match order {
                SortOrder::Name => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
                SortOrder::NameDesc => b.name.to_lowercase().cmp(&a.name.to_lowercase()),
                SortOrder::Size => a.size.cmp(&b.size),
                SortOrder::SizeDesc => b.size.cmp(&a.size),
                SortOrder::Modified => a.modified.cmp(&b.modified),
                SortOrder::ModifiedDesc => b.modified.cmp(&a.modified),
                SortOrder::Type => a.name.cmp(&b.name),
                SortOrder::TypeDesc => b.name.cmp(&a.name),
            }
        });
    }

    /// Get file information
    pub async fn stat(&self, path: &str) -> Result<FileInfo, SftpError> {
        let canonical_path = self.resolve_path(path).await?;
        debug!("Getting file info: {}", canonical_path);

        let metadata = self
            .sftp
            .metadata(&canonical_path)
            .await
            .map_err(|e| self.map_sftp_error(e, &canonical_path))?;

        let name = Path::new(&canonical_path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        let file_type = if metadata.is_dir() {
            FileType::Directory
        } else if metadata.is_symlink() {
            FileType::Symlink
        } else if metadata.is_regular() {
            FileType::File
        } else {
            FileType::Unknown
        };

        let symlink_target = if file_type == FileType::Symlink {
            self.sftp.read_link(&canonical_path).await.ok()
        } else {
            None
        };

        let permissions = metadata
            .permissions
            .map(|p| format!("{:o}", p & 0o777))
            .unwrap_or_else(|| "000".to_string());

        Ok(FileInfo {
            name,
            path: canonical_path,
            file_type,
            size: metadata.size.unwrap_or(0),
            modified: metadata.mtime.map(|t| t as i64).unwrap_or(0),
            permissions,
            owner: metadata.uid.map(|u: u32| u.to_string()),
            group: metadata.gid.map(|g: u32| g.to_string()),
            is_symlink: file_type == FileType::Symlink,
            symlink_target,
        })
    }

    /// Preview file content
    pub async fn preview(&self, path: &str) -> Result<PreviewContent, SftpError> {
        let canonical_path = self.resolve_path(path).await?;
        debug!("Previewing file: {}", canonical_path);

        // Get file info first
        let info = self.stat(&canonical_path).await?;

        // Check file size
        if info.size > constants::MAX_PREVIEW_SIZE {
            return Ok(PreviewContent::TooLarge {
                size: info.size,
                max_size: constants::MAX_PREVIEW_SIZE,
            });
        }

        // Determine MIME type
        let mime_type = mime_guess::from_path(&canonical_path)
            .first_or_octet_stream()
            .to_string();

        // Check if previewable
        let is_text = mime_type.starts_with("text/")
            || mime_type == "application/json"
            || mime_type == "application/xml"
            || mime_type == "application/javascript"
            || mime_type == "application/toml"
            || mime_type == "application/yaml";

        let is_image = mime_type.starts_with("image/");

        if !is_text && !is_image {
            return Ok(PreviewContent::Unsupported { mime_type });
        }

        // Read file content using the simple read() API
        let content = self
            .sftp
            .read(&canonical_path)
            .await
            .map_err(|e| SftpError::ProtocolError(e.to_string()))?;

        if is_text {
            // Text preview - convert to string
            let text = String::from_utf8_lossy(&content).to_string();
            
            // Truncate if too large
            if text.len() > constants::MAX_TEXT_PREVIEW_SIZE as usize {
                Ok(PreviewContent::Text(text[..constants::MAX_TEXT_PREVIEW_SIZE as usize].to_string()))
            } else {
                Ok(PreviewContent::Text(text))
            }
        } else {
            // Binary preview (images)
            let data = base64::engine::general_purpose::STANDARD.encode(&content);
            Ok(PreviewContent::Base64 { data, mime_type })
        }
    }

    /// Download file to local path with progress reporting
    pub async fn download(
        &self,
        remote_path: &str,
        local_path: &str,
        progress_tx: Option<mpsc::Sender<TransferProgress>>,
    ) -> Result<(), SftpError> {
        let canonical_path = self.resolve_path(remote_path).await?;
        info!("Downloading {} to {}", canonical_path, local_path);

        let transfer_id = uuid::Uuid::new_v4().to_string();

        // Get file info
        let info = self.stat(&canonical_path).await?;
        if info.file_type == FileType::Directory {
            return Err(SftpError::InvalidPath(
                "Cannot download directory (use recursive download)".to_string(),
            ));
        }

        let total_bytes = info.size;

        // Send initial progress
        if let Some(ref tx) = progress_tx {
            let _ = tx
                .send(TransferProgress {
                    id: transfer_id.clone(),
                    remote_path: canonical_path.clone(),
                    local_path: local_path.to_string(),
                    direction: TransferDirection::Download,
                    state: TransferState::InProgress,
                    total_bytes,
                    transferred_bytes: 0,
                    speed: 0,
                    eta_seconds: None,
                    error: None,
                })
                .await;
        }

        let start_time = std::time::Instant::now();

        // Use simple read API for smaller files, streaming for larger ones
        let content = self
            .sftp
            .read(&canonical_path)
            .await
            .map_err(|e| SftpError::ProtocolError(e.to_string()))?;

        // Write to local file
        tokio::fs::write(local_path, &content)
            .await
            .map_err(SftpError::IoError)?;

        let transferred_bytes = content.len() as u64;

        // Send completion progress
        if let Some(ref tx) = progress_tx {
            let elapsed = start_time.elapsed().as_secs_f64();
            let speed = if elapsed > 0.0 {
                (transferred_bytes as f64 / elapsed) as u64
            } else {
                0
            };

            let _ = tx
                .send(TransferProgress {
                    id: transfer_id,
                    remote_path: canonical_path.clone(),
                    local_path: local_path.to_string(),
                    direction: TransferDirection::Download,
                    state: TransferState::Completed,
                    total_bytes,
                    transferred_bytes,
                    speed,
                    eta_seconds: Some(0),
                    error: None,
                })
                .await;
        }

        info!(
            "Download complete: {} ({} bytes)",
            canonical_path, transferred_bytes
        );
        Ok(())
    }

    /// Upload file from local path with progress reporting
    pub async fn upload(
        &self,
        local_path: &str,
        remote_path: &str,
        progress_tx: Option<mpsc::Sender<TransferProgress>>,
    ) -> Result<(), SftpError> {
        let canonical_path = self.resolve_path(remote_path).await.unwrap_or_else(|_| {
            // If path doesn't exist yet, construct it
            if remote_path.starts_with('/') {
                remote_path.to_string()
            } else {
                format!("{}/{}", self.cwd, remote_path)
            }
        });
        info!("Uploading {} to {}", local_path, canonical_path);

        let transfer_id = uuid::Uuid::new_v4().to_string();

        // Read local file
        let content = tokio::fs::read(local_path)
            .await
            .map_err(SftpError::IoError)?;

        let total_bytes = content.len() as u64;

        // Send initial progress
        if let Some(ref tx) = progress_tx {
            let _ = tx
                .send(TransferProgress {
                    id: transfer_id.clone(),
                    remote_path: canonical_path.clone(),
                    local_path: local_path.to_string(),
                    direction: TransferDirection::Upload,
                    state: TransferState::InProgress,
                    total_bytes,
                    transferred_bytes: 0,
                    speed: 0,
                    eta_seconds: None,
                    error: None,
                })
                .await;
        }

        let start_time = std::time::Instant::now();

        // Write to remote using simple write API
        self.sftp
            .write(&canonical_path, &content)
            .await
            .map_err(|e| SftpError::ProtocolError(e.to_string()))?;

        let transferred_bytes = total_bytes;

        // Send completion progress
        if let Some(ref tx) = progress_tx {
            let elapsed = start_time.elapsed().as_secs_f64();
            let speed = if elapsed > 0.0 {
                (transferred_bytes as f64 / elapsed) as u64
            } else {
                0
            };

            let _ = tx
                .send(TransferProgress {
                    id: transfer_id,
                    remote_path: canonical_path.clone(),
                    local_path: local_path.to_string(),
                    direction: TransferDirection::Upload,
                    state: TransferState::Completed,
                    total_bytes,
                    transferred_bytes,
                    speed,
                    eta_seconds: Some(0),
                    error: None,
                })
                .await;
        }

        info!(
            "Upload complete: {} ({} bytes)",
            canonical_path, transferred_bytes
        );
        Ok(())
    }

    /// Delete file or empty directory
    pub async fn delete(&self, path: &str) -> Result<(), SftpError> {
        let canonical_path = self.resolve_path(path).await?;
        info!("Deleting: {}", canonical_path);

        let info = self.stat(&canonical_path).await?;

        if info.file_type == FileType::Directory {
            self.sftp
                .remove_dir(&canonical_path)
                .await
                .map_err(|e| SftpError::ProtocolError(e.to_string()))?;
        } else {
            self.sftp
                .remove_file(&canonical_path)
                .await
                .map_err(|e| SftpError::ProtocolError(e.to_string()))?;
        }

        Ok(())
    }

    /// Create directory
    pub async fn mkdir(&self, path: &str) -> Result<(), SftpError> {
        let canonical_path = if path.starts_with('/') {
            path.to_string()
        } else {
            format!("{}/{}", self.cwd, path)
        };
        info!("Creating directory: {}", canonical_path);

        self.sftp
            .create_dir(&canonical_path)
            .await
            .map_err(|e| SftpError::ProtocolError(e.to_string()))?;

        Ok(())
    }

    /// Rename/move file or directory
    pub async fn rename(&self, old_path: &str, new_path: &str) -> Result<(), SftpError> {
        let old_canonical = self.resolve_path(old_path).await?;
        let new_canonical = if new_path.starts_with('/') {
            new_path.to_string()
        } else {
            format!("{}/{}", self.cwd, new_path)
        };
        info!("Renaming {} to {}", old_canonical, new_canonical);

        self.sftp
            .rename(&old_canonical, &new_canonical)
            .await
            .map_err(|e| SftpError::ProtocolError(e.to_string()))?;

        Ok(())
    }

    /// Resolve relative path to absolute
    async fn resolve_path(&self, path: &str) -> Result<String, SftpError> {
        if path.starts_with('/') {
            // Already absolute
            self.sftp
                .canonicalize(path)
                .await
                .map_err(|e| SftpError::ProtocolError(e.to_string()))
        } else if path == "~" || path.starts_with("~/") {
            // Home directory
            let home = self
                .sftp
                .canonicalize(".")
                .await
                .map_err(|e| SftpError::ProtocolError(e.to_string()))?;

            if path == "~" {
                Ok(home)
            } else {
                let rest = &path[2..];
                Ok(format!("{}/{}", home, rest))
            }
        } else {
            // Relative to cwd
            let full_path = format!("{}/{}", self.cwd, path);
            self.sftp
                .canonicalize(&full_path)
                .await
                .map_err(|e| SftpError::ProtocolError(e.to_string()))
        }
    }

    /// Map SFTP errors to our error type
    fn map_sftp_error(&self, err: SftpErrorInner, path: &str) -> SftpError {
        let err_str = err.to_string();
        if err_str.contains("No such file") || err_str.contains("not found") {
            SftpError::FileNotFound(path.to_string())
        } else if err_str.contains("Permission denied") {
            SftpError::PermissionDenied(path.to_string())
        } else {
            SftpError::ProtocolError(err_str)
        }
    }
}

/// Registry of active SFTP sessions
pub struct SftpRegistry {
    sessions: RwLock<HashMap<String, Arc<tokio::sync::Mutex<SftpSession>>>>,
}

impl SftpRegistry {
    pub fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
        }
    }

    /// Register an SFTP session
    pub fn register(&self, session_id: String, session: SftpSession) {
        let mut sessions = self.sessions.write();
        sessions.insert(session_id, Arc::new(tokio::sync::Mutex::new(session)));
    }

    /// Get an SFTP session by ID
    pub fn get(&self, session_id: &str) -> Option<Arc<tokio::sync::Mutex<SftpSession>>> {
        let sessions = self.sessions.read();
        sessions.get(session_id).cloned()
    }

    /// Remove an SFTP session
    pub fn remove(&self, session_id: &str) -> Option<Arc<tokio::sync::Mutex<SftpSession>>> {
        let mut sessions = self.sessions.write();
        sessions.remove(session_id)
    }

    /// Check if a session has SFTP initialized
    pub fn has_sftp(&self, session_id: &str) -> bool {
        let sessions = self.sessions.read();
        sessions.contains_key(session_id)
    }
}

impl Default for SftpRegistry {
    fn default() -> Self {
        Self::new()
    }
}
