//! Tauri commands for .oxide file import

use chrono::Utc;
use serde::Serialize;
use std::sync::Arc;
use tauri::State;
use tracing::info;
use uuid::Uuid;

use crate::commands::config::ConfigState;
use crate::config::types::{ProxyHopConfig, SavedAuth, SavedConnection, CONFIG_VERSION};
use crate::oxide_file::{
    decrypt_oxide_file, EncryptedAuth, OxideMetadata,
};

/// Result of importing connections from .oxide file
#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub imported: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

/// Validate .oxide file and extract metadata (without decryption)
#[tauri::command]
pub async fn validate_oxide_file(file_data: Vec<u8>) -> Result<OxideMetadata, String> {
    info!("Validating .oxide file ({} bytes)", file_data.len());

    let oxide_file = crate::oxide_file::OxideFile::from_bytes(&file_data)
        .map_err(|e| format!("Invalid .oxide file: {:?}", e))?;

    info!(
        "Valid .oxide file: {} connections",
        oxide_file.metadata.num_connections
    );

    Ok(oxide_file.metadata)
}

/// Import connections from encrypted .oxide file
#[tauri::command]
pub async fn import_from_oxide(
    file_data: Vec<u8>,
    password: String,
    config_state: State<'_, Arc<ConfigState>>,
) -> Result<ImportResult, String> {
    info!("Importing from .oxide file ({} bytes)", file_data.len());

    // 1. Parse file
    let oxide_file = crate::oxide_file::OxideFile::from_bytes(&file_data)
        .map_err(|e| format!("Invalid .oxide file: {:?}", e))?;

    // 2. Decrypt (password validation happens here)
    let payload = decrypt_oxide_file(&oxide_file, &password).map_err(|e| match e {
        crate::oxide_file::OxideFileError::DecryptionFailed => "密码错误或文件已损坏".to_string(),
        crate::oxide_file::OxideFileError::ChecksumMismatch => {
            "文件校验失败，数据可能被篡改".to_string()
        }
        _ => format!("解密失败: {:?}", e),
    })?;

    info!(
        "Decryption successful, importing {} connections",
        payload.connections.len()
    );

    // 3. Import all connections (all-or-nothing)
    let mut imported_count = 0;
    let mut errors = Vec::new();

    // Helper function to convert EncryptedAuth to SavedAuth and store secrets in keychain
    let convert_auth_and_store = |auth: EncryptedAuth, id: &str, context: &str, config_state: &Arc<ConfigState>| -> Result<SavedAuth, String> {
        match auth {
            EncryptedAuth::Password { password } => {
                let keychain_id = format!("oxide_conn_{}", id);
                config_state.set_keychain_value(&keychain_id, &password)
                    .map_err(|e| format!("Failed to store password for {}: {}", context, e))?;
                Ok(SavedAuth::Password { keychain_id })
            }
            EncryptedAuth::Key { key_path, passphrase } => {
                let passphrase_keychain_id = if let Some(pass) = passphrase {
                    let kc_id = format!("oxide_key_{}", id);
                    config_state.set_keychain_value(&kc_id, &pass)
                        .map_err(|e| format!("Failed to store passphrase for {}: {}", context, e))?;
                    Some(kc_id)
                } else {
                    None
                };
                Ok(SavedAuth::Key {
                    key_path,
                    has_passphrase: passphrase_keychain_id.is_some(),
                    passphrase_keychain_id,
                })
            }
            EncryptedAuth::Agent => Ok(SavedAuth::Agent),
        }
    };

    for enc_conn in payload.connections {
        let new_id = Uuid::new_v4().to_string();

        // Convert target connection auth
        let auth = match convert_auth_and_store(enc_conn.auth, &new_id, &enc_conn.name, &config_state) {
            Ok(a) => a,
            Err(e) => {
                errors.push(e);
                continue;
            }
        };

        // Convert proxy_chain auth (each hop needs its own keychain entries)
        let mut proxy_chain: Vec<ProxyHopConfig> = Vec::new();
        let mut hop_error = false;

        for (hop_index, enc_hop) in enc_conn.proxy_chain.into_iter().enumerate() {
            let hop_id = format!("{}_hop{}", new_id, hop_index);
            let hop_context = format!("hop {} of {}", hop_index, enc_conn.name);
            
            match convert_auth_and_store(enc_hop.auth, &hop_id, &hop_context, &config_state) {
                Ok(hop_auth) => {
                    proxy_chain.push(ProxyHopConfig {
                        host: enc_hop.host,
                        port: enc_hop.port,
                        username: enc_hop.username,
                        auth: hop_auth,
                    });
                }
                Err(e) => {
                    errors.push(e);
                    hop_error = true;
                    break;
                }
            }
        }

        if hop_error {
            continue;
        }

        let saved_conn = SavedConnection {
            id: new_id,
            version: CONFIG_VERSION,
            name: enc_conn.name,
            group: enc_conn.group,
            host: enc_conn.host,
            port: enc_conn.port,
            username: enc_conn.username,
            auth,
            options: enc_conn.options,
            created_at: Utc::now(),
            last_used_at: None,
            color: enc_conn.color,
            tags: enc_conn.tags,
            proxy_chain,
        };

        // Add to config using update closure
        config_state.update_config(|config| {
            config.add_connection(saved_conn);
        })?;

        imported_count += 1;
    }

    // 4. Persist to storage
    config_state
        .save_config()
        .await
        .map_err(|e| format!("Failed to save config: {}", e))?;

    info!("Successfully imported {} connections", imported_count);

    Ok(ImportResult {
        imported: imported_count,
        skipped: 0,
        errors,
    })
}
