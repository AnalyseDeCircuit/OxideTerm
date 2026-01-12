import { invoke } from '@tauri-apps/api/core';
import { 
  SessionInfo, 
  ConnectRequest, 
  ConnectionInfo, 
  SaveConnectionRequest, 
  HealthMetrics,
  HealthStatus,
  FileInfo,
  PreviewContent,
  TransferProgress,
  ForwardRequest,
  ForwardRule,
  SshHostInfo,
  SshKeyInfo
} from '../types';

// Toggle this for development without a backend
const USE_MOCK = false;

// --- API Implementation ---

export const api = {
  // Session Management
  connect: async (request: ConnectRequest): Promise<SessionInfo> => {
    if (USE_MOCK) return mockConnect(request);
    return invoke('connect_v2', { request });
  },

  disconnect: async (sessionId: string): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('disconnect_v2', { sessionId });
  },

  listSessions: async (): Promise<SessionInfo[]> => {
    if (USE_MOCK) return [];
    return invoke('list_sessions_v2');
  },

  resizeSession: async (sessionId: string, cols: number, rows: number): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('resize_session_v2', { sessionId, cols, rows });
  },

  // Connection Config
  getConnections: async (): Promise<ConnectionInfo[]> => {
    if (USE_MOCK) return mockConnections;
    return invoke('get_connections');
  },

  saveConnection: async (request: SaveConnectionRequest): Promise<string> => {
    if (USE_MOCK) return 'mock-id';
    return invoke('save_connection', { request });
  },

  deleteConnection: async (id: string): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('delete_connection', { id });
  },

  // SSH Config & Keys
  listSshConfigHosts: async (): Promise<SshHostInfo[]> => {
    if (USE_MOCK) return [];
    return invoke('list_ssh_config_hosts');
  },
  
  checkSshKeys: async (): Promise<SshKeyInfo[]> => {
    if (USE_MOCK) return mockSshKeys;
    return invoke('check_ssh_keys');
  },

  // SFTP
  sftpListDir: async (sessionId: string, path: string): Promise<FileInfo[]> => {
    if (USE_MOCK) return mockFiles;
    return invoke('sftp_list_dir', { sessionId, path, filter: null });
  },

  sftpUpload: async (sessionId: string, localPath: string, remotePath: string): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('sftp_upload', { sessionId, localPath, remotePath });
  },
  
  // Port Forwarding
  listPortForwards: async (sessionId: string): Promise<ForwardRule[]> => {
    if (USE_MOCK) return [];
    return invoke('list_port_forwards', { sessionId });
  },
  
  createPortForward: async (request: ForwardRequest): Promise<string> => {
    if (USE_MOCK) return 'mock-fwd-id';
    return invoke('create_port_forward', { request });
  }
};


// --- Mock Data Helpers ---

const mockConnect = async (req: ConnectRequest): Promise<SessionInfo> => {
  await new Promise(r => setTimeout(r, 500));
  return {
    id: crypto.randomUUID(),
    name: req.name || req.host,
    host: req.host,
    port: req.port,
    username: req.username,
    state: 'connected',
    color: '#3b82f6',
    uptime_secs: 0
  };
};

const mockConnections: ConnectionInfo[] = [
  { id: '1', name: 'Production DB', group: 'Production', host: '10.0.0.1', port: 22, username: 'admin', authType: 'key', keyPath: '~/.ssh/id_rsa', lastUsedAt: '2023-10-01' },
  { id: '2', name: 'Dev Server', group: 'Development', host: 'localhost', port: 2222, username: 'user', authType: 'password', keyPath: null, lastUsedAt: '2023-10-02' },
];

const mockSshKeys: SshKeyInfo[] = [
  { name: 'id_rsa', path: '/Users/mock/.ssh/id_rsa', key_type: 'RSA', has_passphrase: true },
  { name: 'id_ed25519', path: '/Users/mock/.ssh/id_ed25519', key_type: 'ED25519', has_passphrase: false },
];

const mockFiles: FileInfo[] = [
    { name: 'Documents', path: '/home/user/Documents', file_type: 'Directory', size: 0, modified: Date.now(), permissions: 'drwxr-xr-x' },
    { name: 'Downloads', path: '/home/user/Downloads', file_type: 'Directory', size: 0, modified: Date.now(), permissions: 'drwxr-xr-x' },
    { name: 'project.rs', path: '/home/user/project.rs', file_type: 'File', size: 1024, modified: Date.now(), permissions: '-rw-r--r--' },
];
