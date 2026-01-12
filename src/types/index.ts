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
