//! Tauri commands for .oxide file export/import

use std::sync::Arc;
use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::{info, error};
use chrono::Utc;
use uuid::Uuid;

use crate::config::types::{SavedAuth, SavedConnection, CONFIG_VERSION};
use crate::commands::config::ConfigState;
use crate::oxide_file::{
    OxideMetadata, EncryptedPayload, EncryptedConnection, EncryptedAuth,
    encrypt_oxide_file, decrypt_oxide_file, compute_checksum,
};

#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub imported: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

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
    info!("Exporting {} connections to .oxide file", connection_ids.len());
    
    // 1. Validate password strength
    validate_password(&password)?;
    
    // 2. Load selected connections from config
    let config = config_state.get_config_snapshot();
    let mut connections = Vec::new();
    
    for id in &connection_ids {
        let saved_conn = config.get_connection(id)
            .ok_or_else(|| format!("Connection {} not found", id))?;
        
        // 3. Read passwords/passphrases from keychain
        let auth = match &saved_conn.auth {
            SavedAuth::Password { keychain_id } => {
                let password = config_state.get_keychain_value(keychain_id)
                    .map_err(|e| format!("Keychain error for {}: {}", id, e))?;
                EncryptedAuth::Password { password }
            }
            SavedAuth::Key { key_path, has_passphrase, passphrase_keychain_id } => {
                let passphrase = if *has_passphrase {
                    if let Some(kc_id) = passphrase_keychain_id {
                        Some(config_state.get_keychain_value(kc_id)
                            .map_err(|e| format!("Keychain error for {}: {}", id, e))?)
                    } else {
                        None
                    }
                } else {
                    None
                };
                EncryptedAuth::Key { 
                    key_path: key_path.clone(), 
                    passphrase 
                }
            }
            SavedAuth::Agent => EncryptedAuth::Agent,
        };
        
        connections.push(EncryptedConnection {
            name: saved_conn.name.clone(),
            group: saved_conn.group.clone(),
            host: saved_conn.host.clone(),
            port: saved_conn.port,
            username: saved_conn.username.clone(),
            auth,
            color: saved_conn.color.clone(),
            tags: saved_conn.tags.clone(),
            options: saved_conn.options.clone(),
        });
    }
    
    // 4. Compute checksum and build payload
    let checksum = compute_checksum(&connections)
        .map_err(|e| format!("Failed to compute checksum: {:?}", e))?;
    
    let payload = EncryptedPayload {
        version: 1,
        connections: connections.clone(),
        checksum,
    };
    
    // 5. Build metadata
    let metadata = OxideMetadata {
        exported_at: Utc::now(),
        exported_by: format!("OxideTerm v{}", env!("CARGO_PKG_VERSION")),
        description,
        num_connections: connections.len(),
        connection_names: connections.iter().map(|c| c.name.clone()).collect(),
    };
    
    // 6. Encrypt
    let oxide_file = encrypt_oxide_file(&payload, &password, metadata)
        .map_err(|e| format!("Encryption failed: {:?}", e))?;
    
    // 7. Serialize to bytes
    let bytes = oxide_file.to_bytes()
        .map_err(|e| format!("Serialization failed: {:?}", e))?;
    
    info!("Successfully exported {} connections ({} bytes)", connections.len(), bytes.len());
    
    Ok(bytes)
}

/// Validate .oxide file and extract metadata (without decryption)
#[tauri::command]
pub async fn validate_oxide_file(
    file_data: Vec<u8>,
) -> Result<OxideMetadata, String> {
    info!("Validating .oxide file ({} bytes)", file_data.len());
    
    let oxide_file = crate::oxide_file::OxideFile::from_bytes(&file_data)
        .map_err(|e| format!("Invalid .oxide file: {:?}", e))?;
    
    info!("Valid .oxide file: {} connections", oxide_file.metadata.num_connections);
    
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
    let payload = decrypt_oxide_file(&oxide_file, &password)
        .map_err(|e| match e {
            crate::oxide_file::OxideFileError::DecryptionFailed => {
                "密码错误或文件已损坏".to_string()
            }
            crate::oxide_file::OxideFileError::ChecksumMismatch => {
                "文件校验失败，数据可能被篡改".to_string()
            }
            _ => format!("解密失败: {:?}", e),
        })?;
    
    info!("Decryption successful, importing {} connections", payload.connections.len());
    
    // 3. Import all connections (all-or-nothing)
    let mut imported_count = 0;
    let mut errors = Vec::new();
    
    for enc_conn in payload.connections {
        let new_id = Uuid::new_v4().to_string();
        
        // Store passwords/passphrases in keychain
        let auth = match enc_conn.auth {
            EncryptedAuth::Password { password } => {
                let keychain_id = format!("oxide_conn_{}", new_id);
                if let Err(e) = config_state.set_keychain_value(&keychain_id, &password) {
                    errors.push(format!("Failed to store password for {}: {}", enc_conn.name, e));
                    continue;
                }
                SavedAuth::Password { keychain_id }
            }
            EncryptedAuth::Key { key_path, passphrase } => {
                let passphrase_keychain_id = if let Some(pass) = passphrase {
                    let kc_id = format!("oxide_key_{}", new_id);
                    if let Err(e) = config_state.set_keychain_value(&kc_id, &pass) {
                        errors.push(format!("Failed to store passphrase for {}: {}", enc_conn.name, e));
                        continue;
                    }
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
            EncryptedAuth::Agent => SavedAuth::Agent,
        };
        
        // Create SavedConnection
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
        };
        
        // Add to config using update closure
        config_state.update_config(|config| {
            config.add_connection(saved_conn);
        })?;
        
        imported_count += 1;
    }
    
    // 4. Persist to storage
    config_state.save_config().await
        .map_err(|e| format!("Failed to save config: {}", e))?;
    
    info!("Successfully imported {} connections", imported_count);
    
    Ok(ImportResult {
        imported: imported_count,
        skipped: 0,
        errors,
    })
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
