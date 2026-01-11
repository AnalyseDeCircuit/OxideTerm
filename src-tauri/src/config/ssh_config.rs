//! SSH Config Parser
//!
//! Parses ~/.ssh/config to import existing SSH hosts.
//! Supports common directives: Host, HostName, User, Port, IdentityFile

use std::collections::HashMap;
use std::path::PathBuf;
use tokio::fs;

/// A parsed SSH config host entry
#[derive(Debug, Clone, Default)]
pub struct SshConfigHost {
    /// Host alias (the pattern after "Host")
    pub alias: String,
    /// Actual hostname (HostName directive)
    pub hostname: Option<String>,
    /// Username (User directive)
    pub user: Option<String>,
    /// Port number (Port directive)
    pub port: Option<u16>,
    /// Identity file path (IdentityFile directive)
    pub identity_file: Option<String>,
    /// Other directives we don't directly use
    pub other: HashMap<String, String>,
}

impl SshConfigHost {
    /// Get the effective hostname (hostname or alias)
    pub fn effective_hostname(&self) -> &str {
        self.hostname.as_deref().unwrap_or(&self.alias)
    }
    
    /// Get effective port (port or 22)
    pub fn effective_port(&self) -> u16 {
        self.port.unwrap_or(22)
    }
    
    /// Check if this is a wildcard pattern
    pub fn is_wildcard(&self) -> bool {
        self.alias.contains('*') || self.alias.contains('?')
    }
}

/// SSH config parser errors
#[derive(Debug, thiserror::Error)]
pub enum SshConfigError {
    #[error("Failed to determine home directory")]
    NoHomeDir,
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Parse error at line {line}: {message}")]
    Parse { line: usize, message: String },
}

/// Get default SSH config path
pub fn default_ssh_config_path() -> Result<PathBuf, SshConfigError> {
    dirs::home_dir()
        .map(|home| home.join(".ssh").join("config"))
        .ok_or(SshConfigError::NoHomeDir)
}

/// Parse SSH config file
pub async fn parse_ssh_config(path: Option<PathBuf>) -> Result<Vec<SshConfigHost>, SshConfigError> {
    let path = match path {
        Some(p) => p,
        None => default_ssh_config_path()?,
    };
    
    let content = match fs::read_to_string(&path).await {
        Ok(c) => c,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Ok(Vec::new());
        }
        Err(e) => return Err(SshConfigError::Io(e)),
    };
    
    parse_ssh_config_content(&content)
}

/// Parse SSH config content string
pub fn parse_ssh_config_content(content: &str) -> Result<Vec<SshConfigHost>, SshConfigError> {
    let mut hosts = Vec::new();
    let mut current_host: Option<SshConfigHost> = None;
    
    for (line_num, line) in content.lines().enumerate() {
        let line = line.trim();
        
        // Skip empty lines and comments
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        
        // Parse "Key Value" or "Key=Value"
        let (key, value) = if let Some(eq_pos) = line.find('=') {
            let key = line[..eq_pos].trim();
            let value = line[eq_pos + 1..].trim();
            (key, value)
        } else {
            let parts: Vec<&str> = line.splitn(2, char::is_whitespace).collect();
            if parts.len() < 2 {
                continue; // Skip malformed lines
            }
            (parts[0], parts[1].trim())
        };
        
        let key_lower = key.to_lowercase();
        
        if key_lower == "host" {
            // Save previous host if exists
            if let Some(host) = current_host.take() {
                if !host.is_wildcard() {
                    hosts.push(host);
                }
            }
            
            // Handle multiple hosts on same line (e.g., "Host foo bar")
            for alias in value.split_whitespace() {
                // For now, we only take the first non-wildcard host
                if !alias.contains('*') && !alias.contains('?') {
                    current_host = Some(SshConfigHost {
                        alias: alias.to_string(),
                        ..Default::default()
                    });
                    break;
                }
            }
        } else if let Some(ref mut host) = current_host {
            match key_lower.as_str() {
                "hostname" => host.hostname = Some(value.to_string()),
                "user" => host.user = Some(value.to_string()),
                "port" => {
                    host.port = value.parse().ok();
                }
                "identityfile" => {
                    // Expand ~ to home directory
                    let expanded = if value.starts_with("~/") {
                        if let Some(home) = dirs::home_dir() {
                            home.join(&value[2..]).to_string_lossy().into_owned()
                        } else {
                            value.to_string()
                        }
                    } else {
                        value.to_string()
                    };
                    host.identity_file = Some(expanded);
                }
                // Store other useful directives
                "proxycommand" | "proxyjump" | "localforward" | "remoteforward" => {
                    host.other.insert(key.to_string(), value.to_string());
                }
                _ => {} // Ignore other directives
            }
        }
    }
    
    // Don't forget the last host
    if let Some(host) = current_host {
        if !host.is_wildcard() {
            hosts.push(host);
        }
    }
    
    Ok(hosts)
}

/// Filter hosts suitable for import (non-wildcard, has hostname or is valid)
pub fn filter_importable_hosts(hosts: Vec<SshConfigHost>) -> Vec<SshConfigHost> {
    hosts
        .into_iter()
        .filter(|h| !h.is_wildcard())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_parse_basic() {
        let content = r#"
# Comment
Host myserver
    HostName example.com
    User admin
    Port 2222
    IdentityFile ~/.ssh/id_rsa

Host otherserver
    HostName other.com
    User root
"#;
        
        let hosts = parse_ssh_config_content(content).unwrap();
        assert_eq!(hosts.len(), 2);
        
        assert_eq!(hosts[0].alias, "myserver");
        assert_eq!(hosts[0].hostname, Some("example.com".to_string()));
        assert_eq!(hosts[0].user, Some("admin".to_string()));
        assert_eq!(hosts[0].port, Some(2222));
        assert!(hosts[0].identity_file.is_some());
        
        assert_eq!(hosts[1].alias, "otherserver");
        assert_eq!(hosts[1].effective_port(), 22);
    }
    
    #[test]
    fn test_skip_wildcards() {
        let content = r#"
Host *
    ServerAliveInterval 60
    
Host dev-*
    User developer
    
Host prod
    HostName prod.example.com
"#;
        
        let hosts = parse_ssh_config_content(content).unwrap();
        assert_eq!(hosts.len(), 1);
        assert_eq!(hosts[0].alias, "prod");
    }
    
    #[test]
    fn test_effective_values() {
        let host = SshConfigHost {
            alias: "myhost".to_string(),
            hostname: None,
            port: None,
            ..Default::default()
        };
        
        assert_eq!(host.effective_hostname(), "myhost");
        assert_eq!(host.effective_port(), 22);
    }
}
