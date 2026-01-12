//! SFTP Session management
//!
//! Provides SFTP file operations over an existing SSH connection.

use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;

use base64::Engine;
use parking_lot::RwLock;
use russh_sftp::client::SftpSession as RusshSftpSession;
use russh_sftp::client::error::Error as SftpErrorInner;
use tokio::sync::mpsc;
use tracing::{debug, info};

use super::error::SftpError;
use super::types::*;
use crate::ssh::HandleController;

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
    /// Create a new SFTP session from a HandleController
    pub async fn new(
        handle_controller: HandleController,
        session_id: String,
    ) -> Result<Self, SftpError> {
        info!("Opening SFTP subsystem for session {}", session_id);

        // Open a new channel for SFTP via Handle Owner Task
        let channel = handle_controller
            .open_session_channel()
            .await
            .map_err(|e| SftpError::ChannelError(e.to_string()))?;

        // Request SFTP subsystem on the channel
        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|e| SftpError::SubsystemNotAvailable(format!("Failed to request SFTP subsystem: {}", e)))?;

        // Create SFTP session from the channel stream
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
        self.preview_with_offset(path, 0).await
    }

    /// Preview file content with offset (for incremental hex loading)
    pub async fn preview_with_offset(&self, path: &str, offset: u64) -> Result<PreviewContent, SftpError> {
        let canonical_path = self.resolve_path(path).await?;
        debug!("Previewing file: {} (offset: {})", canonical_path, offset);

        // Get file info first
        let info = self.stat(&canonical_path).await?;
        let file_size = info.size;

        // Get file extension
        let extension = Path::new(&canonical_path)
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        // Determine MIME type
        let mime_type = mime_guess::from_path(&canonical_path)
            .first_or_octet_stream()
            .to_string();

        // Priority 1: Check by extension first (more reliable for scripts/configs)
        if is_text_extension(&extension) {
            return self.preview_text(&canonical_path, &extension, &mime_type).await;
        }

        // Priority 2: PDF files
        if is_pdf_extension(&extension) || mime_type == "application/pdf" {
            return self.preview_pdf(&canonical_path, file_size).await;
        }

        // Priority 3: Office documents (requires LibreOffice)
        if is_office_extension(&extension) {
            return self.preview_office(&canonical_path, file_size).await;
        }

        // Priority 4: Images
        if mime_type.starts_with("image/") {
            return self.preview_image(&canonical_path, file_size, &mime_type).await;
        }

        // Priority 5: Video files
        if is_video_mime(&mime_type) || matches!(extension.as_str(), "mp4" | "webm" | "ogg" | "mov" | "mkv" | "avi") {
            return self.preview_video(&canonical_path, file_size, &mime_type).await;
        }

        // Priority 6: Audio files
        if is_audio_mime(&mime_type) || matches!(extension.as_str(), "mp3" | "wav" | "ogg" | "flac" | "aac" | "m4a") {
            return self.preview_audio(&canonical_path, file_size, &mime_type).await;
        }

        // Priority 7: Check MIME type for text
        let is_text_mime = mime_type.starts_with("text/")
            || mime_type == "application/json"
            || mime_type == "application/xml"
            || mime_type == "application/javascript"
            || mime_type == "application/toml"
            || mime_type == "application/yaml";

        if is_text_mime {
            return self.preview_text(&canonical_path, &extension, &mime_type).await;
        }

        // Fallback: Hex preview for unknown binary files
        self.preview_hex(&canonical_path, file_size, offset).await
    }

    /// Preview text/code files with syntax highlighting hint
    async fn preview_text(&self, path: &str, extension: &str, mime_type: &str) -> Result<PreviewContent, SftpError> {
        let info = self.stat(path).await?;
        
        // Check size limit for text
        if info.size > constants::MAX_TEXT_PREVIEW_SIZE {
            return Ok(PreviewContent::TooLarge {
                size: info.size,
                max_size: constants::MAX_TEXT_PREVIEW_SIZE,
                recommend_download: true,
            });
        }

        let content = self.sftp.read(path).await
            .map_err(|e| SftpError::ProtocolError(e.to_string()))?;

        let text = String::from_utf8_lossy(&content).to_string();
        let language = extension_to_language(extension);

        Ok(PreviewContent::Text {
            data: text,
            mime_type: Some(mime_type.to_string()),
            language,
        })
    }

    /// Preview image files
    async fn preview_image(&self, path: &str, size: u64, mime_type: &str) -> Result<PreviewContent, SftpError> {
        if size > constants::MAX_PREVIEW_SIZE {
            return Ok(PreviewContent::TooLarge {
                size,
                max_size: constants::MAX_PREVIEW_SIZE,
                recommend_download: true,
            });
        }

        let content = self.sftp.read(path).await
            .map_err(|e| SftpError::ProtocolError(e.to_string()))?;

        let data = base64::engine::general_purpose::STANDARD.encode(&content);
        Ok(PreviewContent::Image { data, mime_type: mime_type.to_string() })
    }

    /// Preview video files
    async fn preview_video(&self, path: &str, size: u64, mime_type: &str) -> Result<PreviewContent, SftpError> {
        if size > constants::MAX_MEDIA_PREVIEW_SIZE {
            return Ok(PreviewContent::TooLarge {
                size,
                max_size: constants::MAX_MEDIA_PREVIEW_SIZE,
                recommend_download: true,
            });
        }

        let content = self.sftp.read(path).await
            .map_err(|e| SftpError::ProtocolError(e.to_string()))?;

        // Correct MIME type for common formats
        let actual_mime = match Path::new(path).extension().and_then(|s| s.to_str()) {
            Some("mp4") => "video/mp4",
            Some("webm") => "video/webm",
            Some("ogg") => "video/ogg",
            Some("mov") => "video/quicktime",
            Some("mkv") => "video/x-matroska",
            Some("avi") => "video/x-msvideo",
            _ => mime_type,
        };

        let data = base64::engine::general_purpose::STANDARD.encode(&content);
        Ok(PreviewContent::Video { data, mime_type: actual_mime.to_string() })
    }

    /// Preview audio files
    async fn preview_audio(&self, path: &str, size: u64, mime_type: &str) -> Result<PreviewContent, SftpError> {
        if size > constants::MAX_MEDIA_PREVIEW_SIZE {
            return Ok(PreviewContent::TooLarge {
                size,
                max_size: constants::MAX_MEDIA_PREVIEW_SIZE,
                recommend_download: true,
            });
        }

        let content = self.sftp.read(path).await
            .map_err(|e| SftpError::ProtocolError(e.to_string()))?;

        // Correct MIME type for common formats
        let actual_mime = match Path::new(path).extension().and_then(|s| s.to_str()) {
            Some("mp3") => "audio/mpeg",
            Some("wav") => "audio/wav",
            Some("ogg") => "audio/ogg",
            Some("flac") => "audio/flac",
            Some("aac") => "audio/aac",
            Some("m4a") => "audio/mp4",
            _ => mime_type,
        };

        let data = base64::engine::general_purpose::STANDARD.encode(&content);
        Ok(PreviewContent::Audio { data, mime_type: actual_mime.to_string() })
    }

    /// Preview PDF files
    async fn preview_pdf(&self, path: &str, size: u64) -> Result<PreviewContent, SftpError> {
        if size > constants::MAX_PREVIEW_SIZE {
            return Ok(PreviewContent::TooLarge {
                size,
                max_size: constants::MAX_PREVIEW_SIZE,
                recommend_download: true,
            });
        }

        let content = self.sftp.read(path).await
            .map_err(|e| SftpError::ProtocolError(e.to_string()))?;

        let data = base64::engine::general_purpose::STANDARD.encode(&content);
        Ok(PreviewContent::Pdf { data, original_mime: None })
    }

    /// Preview Office documents (convert to PDF via LibreOffice)
    async fn preview_office(&self, path: &str, size: u64) -> Result<PreviewContent, SftpError> {
        // Check size limit
        if size > constants::MAX_OFFICE_CONVERT_SIZE {
            return Ok(PreviewContent::TooLarge {
                size,
                max_size: constants::MAX_OFFICE_CONVERT_SIZE,
                recommend_download: true,
            });
        }

        // Check if LibreOffice is available
        let soffice_path = Self::find_libreoffice();
        if soffice_path.is_none() {
            let extension = Path::new(path)
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("unknown");
            let mime_type = mime_guess::from_path(path)
                .first_or_octet_stream()
                .to_string();
            return Ok(PreviewContent::Unsupported {
                mime_type,
                reason: format!(
                    "LibreOffice not installed. Cannot preview {} files. Please download the file to view it.",
                    extension.to_uppercase()
                ),
            });
        }

        // Download to temp file
        let temp_dir = std::env::temp_dir().join("oxideterm_preview");
        tokio::fs::create_dir_all(&temp_dir).await.map_err(SftpError::IoError)?;

        let filename = Path::new(path)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("document");
        let temp_input = temp_dir.join(filename);
        
        // Get original MIME type before conversion
        let original_mime = mime_guess::from_path(path)
            .first_or_octet_stream()
            .to_string();

        // Download the file
        let content = self.sftp.read(path).await
            .map_err(|e| SftpError::ProtocolError(e.to_string()))?;
        tokio::fs::write(&temp_input, &content).await.map_err(SftpError::IoError)?;

        // Convert to PDF
        let soffice = soffice_path.unwrap();
        let output = tokio::process::Command::new(&soffice)
            .args([
                "--headless",
                "--convert-to", "pdf",
                "--outdir", temp_dir.to_str().unwrap(),
                temp_input.to_str().unwrap(),
            ])
            .output()
            .await
            .map_err(|e| SftpError::IoError(e))?;

        // Clean up input file
        let _ = tokio::fs::remove_file(&temp_input).await;

        if !output.status.success() {
            return Ok(PreviewContent::Unsupported {
                mime_type: original_mime,
                reason: format!(
                    "LibreOffice conversion failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ),
            });
        }

        // Read the converted PDF
        let pdf_name = Path::new(filename)
            .with_extension("pdf");
        let pdf_path = temp_dir.join(&pdf_name);

        let pdf_content = tokio::fs::read(&pdf_path).await.map_err(SftpError::IoError)?;
        
        // Clean up PDF file
        let _ = tokio::fs::remove_file(&pdf_path).await;

        let data = base64::engine::general_purpose::STANDARD.encode(&pdf_content);
        Ok(PreviewContent::Pdf { data, original_mime: Some(original_mime) })
    }

    /// Preview binary files as hex dump (incremental)
    async fn preview_hex(&self, path: &str, total_size: u64, offset: u64) -> Result<PreviewContent, SftpError> {
        use tokio::io::{AsyncReadExt, AsyncSeekExt};
        
        let chunk_size = constants::HEX_CHUNK_SIZE;
        
        // Don't read past end of file
        if offset >= total_size {
            return Ok(PreviewContent::Hex {
                data: String::new(),
                total_size,
                offset,
                chunk_size: 0,
                has_more: false,
            });
        }

        // Calculate actual bytes to read
        let bytes_to_read = std::cmp::min(chunk_size, total_size - offset) as usize;

        // Open file and seek to offset
        let mut file = self.sftp.open(path).await
            .map_err(|e| SftpError::ProtocolError(e.to_string()))?;
        
        if offset > 0 {
            file.seek(std::io::SeekFrom::Start(offset)).await
                .map_err(|e| SftpError::IoError(e))?;
        }

        // Read chunk
        let mut buffer = vec![0u8; bytes_to_read];
        let bytes_read = file.read(&mut buffer).await
            .map_err(|e| SftpError::IoError(e))?;
        buffer.truncate(bytes_read);

        // Generate hex dump
        let hex_data = generate_hex_dump(&buffer, offset);
        let has_more = offset + (bytes_read as u64) < total_size;

        Ok(PreviewContent::Hex {
            data: hex_data,
            total_size,
            offset,
            chunk_size: bytes_read as u64,
            has_more,
        })
    }

    /// Find LibreOffice executable
    fn find_libreoffice() -> Option<String> {
        // Check common paths
        let paths = [
            "/usr/bin/soffice",
            "/usr/bin/libreoffice",
            "/usr/local/bin/soffice",
            "/usr/local/bin/libreoffice",
            // macOS
            "/Applications/LibreOffice.app/Contents/MacOS/soffice",
            // Windows (would need adjustment for actual Windows paths)
        ];

        for path in &paths {
            if std::path::Path::new(path).exists() {
                return Some(path.to_string());
            }
        }

        // Try which command as fallback
        if let Ok(output) = std::process::Command::new("which").arg("soffice").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    return Some(path);
                }
            }
        }

        None
    }

    /// Download file to local path with progress reporting (streaming)
    pub async fn download(
        &self,
        remote_path: &str,
        local_path: &str,
        progress_tx: Option<mpsc::Sender<TransferProgress>>,
    ) -> Result<(), SftpError> {
        use tokio::io::AsyncReadExt;
        
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
        let start_time = std::time::Instant::now();
        let mut transferred_bytes: u64 = 0;
        
        // For instantaneous speed calculation
        let mut last_speed_time = std::time::Instant::now();
        let mut last_speed_bytes: u64 = 0;
        let mut current_speed: u64 = 0;

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

        // Open remote file for streaming read
        let mut remote_file = self
            .sftp
            .open(&canonical_path)
            .await
            .map_err(|e| SftpError::ProtocolError(e.to_string()))?;

        // Create local file for writing
        let mut local_file = tokio::fs::File::create(local_path)
            .await
            .map_err(SftpError::IoError)?;

        // Stream transfer with progress updates
        let chunk_size = constants::STREAM_BUFFER_SIZE;
        let mut buffer = vec![0u8; chunk_size];
        let mut last_progress_time = std::time::Instant::now();

        loop {
            let bytes_read = remote_file.read(&mut buffer).await
                .map_err(|e| SftpError::ProtocolError(e.to_string()))?;
            
            if bytes_read == 0 {
                break; // EOF
            }

            // Write to local file
            tokio::io::AsyncWriteExt::write_all(&mut local_file, &buffer[..bytes_read])
                .await
                .map_err(SftpError::IoError)?;

            transferred_bytes += bytes_read as u64;

            // Send progress update (throttled to every 100ms or 1% progress)
            let should_send_progress = progress_tx.is_some() && (
                last_progress_time.elapsed().as_millis() >= 100 ||
                (total_bytes > 0 && (transferred_bytes * 100 / total_bytes) != ((transferred_bytes - bytes_read as u64) * 100 / total_bytes))
            );

            if should_send_progress {
                if let Some(ref tx) = progress_tx {
                    // Calculate instantaneous speed (bytes transferred since last update)
                    let speed_elapsed = last_speed_time.elapsed().as_secs_f64();
                    if speed_elapsed > 0.0 {
                        let bytes_since_last = transferred_bytes - last_speed_bytes;
                        let instant_speed = (bytes_since_last as f64 / speed_elapsed) as u64;
                        // Smooth speed using exponential moving average
                        if current_speed == 0 {
                            current_speed = instant_speed;
                        } else {
                            current_speed = (current_speed * 7 + instant_speed * 3) / 10;
                        }
                        last_speed_time = std::time::Instant::now();
                        last_speed_bytes = transferred_bytes;
                    }
                    
                    let eta_seconds = if current_speed > 0 && total_bytes > transferred_bytes {
                        Some((total_bytes - transferred_bytes) / current_speed)
                    } else {
                        None
                    };

                    let _ = tx
                        .send(TransferProgress {
                            id: transfer_id.clone(),
                            remote_path: canonical_path.clone(),
                            local_path: local_path.to_string(),
                            direction: TransferDirection::Download,
                            state: TransferState::InProgress,
                            total_bytes,
                            transferred_bytes,
                            speed: current_speed,
                            eta_seconds,
                            error: None,
                        })
                        .await;
                    last_progress_time = std::time::Instant::now();
                }
            }
        }

        // Flush and close local file
        tokio::io::AsyncWriteExt::flush(&mut local_file)
            .await
            .map_err(SftpError::IoError)?;

        // Send completion progress with average speed
        if let Some(ref tx) = progress_tx {
            let elapsed = start_time.elapsed().as_secs_f64();
            let avg_speed = if elapsed > 0.0 {
                (transferred_bytes as f64 / elapsed) as u64
            } else {
                current_speed
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
                    speed: avg_speed,
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

    /// Upload file from local path with progress reporting (streaming)
    pub async fn upload(
        &self,
        local_path: &str,
        remote_path: &str,
        progress_tx: Option<mpsc::Sender<TransferProgress>>,
    ) -> Result<(), SftpError> {
        use tokio::io::AsyncReadExt;
        
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

        // Get local file metadata
        let local_metadata = tokio::fs::metadata(local_path)
            .await
            .map_err(SftpError::IoError)?;
        let total_bytes = local_metadata.len();

        let start_time = std::time::Instant::now();
        let mut transferred_bytes: u64 = 0;
        
        // For instantaneous speed calculation
        let mut last_speed_time = std::time::Instant::now();
        let mut last_speed_bytes: u64 = 0;
        let mut current_speed: u64 = 0;

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

        // Open local file for reading
        let mut local_file = tokio::fs::File::open(local_path)
            .await
            .map_err(SftpError::IoError)?;

        // Create remote file for writing
        let mut remote_file = self
            .sftp
            .create(&canonical_path)
            .await
            .map_err(|e| SftpError::ProtocolError(e.to_string()))?;

        // Stream transfer with progress updates
        let chunk_size = constants::STREAM_BUFFER_SIZE;
        let mut buffer = vec![0u8; chunk_size];
        let mut last_progress_time = std::time::Instant::now();

        loop {
            let bytes_read = local_file.read(&mut buffer).await
                .map_err(SftpError::IoError)?;
            
            if bytes_read == 0 {
                break; // EOF
            }

            // Write to remote file
            tokio::io::AsyncWriteExt::write_all(&mut remote_file, &buffer[..bytes_read])
                .await
                .map_err(|e| SftpError::ProtocolError(e.to_string()))?;

            transferred_bytes += bytes_read as u64;

            // Send progress update (throttled to every 100ms or 1% progress)
            let should_send_progress = progress_tx.is_some() && (
                last_progress_time.elapsed().as_millis() >= 100 ||
                (total_bytes > 0 && (transferred_bytes * 100 / total_bytes) != ((transferred_bytes - bytes_read as u64) * 100 / total_bytes))
            );

            if should_send_progress {
                if let Some(ref tx) = progress_tx {
                    // Calculate instantaneous speed (bytes transferred since last update)
                    let speed_elapsed = last_speed_time.elapsed().as_secs_f64();
                    if speed_elapsed > 0.0 {
                        let bytes_since_last = transferred_bytes - last_speed_bytes;
                        let instant_speed = (bytes_since_last as f64 / speed_elapsed) as u64;
                        // Smooth speed using exponential moving average
                        if current_speed == 0 {
                            current_speed = instant_speed;
                        } else {
                            current_speed = (current_speed * 7 + instant_speed * 3) / 10;
                        }
                        last_speed_time = std::time::Instant::now();
                        last_speed_bytes = transferred_bytes;
                    }
                    
                    let eta_seconds = if current_speed > 0 && total_bytes > transferred_bytes {
                        Some((total_bytes - transferred_bytes) / current_speed)
                    } else {
                        None
                    };

                    let _ = tx
                        .send(TransferProgress {
                            id: transfer_id.clone(),
                            remote_path: canonical_path.clone(),
                            local_path: local_path.to_string(),
                            direction: TransferDirection::Upload,
                            state: TransferState::InProgress,
                            total_bytes,
                            transferred_bytes,
                            speed: current_speed,
                            eta_seconds,
                            error: None,
                        })
                        .await;
                    last_progress_time = std::time::Instant::now();
                }
            }
        }

        // Flush remote file (will call fsync if supported)
        tokio::io::AsyncWriteExt::flush(&mut remote_file)
            .await
            .map_err(|e| SftpError::ProtocolError(e.to_string()))?;

        // Properly close the remote file handle
        tokio::io::AsyncWriteExt::shutdown(&mut remote_file)
            .await
            .map_err(|e| SftpError::ProtocolError(e.to_string()))?;

        // Send completion progress with average speed
        if let Some(ref tx) = progress_tx {
            let elapsed = start_time.elapsed().as_secs_f64();
            let avg_speed = if elapsed > 0.0 {
                (transferred_bytes as f64 / elapsed) as u64
            } else {
                current_speed
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
                    speed: avg_speed,
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

    /// Download directory recursively with progress reporting
    pub async fn download_dir(
        &self,
        remote_path: &str,
        local_path: &str,
        progress_tx: Option<mpsc::Sender<TransferProgress>>,
    ) -> Result<u64, SftpError> {
        let canonical_path = self.resolve_path(remote_path).await?;
        info!("Downloading directory {} to {}", canonical_path, local_path);

        let transfer_id = uuid::Uuid::new_v4().to_string();
        let start_time = std::time::Instant::now();
        
        // Create local directory
        tokio::fs::create_dir_all(local_path)
            .await
            .map_err(SftpError::IoError)?;

        let total_count = self.download_dir_inner(&canonical_path, local_path, &transfer_id, &progress_tx, &start_time).await?;

        info!("Download directory complete: {} files", total_count);
        Ok(total_count)
    }

    /// Internal recursive directory download implementation
    async fn download_dir_inner(
        &self,
        remote_path: &str,
        local_path: &str,
        transfer_id: &str,
        progress_tx: &Option<mpsc::Sender<TransferProgress>>,
        start_time: &std::time::Instant,
    ) -> Result<u64, SftpError> {
        let entries = self.list_dir(remote_path, Some(ListFilter {
            show_hidden: true,
            pattern: None,
            sort: SortOrder::Name,
        })).await?;

        let mut count = 0u64;

        for entry in entries {
            let local_entry_path = format!("{}/{}", local_path, entry.name);

            if entry.file_type == FileType::Directory {
                // Create local directory
                tokio::fs::create_dir_all(&local_entry_path)
                    .await
                    .map_err(SftpError::IoError)?;
                
                // Recurse into subdirectory (boxed to avoid infinite future size)
                count += Box::pin(self.download_dir_inner(&entry.path, &local_entry_path, transfer_id, progress_tx, start_time)).await?;
            } else {
                // Download file
                let content = self
                    .sftp
                    .read(&entry.path)
                    .await
                    .map_err(|e| SftpError::ProtocolError(e.to_string()))?;

                tokio::fs::write(&local_entry_path, &content)
                    .await
                    .map_err(SftpError::IoError)?;

                count += 1;

                // Send progress
                if let Some(ref tx) = progress_tx {
                    let elapsed = start_time.elapsed().as_secs_f64();
                    let speed = if elapsed > 0.0 {
                        (content.len() as f64 / elapsed) as u64
                    } else {
                        0
                    };

                    let _ = tx
                        .send(TransferProgress {
                            id: transfer_id.to_string(),
                            remote_path: entry.path.clone(),
                            local_path: local_entry_path.clone(),
                            direction: TransferDirection::Download,
                            state: TransferState::InProgress,
                            total_bytes: entry.size,
                            transferred_bytes: entry.size,
                            speed,
                            eta_seconds: None,
                            error: None,
                        })
                        .await;
                }
            }
        }

        Ok(count)
    }

    /// Upload directory recursively with progress reporting
    pub async fn upload_dir(
        &self,
        local_path: &str,
        remote_path: &str,
        progress_tx: Option<mpsc::Sender<TransferProgress>>,
    ) -> Result<u64, SftpError> {
        let canonical_path = if remote_path.starts_with('/') {
            remote_path.to_string()
        } else {
            format!("{}/{}", self.cwd, remote_path)
        };
        info!("Uploading directory {} to {}", local_path, canonical_path);

        let transfer_id = uuid::Uuid::new_v4().to_string();
        let start_time = std::time::Instant::now();
        
        // Create remote directory
        let _ = self.mkdir(&canonical_path).await; // Ignore error if exists

        let total_count = self.upload_dir_inner(local_path, &canonical_path, &transfer_id, &progress_tx, &start_time).await?;

        info!("Upload directory complete: {} files", total_count);
        Ok(total_count)
    }

    /// Internal recursive directory upload implementation
    async fn upload_dir_inner(
        &self,
        local_path: &str,
        remote_path: &str,
        transfer_id: &str,
        progress_tx: &Option<mpsc::Sender<TransferProgress>>,
        start_time: &std::time::Instant,
    ) -> Result<u64, SftpError> {
        let mut entries = tokio::fs::read_dir(local_path)
            .await
            .map_err(SftpError::IoError)?;

        let mut count = 0u64;

        while let Some(entry) = entries.next_entry().await.map_err(SftpError::IoError)? {
            let name = entry.file_name().to_string_lossy().to_string();
            let local_entry_path = entry.path();
            let remote_entry_path = format!("{}/{}", remote_path, name);

            let metadata = entry.metadata().await.map_err(SftpError::IoError)?;

            if metadata.is_dir() {
                // Create remote directory
                let _ = self.mkdir(&remote_entry_path).await;
                
                // Recurse into subdirectory (boxed to avoid infinite future size)
                count += Box::pin(self.upload_dir_inner(
                    local_entry_path.to_string_lossy().as_ref(),
                    &remote_entry_path,
                    transfer_id,
                    progress_tx,
                    start_time,
                )).await?;
            } else {
                // Upload file
                let content = tokio::fs::read(&local_entry_path)
                    .await
                    .map_err(SftpError::IoError)?;

                self.sftp
                    .write(&remote_entry_path, &content)
                    .await
                    .map_err(|e| SftpError::ProtocolError(e.to_string()))?;

                count += 1;

                // Send progress
                if let Some(ref tx) = progress_tx {
                    let elapsed = start_time.elapsed().as_secs_f64();
                    let speed = if elapsed > 0.0 {
                        (content.len() as f64 / elapsed) as u64
                    } else {
                        0
                    };

                    let _ = tx
                        .send(TransferProgress {
                            id: transfer_id.to_string(),
                            remote_path: remote_entry_path.clone(),
                            local_path: local_entry_path.to_string_lossy().to_string(),
                            direction: TransferDirection::Upload,
                            state: TransferState::InProgress,
                            total_bytes: content.len() as u64,
                            transferred_bytes: content.len() as u64,
                            speed,
                            eta_seconds: None,
                            error: None,
                        })
                        .await;
                }
            }
        }

        Ok(count)
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

    /// Delete file or directory recursively
    pub async fn delete_recursive(&self, path: &str) -> Result<u64, SftpError> {
        let canonical_path = self.resolve_path(path).await?;
        info!("Recursively deleting: {}", canonical_path);
        
        self.delete_recursive_inner(&canonical_path).await
    }

    /// Internal recursive delete implementation
    async fn delete_recursive_inner(&self, path: &str) -> Result<u64, SftpError> {
        let info = self.stat(path).await?;
        let mut deleted_count = 0u64;

        if info.file_type == FileType::Directory {
            // List directory contents
            let entries = self.list_dir(path, Some(ListFilter {
                show_hidden: true,
                pattern: None,
                sort: SortOrder::Name,
            })).await?;

            // Recursively delete each entry (boxed to avoid infinite future size)
            for entry in entries {
                deleted_count += Box::pin(self.delete_recursive_inner(&entry.path)).await?;
            }

            // Delete the now-empty directory
            self.sftp
                .remove_dir(path)
                .await
                .map_err(|e| SftpError::ProtocolError(e.to_string()))?;
            deleted_count += 1;
        } else {
            // Delete file
            self.sftp
                .remove_file(path)
                .await
                .map_err(|e| SftpError::ProtocolError(e.to_string()))?;
            deleted_count += 1;
        }

        Ok(deleted_count)
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
