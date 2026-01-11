// Legacy types (v1)
export type { 
  ConnectResponse,
  ConnectionConfig,
  ConnectionStatus,
  Session,
} from './ssh';
// Rename legacy SessionInfo to avoid conflict
export type { SessionInfo as LegacySessionInfo } from './ssh';

// New types (v2)
export type {
  SessionState,
  AuthMethod,
  ConnectRequest,
  SessionInfo,  // v2 SessionInfo
  ConnectResponseV2,
  SessionStats,
  TabConfig,
} from './session';
