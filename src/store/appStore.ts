import { create } from 'zustand';
import { api } from '../lib/api';
import { 
  SessionInfo, 
  Tab, 
  ConnectRequest, 
  TabType,
  SessionState,
  ConnectionInfo,
  SessionDisconnectedPayload,
  SessionReconnectingPayload,
  SessionReconnectedPayload,
  SessionReconnectFailedPayload,
  SessionReconnectCancelledPayload,
  SshConnectionInfo,
  SshConnectRequest,
} from '../types';

interface ModalsState {
  newConnection: boolean;
  settings: boolean;
  editConnection: boolean;
  connectionManager: boolean; // 新增：连接管理面板
}

// 侧边栏区域类型
type SidebarSection = 'sessions' | 'sftp' | 'forwards' | 'connections';

interface AppStore {
  // State
  sessions: Map<string, SessionInfo>;
  connections: Map<string, SshConnectionInfo>; // 新增：连接池状态
  tabs: Tab[];
  activeTabId: string | null;
  sidebarCollapsed: boolean;
  sidebarActiveSection: SidebarSection;
  modals: ModalsState;
  savedConnections: ConnectionInfo[];
  groups: string[];
  selectedGroup: string | null;
  editingConnection: ConnectionInfo | null;
  networkOnline: boolean;
  reconnectPendingSessionId: string | null; // Session awaiting password for reconnect

  // Actions - Sessions (legacy, still working)
  connect: (request: ConnectRequest) => Promise<string>;
  disconnect: (sessionId: string) => Promise<void>;
  reconnect: (sessionId: string) => Promise<void>;
  reconnectWithPassword: (sessionId: string, password: string) => Promise<void>;
  cancelReconnectDialog: () => void;
  cancelReconnect: (sessionId: string) => Promise<void>;
  updateSessionState: (sessionId: string, state: SessionState, error?: string) => void;
  
  // Actions - Connection Pool (新 API)
  connectSsh: (request: SshConnectRequest) => Promise<string>;
  disconnectSsh: (connectionId: string) => Promise<void>;
  createTerminalSession: (connectionId: string, cols?: number, rows?: number) => Promise<SessionInfo>;
  closeTerminalSession: (sessionId: string) => Promise<void>;
  refreshConnections: () => Promise<void>;
  setConnectionKeepAlive: (connectionId: string, keepAlive: boolean) => Promise<void>;
  
  // Actions - Reconnect Events (internal)
  _handleSessionDisconnected: (payload: SessionDisconnectedPayload) => void;
  _handleSessionReconnecting: (payload: SessionReconnectingPayload) => void;
  _handleSessionReconnected: (payload: SessionReconnectedPayload) => void;
  _handleSessionReconnectFailed: (payload: SessionReconnectFailedPayload) => void;
  _handleSessionReconnectCancelled: (payload: SessionReconnectCancelledPayload) => void;
  
  // Actions - Network
  setNetworkOnline: (online: boolean) => void;
  
