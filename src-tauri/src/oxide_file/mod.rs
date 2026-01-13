//! .oxide file format module
//!
//! Provides encrypted configuration file export/import with:
//! - ChaCha20-Poly1305 AEAD encryption
//! - Argon2id key derivation (high strength)
//! - Binary file format with unencrypted metadata
//! - Git-friendly and offline-decryptable

pub mod error;
pub mod format;
pub mod crypto;

// Re-export main types
pub use error::OxideFileError;
pub use format::{
    OxideFile, OxideMetadata, EncryptedPayload, 
    EncryptedConnection, EncryptedAuth
};
pub use crypto::{encrypt_oxide_file, decrypt_oxide_file, compute_checksum};
