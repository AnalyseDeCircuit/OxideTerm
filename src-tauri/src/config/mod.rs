//! Configuration Management Module
//!
//! Handles persistent storage of connection configurations, SSH config import,
//! and secure credential storage via system keychain.

pub mod types;
pub mod storage;
pub mod ssh_config;
pub mod keychain;

pub use types::{SavedConnection, SavedAuth, ConnectionOptions, ConfigFile, CONFIG_VERSION};
pub use storage::{ConfigStorage, StorageError, config_dir, connections_file};
pub use ssh_config::{SshConfigHost, SshConfigError, parse_ssh_config, default_ssh_config_path};
pub use keychain::{Keychain, KeychainError};
