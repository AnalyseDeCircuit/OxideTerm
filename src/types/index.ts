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
  color: string;
  uptime_secs: number;
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
  | { Text: { data: string; mime_type: string | null } }
  | { Base64: { data: string; mime_type: string } }
  | { TooLarge: { size: number; max_size: number } }
  | { Unsupported: { mime_type: string } };

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
