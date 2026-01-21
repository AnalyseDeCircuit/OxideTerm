//! Tauri commands for .oxide file import

use chrono::Utc;
use serde::Serialize;
use std::sync::Arc;
use tauri::State;
use tracing::info;
use uuid::Uuid;

use crate::commands::config::ConfigState;
use crate::config::types::{ProxyHopConfig, SavedAuth, SavedConnection, CONFIG_VERSION};
use crate::oxide_file::{decrypt_oxide_file, EncryptedAuth, EncryptedProxyHop, OxideMetadata};

/// Result of importing connections from .oxide file
#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub imported: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

/// Pending keychain entry to be written
struct PendingKeychainEntry {
    id: String,
    value: String,
}

/// Pending connection with all resolved auth data
struct PendingConnection {
    connection: SavedConnection,
    keychain_entries: Vec<PendingKeychainEntry>,
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

    // 3. Phase 1: Build all connections in memory first (no keychain writes yet)
    //    This ensures we don't leave orphan keychain entries if something fails
    let mut pending_connections: Vec<PendingConnection> = Vec::new();
    let mut errors: Vec<String> = Vec::new();

    // Helper function to convert EncryptedAuth to SavedAuth WITHOUT writing to keychain
    // Returns (SavedAuth, Vec<PendingKeychainEntry>)
    fn prepare_auth(auth: EncryptedAuth, id: &str) -> (SavedAuth, Vec<PendingKeychainEntry>) {
        let mut entries = Vec::new();

        let saved_auth = match auth {
            EncryptedAuth::Password { password } => {
                let keychain_id = format!("oxide_conn_{}", id);
                entries.push(PendingKeychainEntry {
                    id: keychain_id.clone(),
                    value: password,
                });
                SavedAuth::Password { keychain_id }
            }
            EncryptedAuth::Key {
                key_path,
                passphrase,
            } => {
                let passphrase_keychain_id = if let Some(pass) = passphrase {
                    let kc_id = format!("oxide_key_{}", id);
                    entries.push(PendingKeychainEntry {
                        id: kc_id.clone(),
                        value: pass,
                    });
                    Some(kc_id)
                } else {
                    None
                };
                SavedAuth::Key {
                    key_path,
                    has_passphrase: passphrase_keychain_id.is_some(),
                    passphrase_keychain_id,
                }
            }
            EncryptedAuth::Certificate {
                key_path,
                cert_path,
                passphrase,
            } => {
                let passphrase_keychain_id = if let Some(pass) = passphrase {
                    let kc_id = format!("oxide_cert_{}", id);
                    entries.push(PendingKeychainEntry {
                        id: kc_id.clone(),
                        value: pass,
                    });
                    Some(kc_id)
                } else {
                    None
                };
                SavedAuth::Certificate {
                    key_path,
                    cert_path,
                    has_passphrase: passphrase_keychain_id.is_some(),
                    passphrase_keychain_id,
                }
            }
            EncryptedAuth::Agent => SavedAuth::Agent,
        };

        (saved_auth, entries)
    }

    fn prepare_proxy_chain(
        proxy_chain: Vec<EncryptedProxyHop>,
        base_id: &str,
    ) -> (Vec<ProxyHopConfig>, Vec<PendingKeychainEntry>) {
        let mut hops = Vec::new();
        let mut all_entries = Vec::new();

        for (hop_index, enc_hop) in proxy_chain.into_iter().enumerate() {
            let hop_id = format!("{}_hop{}", base_id, hop_index);
            let (hop_auth, entries) = prepare_auth(enc_hop.auth, &hop_id);
            all_entries.extend(entries);

            hops.push(ProxyHopConfig {
                host: enc_hop.host,
                port: enc_hop.port,
                username: enc_hop.username,
                auth: hop_auth,
            });
        }

        (hops, all_entries)
    }

    for enc_conn in payload.connections {
        let new_id = Uuid::new_v4().to_string();
        let conn_name = enc_conn.name.clone();

        // Prepare main connection auth
        let (auth, mut keychain_entries) = prepare_auth(enc_conn.auth, &new_id);

        // Prepare proxy_chain auth
        let (proxy_chain, hop_entries) = prepare_proxy_chain(enc_conn.proxy_chain, &new_id);
        keychain_entries.extend(hop_entries);

        let saved_conn = SavedConnection {
            id: new_id,
            version: CONFIG_VERSION,
            name: conn_name,
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

        pending_connections.push(PendingConnection {
            connection: saved_conn,
            keychain_entries,
        });
    }

    // 4. Phase 2: All connections validated - now write keychain entries and config atomically
    let mut imported_count = 0;
    let mut written_keychain_ids: Vec<String> = Vec::new();

    for pending in pending_connections {
        // Write all keychain entries for this connection
        let mut keychain_ok = true;
        for entry in &pending.keychain_entries {
            if let Err(e) = config_state.set_keychain_value(&entry.id, &entry.value) {
                errors.push(format!(
                    "Failed to store credentials for {}: {}",
                    pending.connection.name, e
                ));
                keychain_ok = false;
                break;
            }
            written_keychain_ids.push(entry.id.clone());
        }

        if !keychain_ok {
            // Rollback: try to delete already-written keychain entries for this connection
            for entry in &pending.keychain_entries {
                let _ = config_state.delete_keychain_value(&entry.id);
            }
            continue;
        }

        // Add to config
        if let Err(e) = config_state.update_config(|config| {
            config.add_connection(pending.connection);
        }) {
            errors.push(format!("Failed to save connection: {}", e));
            // Rollback keychain entries for this connection
            for entry in &pending.keychain_entries {
                let _ = config_state.delete_keychain_value(&entry.id);
            }
            continue;
        }

        imported_count += 1;
    }

    // 5. Persist to storage
    if imported_count > 0 {
        config_state
            .save_config()
            .await
            .map_err(|e| format!("Failed to save config: {}", e))?;
    }

    info!("Successfully imported {} connections", imported_count);

    Ok(ImportResult {
        imported: imported_count,
        skipped: 0,
        errors,
    })
}
