// Session Types
export type SessionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';
export type AuthType = 'password' | 'key' | 'default_key' | 'agent';

// ═══════════════════════════════════════════════════════════════════════════
// SSH Connection Pool Types (New Architecture)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Connection state in the connection pool
 */
export type SshConnectionState = 'connecting' | 'active' | 'idle' | 'disconnecting' | 'disconnected' | { error: string };

/**
 * SSH connection info from the connection pool
 */
export interface SshConnectionInfo {
  id: string;
  host: string;
  port: number;
  username: string;
  state: SshConnectionState;
  refCount: number;
  keepAlive: boolean;
  createdAt: string;
  lastActive: string;
  terminalIds: string[];
  sftpSessionId?: string;
  forwardIds: string[];
}

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  idleTimeoutSecs: number;
  maxConnections: number;
  protectOnExit: boolean;
}

/**
 * SSH connect request (new API)
 */
export interface SshConnectRequest {
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key' | 'default_key' | 'agent';
  password?: string;
  keyPath?: string;
  passphrase?: string;
  name?: string;
  reuseConnection?: boolean;
}

/**
 * SSH connect response
 */
export interface SshConnectResponse {
  connectionId: string;
  reused: boolean;
  connection: SshConnectionInfo;
}

/**
 * Create terminal request
 */
export interface CreateTerminalRequest {
  connectionId: string;
  cols?: number;
  rows?: number;
  maxBufferLines?: number;
}

/**
 * Create terminal response
 */
export interface CreateTerminalResponse {
  sessionId: string;
  wsUrl: string;
  port: number;
  wsToken: string;
  session: SessionInfo;
}

// ═══════════════════════════════════════════════════════════════════════════
// Global Event Map Extensions (TS 5.8+ strict typing for custom events)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Settings changed event detail - matches PersistedSettings from SettingsModal
 */
export interface SettingsChangedDetail {
  theme: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  scrollback: number;
  bufferMaxLines: number;
  bufferSaveOnDisconnect: boolean;
  sidebarCollapsedDefault: boolean;
  defaultUsername: string;
  defaultPort: number;
}

declare global {
  interface WindowEventMap {
    'settings-changed': CustomEvent<SettingsChangedDetail>;
  }
}

// ═══════════════════════════════════════════════════════════════════════════

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
  order: number; // Tab order
  // Connection pool integration (新架构)
  connectionId?: string; // 关联的 SSH 连接 ID
  // Authentication info for reconnection
  auth_type: AuthType;
  key_path?: string; // Only for key auth (password is never stored)
  // Reconnection state
  reconnectAttempt?: number;
  reconnectMaxAttempts?: number;
  reconnectNextRetry?: number; // timestamp in milliseconds
}

export interface ProxyHopConfig {
  id: string;
  host: string;
  port: number;
  username: string;
  auth_type: 'password' | 'key' | 'default_key' | 'agent';
  password?: string;
  key_path?: string;
  passphrase?: string;
}

export interface BufferConfig {
  max_lines: number;
  save_on_disconnect: boolean;
}

export interface ConnectRequest {
  host: string;
  port: number;
  username: string;
  auth_type: 'password' | 'key' | 'default_key' | 'agent';
  password?: string;
  key_path?: string;
  passphrase?: string;
  cols?: number;
  rows?: number;
  name?: string;
  group?: string;
  proxy_chain?: ProxyHopConfig[];
  buffer_config?: BufferConfig;
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

/**
 * Proxy hop info for display (without sensitive credentials)
 * Corresponds to backend ProxyHopInfo
 */
export interface ProxyHopInfo {
  host: string;
  port: number;
  username: string;
  auth_type: 'password' | 'key' | 'agent';
  key_path?: string;
}

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
  proxy_chain?: ProxyHopInfo[];
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

// SFTP Sort Order
export type SortOrder = 'Name' | 'NameDesc' | 'Size' | 'SizeDesc' | 'Modified' | 'ModifiedDesc' | 'Type' | 'TypeDesc';

// SFTP List Filter
export interface ListFilter {
  show_hidden?: boolean;
  pattern?: string | null;
  sort?: SortOrder;
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

// Forward Response from backend
export interface ForwardRuleDto {
  id: string;
  forward_type: string;
  bind_address: string;
  bind_port: number;
  target_host: string;
  target_port: number;
  status: string;
  description?: string;
}

export interface ForwardResponse {
  success: boolean;
  forward?: ForwardRuleDto;
  error?: string;
}

// Session Stats
export interface SessionStats {
  total: number;
  connected: number;
  connecting: number;
  error: number;
  max_sessions?: number;
}

// Quick Health Check
export interface QuickHealthCheck {
  session_id: string;
  status: HealthStatus;
  latency_ms: number | null;
  message: string;
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

// Reconnection Event Types (from Tauri backend)
export interface SessionDisconnectedPayload {
  session_id: string;
  reason: string;
  recoverable: boolean; // Whether auto-reconnect will be attempted
}

export interface SessionReconnectingPayload {
  session_id: string;
  attempt: number;
  max_attempts: number;
  delay_ms: number;
  next_attempt_at?: number; // Unix timestamp in milliseconds
}

export interface SessionReconnectedPayload {
  session_id: string;
  attempt: number;
}

export interface SessionReconnectFailedPayload {
  session_id: string;
  total_attempts: number;
  error: string;
}

export interface SessionReconnectCancelledPayload {
  session_id: string;
}

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

// Scroll Buffer Types
export interface TerminalLine {
  text: string;
  timestamp: number;
}

export interface BufferStats {
  current_lines: number;
  total_lines: number;
  max_lines: number;
  memory_usage_mb: number;
}

// Search Types
export interface SearchOptions {
  query: string;
  case_sensitive: boolean;
  regex: boolean;
  whole_word: boolean;
}

export interface SearchMatch {
  line_number: number;
  column_start: number;
  column_end: number;
  matched_text: string;
  line_content: string;
}

export interface SearchResult {
  matches: SearchMatch[];
  total_matches: number;
  duration_ms: number;
}

// SFTP Resume Transfer Types
export type TransferStatusType = 'Active' | 'Paused' | 'Failed' | 'Completed' | 'Cancelled';
export type TransferType = 'Upload' | 'Download';

/**
 * Stored transfer progress from persistent storage
 * Corresponds to backend StoredTransferProgress
 */
export interface StoredTransferProgress {
  transfer_id: string;
  transfer_type: TransferType;
  source_path: string;
  destination_path: string;
  transferred_bytes: number;
  total_bytes: number;
  status: TransferStatusType;
  last_updated: string; // ISO datetime
  session_id: string;
  error?: string;
}

/**
 * Incomplete transfer info for UI display
 */
export interface IncompleteTransferInfo {
  transfer_id: string;
  transfer_type: TransferType;
  source_path: string;
  destination_path: string;
  transferred_bytes: number;
  total_bytes: number;
  status: TransferStatusType;
  session_id: string;
  error?: string;
  progress_percent: number;
  can_resume: boolean;
}
