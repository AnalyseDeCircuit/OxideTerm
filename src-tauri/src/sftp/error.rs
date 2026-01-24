//! SFTP error types

use thiserror::Error;

/// SFTP-specific errors
#[derive(Debug, Error)]
pub enum SftpError {
    #[error("SFTP subsystem not available: {0}")]
    SubsystemNotAvailable(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("File not found: {0}")]
    FileNotFound(String),

    #[error("Directory not found: {0}")]
    DirectoryNotFound(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Channel error: {0}")]
    ChannelError(String),

    #[error("Protocol error: {0}")]
    ProtocolError(String),

    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("File too large for preview: {size} bytes (max: {max} bytes)")]
    FileTooLarge { size: u64, max: u64 },

    #[error("Unsupported file type: {0}")]
    UnsupportedFileType(String),

    #[error("Transfer cancelled")]
    TransferCancelled,

    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("SFTP session not initialized for: {0}")]
    NotInitialized(String),

    #[error("Storage error: {0}")]
    StorageError(String),

    #[error("Transfer error: {0}")]
    TransferError(String),

    #[error("Resume not supported for: {0}")]
    ResumeNotSupported(String),

    #[error("Write error: {0}")]
    WriteError(String),
}

impl serde::Serialize for SftpError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
