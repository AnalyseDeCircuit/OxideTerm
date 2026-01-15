//! Error types for .oxide file operations

use thiserror::Error;

#[derive(Debug, Error)]
pub enum OxideFileError {
    #[error("Invalid magic number")]
    InvalidMagic,

    #[error("Unsupported version: {0}")]
    UnsupportedVersion(u32),

    #[error("Invalid file format: {0}")]
    InvalidFormat(String),

    #[error("Encryption failed")]
    EncryptionFailed,

    #[error("Decryption failed (wrong password or corrupted data)")]
    DecryptionFailed,

    #[error("Checksum mismatch (data corrupted or tampered)")]
    ChecksumMismatch,

    #[error("Cryptographic error")]
    CryptoError,

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] postcard::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}