  // Actions - Tabs
  createTab: (type: TabType, sessionId: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  
  // Actions - UI
  toggleSidebar: () => void;
  setSidebarSection: (section: SidebarSection) => void;
  toggleModal: (modal: keyof ModalsState, isOpen: boolean) => void;
  
  // Actions - Connections & Groups
  loadSavedConnections: () => Promise<void>;
  loadGroups: () => Promise<void>;
  setSelectedGroup: (group: string | null) => void;
  connectToSaved: (connectionId: string) => Promise<void>;
  openConnectionEditor: (connectionId: string) => void;
  
  // Computed (Helper methods)
  getSession: (sessionId: string) => SessionInfo | undefined;
  getConnection: (connectionId: string) => SshConnectionInfo | undefined;
  getConnectionForSession: (sessionId: string) => SshConnectionInfo | undefined;
}

export const useAppStore = create<AppStore>((set, get) => ({
  sessions: new Map(),
  connections: new Map(), // 新增：连接池状态
  tabs: [],
  activeTabId: null,
  sidebarCollapsed: false,
  sidebarActiveSection: 'sessions',
  reconnectPendingSessionId: null,
  modals: {
    newConnection: false,
    settings: false,
    editConnection: false,
    connectionManager: false, // 新增
  },
  savedConnections: [],
  groups: [],
  selectedGroup: null,
  editingConnection: null,
  networkOnline: true,

  connect: async (request: ConnectRequest) => {
    try {
      // Use API layer
      const sessionInfo = await api.connect(request);
      
      set((state) => {
        const newSessions = new Map(state.sessions);
        newSessions.set(sessionInfo.id, sessionInfo);
        return { sessions: newSessions };
      });

      // State is managed by the backend - no fake timeout needed
      // The session state will be updated via WebSocket events or API responses

      // Open terminal tab by default
      get().createTab('terminal', sessionInfo.id);
      
      return sessionInfo.id;
    } catch (error) {
      console.error('Connection failed:', error);
      throw error;
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Connection Pool Actions (新架构)
  // ═══════════════════════════════════════════════════════════════════════════

  connectSsh: async (request: SshConnectRequest) => {
    try {
      const response = await api.sshConnect(request);
      
      // 更新连接池状态
      set((state) => {
        const newConnections = new Map(state.connections);
        newConnections.set(response.connectionId, response.connection);
        return { connections: newConnections };
      });
      
      console.log(`SSH connected: ${response.connectionId} (reused: ${response.reused})`);
      return response.connectionId;
    } catch (error) {
      console.error('SSH connection failed:', error);
      throw error;
    }
  },

  disconnectSsh: async (connectionId: string) => {
    try {
      await api.sshDisconnect(connectionId);
      
      set((state) => {
        const newConnections = new Map(state.connections);
        newConnections.delete(connectionId);
        
        // 关闭所有关联的终端 Tab
        const connection = state.connections.get(connectionId);
        const terminalIds = connection?.terminalIds || [];
        const newSessions = new Map(state.sessions);
        const newTabs = state.tabs.filter(t => {
          if (terminalIds.includes(t.sessionId)) {
            newSessions.delete(t.sessionId);
            return false;
          }
          return true;
        });
        
        let newActiveId = state.activeTabId;
        if (state.activeTabId && !newTabs.find(t => t.id === state.activeTabId)) {
          newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
        }

        return { 
          connections: newConnections,
          sessions: newSessions,
          tabs: newTabs,
          activeTabId: newActiveId
        };
      });
    } catch (error) {
      console.error('SSH disconnect failed:', error);
      throw error;
    }
  },

  createTerminalSession: async (connectionId: string, cols?: number, rows?: number) => {
    try {
      const response = await api.createTerminal({
        connectionId,
        cols,
        rows,
      });
      
      // 更新 sessions 和 connections
      set((state) => {
        const newSessions = new Map(state.sessions);
        newSessions.set(response.sessionId, response.session);
        
        // 更新连接的 terminalIds
        const newConnections = new Map(state.connections);
        const connection = newConnections.get(connectionId);
        if (connection) {
          newConnections.set(connectionId, {
            ...connection,
            terminalIds: [...connection.terminalIds, response.sessionId],
            refCount: connection.refCount + 1,
            state: 'active',
          });
        }
        
        return { sessions: newSessions, connections: newConnections };
      });
      
      // 创建终端 Tab
      get().createTab('terminal', response.sessionId);
      
      return response.session;
    } catch (error) {
      console.error('Create terminal failed:', error);
      throw error;
    }
  },

  closeTerminalSession: async (sessionId: string) => {
    try {
      await api.closeTerminal(sessionId);
      
      set((state) => {
        const newSessions = new Map(state.sessions);
        const session = newSessions.get(sessionId);
        newSessions.delete(sessionId);
        
        // 更新连接的引用计数
        const newConnections = new Map(state.connections);
        if (session?.connectionId) {
          const connection = newConnections.get(session.connectionId);
          if (connection) {
            const newTerminalIds = connection.terminalIds.filter(id => id !== sessionId);
            newConnections.set(session.connectionId, {
              ...connection,
              terminalIds: newTerminalIds,
              refCount: Math.max(0, connection.refCount - 1),
              state: newTerminalIds.length === 0 ? 'idle' : 'active',
            });
          }
        }
        
        return { sessions: newSessions, connections: newConnections };
      });
    } catch (error) {
      console.error('Close terminal failed:', error);
      throw error;
    }
  },

  refreshConnections: async () => {
    try {
      const connectionsList = await api.sshListConnections();
      set(() => {
        const newConnections = new Map<string, SshConnectionInfo>();
        for (const conn of connectionsList) {
          newConnections.set(conn.id, conn);
        }
        return { connections: newConnections };
      });
    } catch (error) {
      console.error('Refresh connections failed:', error);
    }
  },

  setConnectionKeepAlive: async (connectionId: string, keepAlive: boolean) => {
    try {
      await api.sshSetKeepAlive(connectionId, keepAlive);
      
      set((state) => {
        const newConnections = new Map(state.connections);
        const connection = newConnections.get(connectionId);
        if (connection) {
          newConnections.set(connectionId, { ...connection, keepAlive });
        }
        return { connections: newConnections };
      });
    } catch (error) {
      console.error('Set keep alive failed:', error);
      throw error;
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════

  disconnect: async (sessionId: string) => {
    try {
      await api.disconnect(sessionId);
      
      set((state) => {
        const newSessions = new Map(state.sessions);
        newSessions.delete(sessionId);
        
        // Close associated tabs
        const newTabs = state.tabs.filter(t => t.sessionId !== sessionId);
        let newActiveId = state.activeTabId;
        
        if (state.activeTabId && !newTabs.find(t => t.id === state.activeTabId)) {
          newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
        }

        return { 
          sessions: newSessions,
          tabs: newTabs,
          activeTabId: newActiveId
        };
      });
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  },

  reconnect: async (sessionId: string) => {
    const session = get().sessions.get(sessionId);
    if (!session) return;

    // Password auth requires user to re-enter password
    if (session.auth_type === 'password') {
      set({ reconnectPendingSessionId: sessionId });
      return;
    }

    // Update state to connecting
    get().updateSessionState(sessionId, 'connecting');

    try {
      // Disconnect existing session first
      await api.disconnect(sessionId).catch(() => {});
      
      // Determine auth_type for reconnection:
      // - 'agent' -> use agent
      // - 'key' with key_path -> use key with the specific path
      // - 'key' without key_path -> use default_key (fallback)
      // - 'default_key' -> use default_key
      let reconnectAuthType: 'key' | 'default_key' | 'agent' = 'default_key';
      let reconnectKeyPath: string | undefined = undefined;

      if (session.auth_type === 'agent') {
        reconnectAuthType = 'agent';
      } else if (session.auth_type === 'key' && session.key_path) {
        reconnectAuthType = 'key';
        reconnectKeyPath = session.key_path;
      }
      // else: default_key fallback

      // Reconnect with saved authentication info
      const newSession = await api.connect({
        host: session.host,
        port: session.port,
        username: session.username,
        auth_type: reconnectAuthType,
        key_path: reconnectKeyPath,
        name: session.name,
      });

      // Update session map with new session info but keep same sessionId in tabs
      set((state) => {
        const newSessions = new Map(state.sessions);
        newSessions.delete(sessionId); // Remove old
        newSessions.set(newSession.id, newSession); // Add new
        
        // Update tabs to point to new session
        const newTabs = state.tabs.map(tab => 
          tab.sessionId === sessionId 
            ? { ...tab, sessionId: newSession.id }
            : tab
        );
        
        return { sessions: newSessions, tabs: newTabs };
      });

      console.log(`Reconnected session: ${sessionId} -> ${newSession.id}`);
    } catch (error) {
      console.error('Reconnect failed:', error);
      get().updateSessionState(sessionId, 'error', String(error));
    }
  },

  reconnectWithPassword: async (sessionId: string, password: string) => {
    const session = get().sessions.get(sessionId);
    if (!session) {
      set({ reconnectPendingSessionId: null });
      return;
    }

    // Clear pending state
    set({ reconnectPendingSessionId: null });

    // Update state to connecting
    get().updateSessionState(sessionId, 'connecting');

    try {
      // Disconnect existing session first
      await api.disconnect(sessionId).catch(() => {});
      
      // Reconnect with password
      const newSession = await api.connect({
        host: session.host,
        port: session.port,
        username: session.username,
        auth_type: 'password',
        password,
        name: session.name,
      });

      // Update session map with new session info
      set((state) => {
        const newSessions = new Map(state.sessions);
        newSessions.delete(sessionId);
        newSessions.set(newSession.id, newSession);
        
        const newTabs = state.tabs.map(tab => 
          tab.sessionId === sessionId 
            ? { ...tab, sessionId: newSession.id }
            : tab
        );
        
        return { sessions: newSessions, tabs: newTabs };
      });

      console.log(`Reconnected session with password: ${sessionId} -> ${newSession.id}`);
    } catch (error) {
      console.error('Reconnect with password failed:', error);
      get().updateSessionState(sessionId, 'error', String(error));
    }
  },

  cancelReconnectDialog: () => {
    set({ reconnectPendingSessionId: null });
  },

  cancelReconnect: async (sessionId: string) => {
    try {
      await api.cancelReconnect(sessionId);
      // State will be updated via event handler
    } catch (error) {
      console.error('Failed to cancel reconnect:', error);
    }
  },

  updateSessionState: (sessionId, state, error) => {
    set((s) => {
      const session = s.sessions.get(sessionId);
      if (!session) return {};
      
      const newSessions = new Map(s.sessions);
      newSessions.set(sessionId, { ...session, state, error });
      return { sessions: newSessions };
    });
  },

  // Internal event handlers for Tauri events
  _handleSessionDisconnected: (payload: SessionDisconnectedPayload) => {
    console.log('Session disconnected:', payload);
    set((s) => {
      const session = s.sessions.get(payload.session_id);
      if (!session) return {};
      
      const newSessions = new Map(s.sessions);
      newSessions.set(payload.session_id, {
        ...session,
        state: payload.recoverable ? 'reconnecting' : 'disconnected',
        error: payload.reason,
        reconnectAttempt: payload.recoverable ? 0 : undefined,
      });
      return { sessions: newSessions };
    });
  },

  _handleSessionReconnecting: (payload: SessionReconnectingPayload) => {
    console.log('Session reconnecting:', payload);
    set((s) => {
      const session = s.sessions.get(payload.session_id);
      if (!session) return {};
      
      const newSessions = new Map(s.sessions);
      newSessions.set(payload.session_id, {
        ...session,
        state: 'reconnecting',
        reconnectAttempt: payload.attempt,
        reconnectMaxAttempts: payload.max_attempts,
        reconnectNextRetry: payload.next_attempt_at,
      });
      return { sessions: newSessions };
    });
  },

  _handleSessionReconnected: async (payload: SessionReconnectedPayload) => {
    console.log('Session reconnected:', payload);
    
    // Fetch updated session info to get new ws_url and ws_token
    try {
      const updatedSession = await api.getSession(payload.session_id);
      console.log('Fetched updated session info after reconnect:', updatedSession);
      
      set((s) => {
        const session = s.sessions.get(payload.session_id);
        if (!session) return {};
        
        const newSessions = new Map(s.sessions);
        newSessions.set(payload.session_id, {
          ...session,
          state: 'connected',
          ws_url: updatedSession.ws_url,
          ws_token: updatedSession.ws_token,
          error: undefined,
          reconnectAttempt: undefined,
          reconnectMaxAttempts: undefined,
          reconnectNextRetry: undefined,
        });
        return { sessions: newSessions };
      });
    } catch (error) {
      console.error('Failed to fetch updated session after reconnect:', error);
      // Still update the state even if we couldn't fetch new info
      set((s) => {
        const session = s.sessions.get(payload.session_id);
        if (!session) return {};
        
        const newSessions = new Map(s.sessions);
        newSessions.set(payload.session_id, {
          ...session,
          state: 'connected',
          error: undefined,
          reconnectAttempt: undefined,
          reconnectMaxAttempts: undefined,
          reconnectNextRetry: undefined,
        });
        return { sessions: newSessions };
      });
    }
  },

  _handleSessionReconnectFailed: (payload: SessionReconnectFailedPayload) => {
    console.log('Session reconnect failed:', payload);
    set((s) => {
      const session = s.sessions.get(payload.session_id);
      if (!session) return {};
      
      const newSessions = new Map(s.sessions);
      newSessions.set(payload.session_id, {
        ...session,
        state: 'error',
        error: `Reconnect failed after ${payload.total_attempts} attempts: ${payload.error}`,
        reconnectAttempt: undefined,
        reconnectMaxAttempts: undefined,
        reconnectNextRetry: undefined,
      });
      return { sessions: newSessions };
    });
  },

  _handleSessionReconnectCancelled: (payload: SessionReconnectCancelledPayload) => {
    console.log('Session reconnect cancelled:', payload);
    set((s) => {
      const session = s.sessions.get(payload.session_id);
      if (!session) return {};
      
      const newSessions = new Map(s.sessions);
      newSessions.set(payload.session_id, {
        ...session,
        state: 'disconnected',
        reconnectAttempt: undefined,
        reconnectMaxAttempts: undefined,
        reconnectNextRetry: undefined,
      });
      return { sessions: newSessions };
    });
  },

  setNetworkOnline: (online: boolean) => {
    set({ networkOnline: online });
    // Notify backend of network status change
    api.networkStatusChanged(online).catch((e) => {
      console.error('Failed to notify network status:', e);
    });
  },

  createTab: (type, sessionId) => {
    const session = get().sessions.get(sessionId);
    if (!session) return;

    // Check if a tab with the same type and sessionId already exists
    const existingTab = get().tabs.find(t => t.type === type && t.sessionId === sessionId);
    if (existingTab) {
      // Switch to existing tab instead of creating a new one
      set({ activeTabId: existingTab.id });
      return;
    }

    const newTab: Tab = {
      id: crypto.randomUUID(),
      type,
      sessionId,
      title: type === 'terminal' ? session.name : `${type === 'sftp' ? 'SFTP' : 'Forwards'}: ${session.name}`,
      icon: type === 'terminal' ? '>_' : type === 'sftp' ? '📁' : '🔀'
    };

    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: newTab.id
    }));
  },

  closeTab: (tabId) => {
    set((state) => {
      const newTabs = state.tabs.filter(t => t.id !== tabId);
      let newActiveId = state.activeTabId;

      if (state.activeTabId === tabId) {
        newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
      }

      return {
        tabs: newTabs,
        activeTabId: newActiveId
      };
    });
  },

  setActiveTab: (tabId) => {
    set({ activeTabId: tabId });
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  setSidebarSection: (section) => {
    set({ sidebarActiveSection: section });
  },
  
  toggleModal: (modal, isOpen) => {
    set((state) => ({
      modals: { ...state.modals, [modal]: isOpen }
    }));
  },

  loadSavedConnections: async () => {
    try {
      const connections = await api.getConnections();
      set({ savedConnections: connections });
    } catch (error) {
      console.error('Failed to load saved connections:', error);
    }
  },

  loadGroups: async () => {
    try {
      const groups = await api.getGroups();
      set({ groups });
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  },

  setSelectedGroup: (group) => {
    set({ selectedGroup: group });
  },

  connectToSaved: async (connectionId) => {
    try {
      // Get full connection info with credentials from backend
      const savedConn = await api.getSavedConnectionForConnect(connectionId);

      // Map auth_type for ConnectRequest
      const mapAuthType = (authType: string): 'password' | 'key' | 'default_key' | 'agent' => {
        if (authType === 'agent') return 'agent';
        if (authType === 'key') return 'key';
        if (authType === 'password') return 'password';
        return 'default_key';
      };

      // Build proxy_chain for ConnectRequest
      const proxyChain: ConnectRequest['proxy_chain'] = savedConn.proxy_chain.length > 0
        ? savedConn.proxy_chain.map((hop, index) => ({
            id: `hop-${index}`,
            host: hop.host,
            port: hop.port,
            username: hop.username,
            auth_type: mapAuthType(hop.auth_type),
            password: hop.password,
            key_path: hop.key_path,
            passphrase: hop.passphrase,
          }))
        : undefined;

      const request: ConnectRequest = {
        host: savedConn.host,
        port: savedConn.port,
        username: savedConn.username,
        auth_type: mapAuthType(savedConn.auth_type),
        password: savedConn.password,
        key_path: savedConn.key_path,
        passphrase: savedConn.passphrase,
        name: savedConn.name,
        proxy_chain: proxyChain,
      };

      await get().connect(request);
      await api.markConnectionUsed(connectionId);
    } catch (error) {
      console.error('Failed to connect to saved connection:', error);
      // Open editor on any error
      get().openConnectionEditor(connectionId);
    }
  },

  openConnectionEditor: (connectionId) => {
    const connection = get().savedConnections.find(c => c.id === connectionId);
    if (connection) {
      set({ editingConnection: connection });
      get().toggleModal('editConnection', true);
    }
  },

  getSession: (sessionId) => {
    return get().sessions.get(sessionId);
  },

  getConnection: (connectionId) => {
    return get().connections.get(connectionId);
  },

  getConnectionForSession: (sessionId) => {
    const session = get().sessions.get(sessionId);
    if (session?.connectionId) {
      return get().connections.get(session.connectionId);
    }
    return undefined;
  }
}));
