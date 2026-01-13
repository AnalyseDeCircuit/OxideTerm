import { invoke } from '@tauri-apps/api/core';
import { 
  SessionInfo, 
  ConnectRequest, 
  ConnectionInfo, 
  SaveConnectionRequest, 
  HealthMetrics,
  FileInfo,
  PreviewContent,
  ForwardRequest,
  ForwardRule,
  SshHostInfo,
  SshKeyInfo,
  PersistedSessionInfo,
  PersistedForwardInfo
} from '../types';

// Toggle this for development without a backend
const USE_MOCK = false;

// --- API Implementation ---

export const api = {
  // ============ Session Management ============
  connect: async (request: ConnectRequest): Promise<SessionInfo> => {
    if (USE_MOCK) return mockConnect(request);
    // Backend returns ConnectResponseV2, extract session info
    const response: any = await invoke('connect_v2', { request });
    return response.session || response; // Handle both formats
  },

  disconnect: async (sessionId: string): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('disconnect_v2', { sessionId });
  },

  listSessions: async (): Promise<SessionInfo[]> => {
    if (USE_MOCK) return [];
    return invoke('list_sessions_v2');
  },

  getSession: async (sessionId: string): Promise<SessionInfo> => {
    if (USE_MOCK) return mockConnect({ host: 'mock', port: 22, username: 'mock', auth_type: 'password' });
    return invoke('get_session', { sessionId });
  },

  getSessionStats: async (): Promise<any> => {
    if (USE_MOCK) return { total: 0, connected: 0, connecting: 0, failed: 0 };
    return invoke('get_session_stats');
  },

  resizeSession: async (sessionId: string, cols: number, rows: number): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('resize_session_v2', { sessionId, cols, rows });
  },

  reorderSessions: async (orderedIds: string[]): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('reorder_sessions', { orderedIds });
  },

  // ============ Session Persistence ============
  restoreSessions: async (): Promise<PersistedSessionInfo[]> => {
    if (USE_MOCK) return [];
    return invoke('restore_sessions');
  },

  listPersistedSessions: async (): Promise<string[]> => {
    if (USE_MOCK) return [];
    return invoke('list_persisted_sessions');
  },

  deletePersistedSession: async (sessionId: string): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('delete_persisted_session', { sessionId });
  },

  // ============ Connection Config ============
  getConnections: async (): Promise<ConnectionInfo[]> => {
    if (USE_MOCK) return mockConnections;
    return invoke('get_connections');
  },

  getRecentConnections: async (limit?: number): Promise<ConnectionInfo[]> => {
    if (USE_MOCK) return mockConnections.slice(0, limit || 5);
    return invoke('get_recent_connections', { limit: limit || null });
  },

  getConnectionsByGroup: async (group?: string): Promise<ConnectionInfo[]> => {
    if (USE_MOCK) return mockConnections.filter(c => c.group === group);
    return invoke('get_connections_by_group', { group: group || null });
  },

  searchConnections: async (query: string): Promise<ConnectionInfo[]> => {
    if (USE_MOCK) return mockConnections.filter(c => c.name.includes(query));
    return invoke('search_connections', { query });
  },

  saveConnection: async (request: SaveConnectionRequest): Promise<ConnectionInfo> => {
    if (USE_MOCK) return mockConnections[0];
    return invoke('save_connection', { request });
  },

  deleteConnection: async (id: string): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('delete_connection', { id });
  },

  markConnectionUsed: async (id: string): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('mark_connection_used', { id });
  },

  getConnectionPassword: async (id: string): Promise<string> => {
    if (USE_MOCK) return 'mock-password';
    return invoke('get_connection_password', { id });
  },
  
  // ============ Groups ============
  getGroups: async (): Promise<string[]> => {
    if (USE_MOCK) return ['Production', 'Development', 'Testing'];
    return invoke('get_groups');
  },
  
  createGroup: async (name: string): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('create_group', { name });
  },
  
  deleteGroup: async (name: string): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('delete_group', { name });
  },

  // ============ SSH Config & Keys ============
  listSshConfigHosts: async (): Promise<SshHostInfo[]> => {
    if (USE_MOCK) return [];
    return invoke('list_ssh_config_hosts');
  },
  
  importSshHost: async (alias: string): Promise<ConnectionInfo> => {
    if (USE_MOCK) throw new Error("Mock import not implemented");
    return invoke('import_ssh_host', { alias });
  },

  getSshConfigPath: async (): Promise<string> => {
    if (USE_MOCK) return '~/.ssh/config';
    return invoke('get_ssh_config_path');
  },
  
  checkSshKeys: async (): Promise<SshKeyInfo[]> => {
    if (USE_MOCK) return mockSshKeys;
    // Backend returns Vec<String> of key paths, transform to SshKeyInfo[]
    const paths: string[] = await invoke('check_ssh_keys');
    return paths.map(path => {
      const name = path.split('/').pop() || path;
      let key_type = 'Unknown';
      if (name.includes('ed25519')) key_type = 'ED25519';
      else if (name.includes('ecdsa')) key_type = 'ECDSA';
      else if (name.includes('rsa')) key_type = 'RSA';
      else if (name.includes('dsa')) key_type = 'DSA';
      return {
        name,
        path,
        key_type,
        has_passphrase: false // Cannot determine without trying to load
      };
    });
  },

  // ============ SFTP ============
  sftpInit: async (sessionId: string): Promise<string> => {
    if (USE_MOCK) return '/home/mock';
    return invoke('sftp_init', { sessionId });
  },

  sftpIsInitialized: async (sessionId: string): Promise<boolean> => {
    if (USE_MOCK) return true;
    return invoke('sftp_is_initialized', { sessionId });
  },

  sftpListDir: async (sessionId: string, path: string, filter?: any): Promise<FileInfo[]> => {
    if (USE_MOCK) return mockFiles;
    return invoke('sftp_list_dir', { sessionId, path, filter: filter || null });
  },

  sftpStat: async (sessionId: string, path: string): Promise<FileInfo> => {
    if (USE_MOCK) return mockFiles[0];
    return invoke('sftp_stat', { sessionId, path });
  },

  sftpPreview: async (sessionId: string, path: string): Promise<PreviewContent> => {
    if (USE_MOCK) return { Text: { data: 'Mock preview', mime_type: 'text/plain', language: null } };
    return invoke('sftp_preview', { sessionId, path });
  },

  sftpPreviewHex: async (sessionId: string, path: string, offset: number): Promise<PreviewContent> => {
    if (USE_MOCK) return { Hex: { data: '00000000  00 00 00 00 |....|', total_size: 16, offset: 0, chunk_size: 16, has_more: false } };
    return invoke('sftp_preview_hex', { sessionId, path, offset });
  },

  sftpDownload: async (sessionId: string, remotePath: string, localPath: string): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('sftp_download', { sessionId, remotePath, localPath });
  },

  sftpUpload: async (sessionId: string, localPath: string, remotePath: string): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('sftp_upload', { sessionId, localPath, remotePath });
  },

  sftpDelete: async (sessionId: string, path: string): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('sftp_delete', { sessionId, path });
  },

  sftpDeleteRecursive: async (sessionId: string, path: string): Promise<number> => {
    if (USE_MOCK) return 1;
    return invoke('sftp_delete_recursive', { sessionId, path });
  },

  sftpDownloadDir: async (sessionId: string, remotePath: string, localPath: string): Promise<number> => {
    if (USE_MOCK) return 0;
    return invoke('sftp_download_dir', { sessionId, remotePath, localPath });
  },

  sftpUploadDir: async (sessionId: string, localPath: string, remotePath: string): Promise<number> => {
    if (USE_MOCK) return 0;
    return invoke('sftp_upload_dir', { sessionId, localPath, remotePath });
  },

  sftpMkdir: async (sessionId: string, path: string): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('sftp_mkdir', { sessionId, path });
  },

  sftpRename: async (sessionId: string, oldPath: string, newPath: string): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('sftp_rename', { sessionId, oldPath, newPath });
  },

  sftpPwd: async (sessionId: string): Promise<string> => {
    if (USE_MOCK) return '/home/mock';
    return invoke('sftp_pwd', { sessionId });
  },

  sftpCd: async (sessionId: string, path: string): Promise<string> => {
    if (USE_MOCK) return path;
    return invoke('sftp_cd', { sessionId, path });
  },

  sftpClose: async (sessionId: string): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('sftp_close', { sessionId });
  },

  // Transfer Control
  sftpCancelTransfer: async (transferId: string): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('sftp_cancel_transfer', { transferId });
  },

  sftpPauseTransfer: async (transferId: string): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('sftp_pause_transfer', { transferId });
  },

  sftpResumeTransfer: async (transferId: string): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('sftp_resume_transfer', { transferId });
  },

  sftpTransferStats: async (): Promise<{ active: number; queued: number; completed: number }> => {
    if (USE_MOCK) return { active: 0, queued: 0, completed: 0 };
    return invoke('sftp_transfer_stats');
  },
  
  // ============ Port Forwarding ============
  listPortForwards: async (sessionId: string): Promise<ForwardRule[]> => {
    if (USE_MOCK) return [];
    return invoke('list_port_forwards', { sessionId });
  },
  
  createPortForward: async (request: ForwardRequest): Promise<any> => {
    if (USE_MOCK) return { success: true, forward: { id: 'mock-fwd-id' } };
    // Backend returns ForwardResponse
    return invoke('create_port_forward', { request });
  },

  stopPortForward: async (sessionId: string, forwardId: string): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('stop_port_forward', { sessionId, forwardId });
  },

  deletePortForward: async (sessionId: string, forwardId: string): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('delete_port_forward', { sessionId, forwardId });
  },

  restartPortForward: async (sessionId: string, forwardId: string): Promise<any> => {
    if (USE_MOCK) return { success: true, forward: { id: forwardId } };
    return invoke('restart_port_forward', { sessionId, forwardId });
  },

  updatePortForward: async (request: {
    session_id: string;
    forward_id: string;
    bind_address?: string;
    bind_port?: number;
    target_host?: string;
    target_port?: number;
    description?: string;
  }): Promise<any> => {
    if (USE_MOCK) return { success: true };
    return invoke('update_port_forward', { request });
  },

  getPortForwardStats: async (sessionId: string, forwardId: string): Promise<{
    connection_count: number;
    active_connections: number;
    bytes_sent: number;
    bytes_received: number;
  } | null> => {
    if (USE_MOCK) return null;
    return invoke('get_port_forward_stats', { sessionId, forwardId });
  },

  stopAllForwards: async (sessionId: string): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('stop_all_forwards', { sessionId });
  },

  forwardJupyter: async (sessionId: string, localPort: number, remotePort: number): Promise<any> => {
    if (USE_MOCK) return { success: true, forward: { id: 'mock-jupyter' } };
    return invoke('forward_jupyter', { sessionId, localPort, remotePort });
  },

  forwardTensorboard: async (sessionId: string, localPort: number, remotePort: number): Promise<any> => {
    if (USE_MOCK) return { success: true, forward: { id: 'mock-tensorboard' } };
    return invoke('forward_tensorboard', { sessionId, localPort, remotePort });
  },

  forwardVscode: async (sessionId: string, localPort: number, remotePort: number): Promise<any> => {
    if (USE_MOCK) return { success: true, forward: { id: 'mock-vscode' } };
    return invoke('forward_vscode', { sessionId, localPort, remotePort });
  },

  // ============ Forward Persistence ============
  listSavedForwards: async (sessionId: string): Promise<PersistedForwardInfo[]> => {
    if (USE_MOCK) return [];
    return invoke('list_saved_forwards', { sessionId });
  },

  setForwardAutoStart: async (forwardId: string, autoStart: boolean): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('set_forward_auto_start', { forwardId, autoStart });
  },

  deleteSavedForward: async (forwardId: string): Promise<void> => {
    if (USE_MOCK) return;
    return invoke('delete_saved_forward', { forwardId });
  },

  // ============ Health Check ============
  getConnectionHealth: async (sessionId: string): Promise<HealthMetrics> => {
    if (USE_MOCK) return mockHealthMetrics;
    return invoke('get_connection_health', { sessionId });
  },

  getQuickHealth: async (sessionId: string): Promise<any> => {
    if (USE_MOCK) return { session_id: sessionId, status: 'Healthy', latency_ms: 10 };
    return invoke('get_quick_health', { sessionId });
  },

  getAllHealthStatus: async (): Promise<Record<string, any>> => {
    if (USE_MOCK) return {};
    return invoke('get_all_health_status');
  },

  getHealthForDisplay: async (sessionId: string): Promise<any> => {
    if (USE_MOCK) return { session_id: sessionId, status: 'healthy', latency_ms: 10 };
    return invoke('get_health_for_display', { sessionId });
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
  { id: '1', name: 'Production DB', group: 'Production', host: '10.0.0.1', port: 22, username: 'admin', auth_type: 'key', key_path: '~/.ssh/id_rsa', created_at: '2023-09-01', last_used_at: '2023-10-01', color: null, tags: [] },
  { id: '2', name: 'Dev Server', group: 'Development', host: 'localhost', port: 2222, username: 'user', auth_type: 'password', key_path: null, created_at: '2023-09-15', last_used_at: '2023-10-02', color: null, tags: [] },
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

const mockHealthMetrics: HealthMetrics = {
  session_id: 'mock',
  uptime_secs: 120,
  ping_sent: 10,
  ping_received: 10,
  avg_latency_ms: 15,
  last_latency_ms: 12,
  status: 'Healthy'
};
