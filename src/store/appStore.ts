import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { 
  SessionInfo, 
  Tab, 
  ConnectRequest, 
  TabType,
  SessionState
} from '../types';

interface AppStore {
  // State
  sessions: Map<string, SessionInfo>;
  tabs: Tab[];
  activeTabId: string | null;
  sidebarCollapsed: boolean;
  sidebarActiveSection: 'sessions' | 'sftp' | 'forwards';

  // Actions - Sessions
  connect: (request: ConnectRequest) => Promise<string>;
  disconnect: (sessionId: string) => Promise<void>;
  updateSessionState: (sessionId: string, state: SessionState, error?: string) => void;
  
  // Actions - Tabs
  createTab: (type: TabType, sessionId: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  
  // Actions - UI
  toggleSidebar: () => void;
  setSidebarSection: (section: 'sessions' | 'sftp' | 'forwards') => void;
  
  // Computed (Helper methods)
  getSession: (sessionId: string) => SessionInfo | undefined;
}

export const useAppStore = create<AppStore>((set, get) => ({
  sessions: new Map(),
  tabs: [],
  activeTabId: null,
  sidebarCollapsed: false,
  sidebarActiveSection: 'sessions',

  connect: async (request: ConnectRequest) => {
    // 1. Call Backend to initiate connection
    try {
      // TODO: Uncomment when backend is ready
      // const sessionInfo = await invoke<SessionInfo>('connect_v2', { request });
      
      // MOCK for now
      const sessionId = crypto.randomUUID();
      const sessionInfo: SessionInfo = {
        id: sessionId,
        name: request.name || `${request.username}@${request.host}`,
        host: request.host,
        port: request.port,
        username: request.username,
        state: 'connecting',
        color: '#3b82f6', // blue-500
        uptime_secs: 0
      };
      
      set((state) => {
        const newSessions = new Map(state.sessions);
        newSessions.set(sessionInfo.id, sessionInfo);
        return { sessions: newSessions };
      });

      // Simulate connection success
      setTimeout(() => {
        get().updateSessionState(sessionId, 'connected');
      }, 1000);

      // Open terminal tab by default
      get().createTab('terminal', sessionId);
      
      return sessionId;
    } catch (error) {
      console.error('Connection failed:', error);
      throw error;
    }
  },

  disconnect: async (sessionId: string) => {
    try {
      // await invoke('disconnect_v2', { sessionId });
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

  updateSessionState: (sessionId, state, error) => {
    set((s) => {
      const session = s.sessions.get(sessionId);
      if (!session) return {};
      
      const newSessions = new Map(s.sessions);
      newSessions.set(sessionId, { ...session, state, error });
      return { sessions: newSessions };
    });
  },

  createTab: (type, sessionId) => {
    const session = get().sessions.get(sessionId);
    if (!session) return;

    const newTab: Tab = {
      id: crypto.randomUUID(),
      type,
      sessionId,
      title: type === 'terminal' ? session.name : `${type}: ${session.name}`,
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

  getSession: (sessionId) => {
    return get().sessions.get(sessionId);
  }
}));
