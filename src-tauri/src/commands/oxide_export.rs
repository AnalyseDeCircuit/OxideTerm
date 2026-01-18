//! Tauri commands for .oxide file export

use chrono::Utc;
use std::sync::Arc;
use tauri::State;
use tracing::info;

use crate::commands::config::ConfigState;
use crate::config::types::SavedAuth;
use crate::oxide_file::{
    compute_checksum, encrypt_oxide_file, EncryptedAuth, EncryptedConnection, EncryptedPayload,
    EncryptedProxyHop, OxideMetadata,
};

/// Validate password strength
fn validate_password(password: &str) -> Result<(), String> {
    if password.len() < 12 {
        return Err("密码长度至少 12 个字符".to_string());
    }

    let has_upper = password.chars().any(|c| c.is_uppercase());
    let has_lower = password.chars().any(|c| c.is_lowercase());
    let has_digit = password.chars().any(|c| c.is_numeric());
    let has_special = password.chars().any(|c| !c.is_alphanumeric());

    if !(has_upper && has_lower && has_digit && has_special) {
        return Err("密码必须包含大写、小写、数字和特殊字符".to_string());
    }

    Ok(())
}

/// Export connections to encrypted .oxide file
#[tauri::command]
pub async fn export_to_oxide(
    connection_ids: Vec<String>,
    password: String,
    description: Option<String>,
    config_state: State<'_, Arc<ConfigState>>,
) -> Result<Vec<u8>, String> {
    info!(
        "Exporting {} connections to .oxide file",
        connection_ids.len()
    );

    // 1. Validate password strength
    validate_password(&password)?;

    // 2. Load selected connections from config
    let config = config_state.get_config_snapshot();
    let mut connections = Vec::new();

    for id in &connection_ids {
        let saved_conn = config
            .get_connection(id)
            .ok_or_else(|| format!("Connection {} not found", id))?;

        // Helper function to convert SavedAuth to EncryptedAuth
        let convert_auth = |auth: &SavedAuth, context: &str| -> Result<EncryptedAuth, String> {
            match auth {
                SavedAuth::Password { keychain_id } => {
                    let password = config_state
                        .get_keychain_value(keychain_id)
                        .map_err(|e| format!("Keychain error for {}: {}", context, e))?;
                    Ok(EncryptedAuth::Password { password })
                }
                SavedAuth::Key {
                    key_path,
                    has_passphrase,
                    passphrase_keychain_id,
                } => {
                    let passphrase =
                        if *has_passphrase {
                            if let Some(kc_id) = passphrase_keychain_id {
                                Some(config_state.get_keychain_value(kc_id).map_err(|e| {
                                    format!("Keychain error for {}: {}", context, e)
                                })?)
                            } else {
                                None
                            }
                        } else {
                            None
                        };
                    Ok(EncryptedAuth::Key {
                        key_path: key_path.clone(),
                        passphrase,
                    })
                }
                SavedAuth::Certificate {
                    key_path,
                    cert_path,
                    has_passphrase,
                    passphrase_keychain_id,
                } => {
                    let passphrase =
                        if *has_passphrase {
                            if let Some(kc_id) = passphrase_keychain_id {
                                Some(config_state.get_keychain_value(kc_id).map_err(|e| {
                                    format!("Keychain error for {}: {}", context, e)
                                })?)
                            } else {
                                None
                            }
                        } else {
                            None
                        };
                    Ok(EncryptedAuth::Certificate {
                        key_path: key_path.clone(),
                        cert_path: cert_path.clone(),
                        passphrase,
                    })
                }
                SavedAuth::Agent => Ok(EncryptedAuth::Agent),
            }
        };

        // Build encrypted proxy_chain from saved proxy_chain OR legacy jump_host
        let mut encrypted_proxy_chain: Vec<EncryptedProxyHop> = Vec::new();

        if !saved_conn.proxy_chain.is_empty() {
            // New proxy_chain format
            for (hop_index, hop) in saved_conn.proxy_chain.iter().enumerate() {
                let hop_auth = convert_auth(
                    &hop.auth,
                    &format!("hop {} of {}", hop_index, saved_conn.name),
                )?;
                encrypted_proxy_chain.push(EncryptedProxyHop {
                    host: hop.host.clone(),
                    port: hop.port,
                    username: hop.username.clone(),
                    auth: hop_auth,
                });
            }
        } else if let Some(jump_id) = &saved_conn.options.jump_host {
            // Legacy jump_host format - convert to proxy_chain
            let jump_conn = config.get_connection(jump_id).ok_or_else(|| {
                format!(
                    "Connection '{}' references jump host '{}' which does not exist. \
                    Please ensure all jump hosts are saved before exporting.",
                    saved_conn.name, jump_id
                )
            })?;
            let hop_auth = convert_auth(
                &jump_conn.auth,
                &format!("jump host of {}", saved_conn.name),
            )?;
            encrypted_proxy_chain.push(EncryptedProxyHop {
                host: jump_conn.host.clone(),
                port: jump_conn.port,
                username: jump_conn.username.clone(),
                auth: hop_auth,
            });
        }

        // Export target server with its proxy_chain
        let target_auth = convert_auth(&saved_conn.auth, &saved_conn.name)?;

        connections.push(EncryptedConnection {
            name: saved_conn.name.clone(),
            group: saved_conn.group.clone(),
            host: saved_conn.host.clone(),
            port: saved_conn.port,
            username: saved_conn.username.clone(),
            auth: target_auth,
            color: saved_conn.color.clone(),
            tags: saved_conn.tags.clone(),
            options: saved_conn.options.clone(),
            proxy_chain: encrypted_proxy_chain,
        });
    }

    // 3. Compute checksum and build payload
    let checksum = compute_checksum(&connections)
        .map_err(|e| format!("Failed to compute checksum: {:?}", e))?;

    let payload = EncryptedPayload {
        version: 1,
        connections: connections.clone(),
        checksum,
    };

    // 4. Build metadata
    let metadata = OxideMetadata {
        exported_at: Utc::now(),
        exported_by: format!("OxideTerm v{}", env!("CARGO_PKG_VERSION")),
        description,
        num_connections: connections.len(),
        connection_names: connections.iter().map(|c| c.name.clone()).collect(),
    };

    // 5. Encrypt
    let oxide_file = encrypt_oxide_file(&payload, &password, metadata)
        .map_err(|e| format!("Encryption failed: {:?}", e))?;

    // 6. Serialize to bytes
    let bytes = oxide_file
        .to_bytes()
        .map_err(|e| format!("Serialization failed: {:?}", e))?;

    info!(
        "Successfully exported {} connections ({} bytes)",
        connections.len(),
        bytes.len()
    );

    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_password_validation() {
        // Too short
        assert!(validate_password("Short1!").is_err());

        // No uppercase
        assert!(validate_password("nouppercase1!").is_err());

        // No lowercase
        assert!(validate_password("NOLOWERCASE1!").is_err());

        // No digits
        assert!(validate_password("NoDigits!abc").is_err());

        // No special characters
        assert!(validate_password("NoSpecial123Abc").is_err());

        // Valid
        assert!(validate_password("ValidPass123!").is_ok());
        assert!(validate_password("MySecureP@ssw0rd").is_ok());
    }
}
