//! SFTP data types

use serde::{Deserialize, Serialize};

/// File entry information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    /// File name (not full path)
    pub name: String,
    /// Full path
    pub path: String,
    /// File type
    pub file_type: FileType,
    /// File size in bytes
    pub size: u64,
    /// Last modified time (Unix timestamp)
    pub modified: i64,
    /// File permissions (octal string, e.g., "755")
    pub permissions: String,
    /// Owner username (if available)
    pub owner: Option<String>,
    /// Group name (if available)
    pub group: Option<String>,
    /// Is symbolic link
    pub is_symlink: bool,
    /// Symlink target (if is_symlink)
    pub symlink_target: Option<String>,
}

/// File type enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FileType {
    File,
    Directory,
    Symlink,
    Unknown,
}

impl FileType {
    /// Get icon name for UI
    pub fn icon(&self) -> &'static str {
        match self {
            FileType::File => "file",
            FileType::Directory => "folder",
            FileType::Symlink => "link",
            FileType::Unknown => "file-question",
        }
    }
}

/// File preview content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PreviewContent {
    /// Plain text content
    Text { data: String, mime_type: Option<String> },
    /// Base64-encoded binary content (images, etc.)
    Base64 { data: String, mime_type: String },
    /// File is too large to preview
    TooLarge { size: u64, max_size: u64 },
    /// File type cannot be previewed
    Unsupported { mime_type: String },
}

/// Transfer progress information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferProgress {
    /// Unique transfer ID
    pub id: String,
    /// Remote file path
    pub remote_path: String,
    /// Local file path
    pub local_path: String,
    /// Transfer direction
    pub direction: TransferDirection,
    /// Current state
    pub state: TransferState,
    /// Total bytes to transfer
    pub total_bytes: u64,
    /// Bytes transferred so far
    pub transferred_bytes: u64,
    /// Transfer speed in bytes/second
    pub speed: u64,
    /// Estimated time remaining in seconds
    pub eta_seconds: Option<u64>,
    /// Error message if failed
    pub error: Option<String>,
}

impl TransferProgress {
    /// Calculate progress percentage (0-100)
    pub fn percentage(&self) -> f64 {
        if self.total_bytes == 0 {
            100.0
        } else {
            (self.transferred_bytes as f64 / self.total_bytes as f64) * 100.0
        }
    }
}

/// Transfer direction
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransferDirection {
    Upload,
    Download,
}

/// Transfer state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransferState {
    /// Waiting in queue
    Pending,
    /// Currently transferring
    InProgress,
    /// Paused by user
    Paused,
    /// Completed successfully
    Completed,
    /// Failed with error
    Failed,
    /// Cancelled by user
    Cancelled,
}

/// Transfer request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferRequest {
    /// Session ID to use for transfer
    pub session_id: String,
    /// Remote file path
    pub remote_path: String,
    /// Local file path
    pub local_path: String,
    /// Transfer direction
    pub direction: TransferDirection,
}

/// SFTP operation result for batch operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchResult {
    /// Successfully processed paths
    pub success: Vec<String>,
    /// Failed paths with error messages
    pub failed: Vec<(String, String)>,
}

/// Sort order for directory listing
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SortOrder {
    Name,
    NameDesc,
    Size,
    SizeDesc,
    Modified,
    ModifiedDesc,
    Type,
    TypeDesc,
}

impl Default for SortOrder {
    fn default() -> Self {
        SortOrder::Name
    }
}

/// Filter for directory listing
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ListFilter {
    /// Show hidden files (starting with .)
    #[serde(default)]
    pub show_hidden: bool,
    /// File name pattern to match (glob-style)
    pub pattern: Option<String>,
    /// Sort order
    #[serde(default)]
    pub sort: SortOrder,
}

/// Constants for SFTP operations
pub mod constants {
    /// Default chunk size for file transfers (64 KB)
    pub const DEFAULT_CHUNK_SIZE: usize = 64 * 1024;
    
    /// Maximum file size for preview (10 MB)
    pub const MAX_PREVIEW_SIZE: u64 = 10 * 1024 * 1024;
    
    /// Maximum text preview size (1 MB)
    pub const MAX_TEXT_PREVIEW_SIZE: u64 = 1024 * 1024;
    
    /// Maximum concurrent transfers
    pub const MAX_CONCURRENT_TRANSFERS: usize = 3;
    
    /// Buffer size for streaming transfers
    pub const STREAM_BUFFER_SIZE: usize = 256 * 1024;
}
