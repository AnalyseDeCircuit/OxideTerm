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
  authType: 'password' | 'key' | 'agent';
  keyPath: string | null;
  lastUsedAt: string | null;
}

export interface SaveConnectionRequest {
  id?: string;
  name: string;
  group: string | null;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key' | 'agent';
  password?: string;
  keyPath?: string;
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
  | { Base64: { data: string; mime_type: string | null } }
  | { TooLarge: { size: number } }
  | { Unsupported: { mime_type: string | null } };

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
  local_host: string;
  local_port: number;
  remote_host: string;
  remote_port: number;
}

export interface ForwardRule {
  id: string;
  forward_type: ForwardType;
  local_host: string;
  local_port: number;
  remote_host: string;
  remote_port: number;
  status: 'starting' | 'active' | 'stopped' | 'error';
}

// Health Types
export interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'unresponsive' | 'disconnected';
  latency_ms: number | null;
  last_check: number;
  uptime_secs: number;
}

export type HealthStatus = 'healthy' | 'degraded' | 'unresponsive' | 'disconnected';

// SSH Types
export interface SshHostInfo {
    alias: string;
    host: string;
    port: number;
    user: string;
    identity_file: string | null;
}

export interface SshKeyInfo {
  name: string;
  path: string;
  key_type: string;
  has_passphrase: boolean;
}
