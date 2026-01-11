// Session types matching Rust backend

/**
 * Session state machine states
 */
export type SessionState = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

/**
 * Authentication method configuration
 */
export type AuthMethod = 
  | { type: 'password'; password: string }
  | { type: 'key'; key_path: string; passphrase?: string }
  | { type: 'default_key'; passphrase?: string };

/**
 * Connect request sent to backend
 */
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
}

/**
 * Session info returned from backend
 */
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
  order: number;
}

/**
 * Connect response from backend (v2)
 */
export interface ConnectResponseV2 {
  session_id: string;
  ws_url: string;
  port: number;
  session: SessionInfo;
}

/**
 * Session statistics
 */
export interface SessionStats {
  total: number;
  connected: number;
  connecting: number;
  error: number;
  max_sessions: number;
}

/**
 * Tab configuration for UI
 */
export interface TabConfig {
  id: string;
  sessionId: string;
  title: string;
  color: string;
  isActive: boolean;
  isPinned: boolean;
}

// Legacy types for backward compatibility - don't re-export conflicting names
// export * from './ssh';
