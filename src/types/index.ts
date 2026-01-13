// Session Types
export type SessionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SessionInfo {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  state: SessionState;
  error?: string;
  ws_url?: string;
  ws_token?: string; // Authentication token for WebSocket connection
  color: string;
  uptime_secs: number;
}

export interface ProxyHopConfig {
  id: string;
  host: string;
  port: number;
  username: string;
  auth_type: 'password' | 'key' | 'default_key';
  password?: string;
  key_path?: string;
  passphrase?: string;
}

export interface ConnectRequest {
  host: string;
  port: number;
  username: string;
  auth_type: 'password' | 'key' | 'default_key';
  password?: string;
  key_path?: string;
  passphrase?: string;
  cols?: number;
  rows?: number;
  name?: string;
  group?: string;
  proxy_chain?: ProxyHopConfig[];
}

// Persisted Session Types
export interface PersistedSessionInfo {
  id: string;
  host: string;
  port: number;
  username: string;
  name?: string;
  created_at: string;
  order: number;
}

// Tab Types
export type TabType = 'terminal' | 'sftp' | 'forwards';

export interface Tab {
  id: string;
  type: TabType;
  sessionId: string;
  title: string;
  icon?: string;
}

// Connection Config Types
export interface ConnectionInfo {
  id: string;
  name: string;
  group: string | null;
  host: string;
  port: number;
  username: string;
  auth_type: 'password' | 'key' | 'agent';
  key_path: string | null;
  created_at: string;
  last_used_at: string | null;
  color: string | null;
  tags: string[];
}

export interface OxideMetadata {
  exported_at: string;
  exported_by: string;
  description?: string;
  num_connections: number;
  connection_names: string[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface SaveConnectionRequest {
  id?: string;
  name: string;
  group: string | null;
  host: string;
  port: number;
  username: string;
  auth_type: 'password' | 'key' | 'agent';
  password?: string;
  key_path?: string;
  color?: string;
  tags?: string[];
}

// Terminal Config
export interface TerminalConfig {
  themeId: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  cursorWidth: number;
  scrollback: number;
  rightClickSelectsWord: boolean;
  macOptionIsMeta: boolean;
  altClickMovesCursor: boolean;
  bellStyle: 'none' | 'sound' | 'visual' | 'both';
  linkHandler: boolean;
}

// App Settings
export interface AppSettings {
  sidebarDefaultCollapsed: boolean;
  defaultPort: number;
  defaultUsername: string;
}

// SFTP Types
export type FileType = 'File' | 'Directory' | 'Symlink' | 'Unknown';

export interface FileInfo {
  name: string;
  path: string;
  file_type: FileType;
  size: number;
  modified: number | null;
  permissions: string | null;
}

export type PreviewContent =
  | { Text: { data: string; mime_type: string | null; language: string | null } }
  | { Image: { data: string; mime_type: string } }
  | { Video: { data: string; mime_type: string } }
  | { Audio: { data: string; mime_type: string } }
  | { Pdf: { data: string; original_mime: string | null } }
  | { Hex: { data: string; total_size: number; offset: number; chunk_size: number; has_more: boolean } }
  | { TooLarge: { size: number; max_size: number; recommend_download: boolean } }
  | { Unsupported: { mime_type: string; reason: string } };

export interface TransferProgress {
  transferred: number;
  total: number;
  percentage: number;
  state: 'Pending' | 'InProgress' | 'Completed' | { Failed: string };
}

// Port Forwarding Types
export type ForwardType = 'local' | 'remote' | 'dynamic';

export interface ForwardRequest {
  session_id: string;
  forward_type: ForwardType;
  bind_address: string;
  bind_port: number;
  target_host: string;
  target_port: number;
  description?: string;
  check_health?: boolean; // Default: true - check port availability before creating forward
}

// Persisted Forward Types
export interface PersistedForwardInfo {
  id: string;
  session_id: string;
  forward_type: string;
  bind_address: string;
  bind_port: number;
  target_host: string;
  target_port: number;
  auto_start: boolean;
  created_at: string;
}

export interface ForwardRule {
  id: string;
  forward_type: ForwardType;
  bind_address: string;
  bind_port: number;
  target_host: string;
  target_port: number;
  status: 'starting' | 'active' | 'stopped' | 'error';
  description?: string;
}

// Health Types
export interface HealthMetrics {
  session_id: string;
  uptime_secs: number;
  ping_sent: number;
  ping_received: number;
  avg_latency_ms: number | null;
  last_latency_ms: number | null;
  status: 'Healthy' | 'Degraded' | 'Unresponsive' | 'Disconnected' | 'Unknown';
}

export type HealthStatus = 'Healthy' | 'Degraded' | 'Unresponsive' | 'Disconnected' | 'Unknown';

// SSH Types
export interface SshHostInfo {
    alias: string;
    hostname: string;
    user: string | null;
    port: number;
    identity_file: string | null;
}

export interface SshKeyInfo {
  name: string;
  path: string;
  key_type: string;
  has_passphrase: boolean;
}
