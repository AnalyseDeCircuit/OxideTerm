// SSH connection types

export interface ConnectResponse {
  session_id: string;
  ws_url: string;
  port: number;
}

export interface SessionInfo {
  session_id: string;
  port: number;
  ws_url: string;
  uptime_secs: number;
}

export interface ConnectionConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  keyPath?: string;
  passphrase?: string;
}

export type ConnectionStatus = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface Session {
  id: string;
  config: ConnectionConfig;
  status: ConnectionStatus;
  wsUrl?: string;
  error?: string;
  createdAt: Date;
}
