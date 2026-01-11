/**
 * Session Store v2 with full state machine support
 * 
 * Features:
 * - State machine for session lifecycle
 * - Tab ordering with drag & drop support
 * - xterm instance pooling (CSS visibility)
 * - Connection limit enforcement
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import type { 
  SessionInfo, 
  SessionStats, 
  ConnectRequest, 
  ConnectResponseV2,
  TabConfig 
} from '../types';

// Maximum sessions allowed (should match backend)
const MAX_SESSIONS = 20;

interface SessionStoreState {
  // Session data
  sessions: Map<string, SessionInfo>;
  
  // Tab state
  tabs: TabConfig[];
  activeTabId: string | null;
  
  // Stats
  stats: SessionStats | null;
  
  // Loading states
  isConnecting: boolean;
  connectionError: string | null;
  
  // Actions
  connect: (request: ConnectRequest) => Promise<string>;
  disconnect: (sessionId: string) => Promise<void>;
  setActiveTab: (tabId: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  updateSession: (session: SessionInfo) => void;
  removeSession: (sessionId: string) => void;
  refreshSessions: () => Promise<void>;
  refreshStats: () => Promise<void>;
  
  // Selectors
  getActiveSession: () => SessionInfo | null;
  getSessionById: (id: string) => SessionInfo | undefined;
  canConnect: () => boolean;
}

export const useSessionStoreV2 = create<SessionStoreState>()(
  subscribeWithSelector((set, get) => ({
    sessions: new Map(),
    tabs: [],
    activeTabId: null,
    stats: null,
    isConnecting: false,
    connectionError: null,

    connect: async (request: ConnectRequest): Promise<string> => {
      // Check connection limit
      if (!get().canConnect()) {
        throw new Error(`Maximum ${MAX_SESSIONS} connections reached`);
      }

      set({ isConnecting: true, connectionError: null });

      try {
        // Call v2 connect command
        const response = await invoke<ConnectResponseV2>('connect_v2', { request });
        
        const { session } = response;
        
        // Add config helper for compatibility
        const sessionWithConfig: SessionInfo = {
          ...session,
          config: {
            host: session.host,
            port: session.port,
            username: session.username,
          },
        };
        
        // Update sessions map
        set(state => {
          const newSessions = new Map(state.sessions);
          newSessions.set(session.id, sessionWithConfig);
          
          // Create tab for new session
          const newTab: TabConfig = {
            id: `tab-${session.id}`,
            sessionId: session.id,
            title: session.name,
            color: session.color,
            isActive: true,
            isPinned: false,
          };
          
          // Deactivate other tabs
          const updatedTabs = state.tabs.map(t => ({ ...t, isActive: false }));
          
          return {
            sessions: newSessions,
            tabs: [...updatedTabs, newTab],
            activeTabId: newTab.id,
            isConnecting: false,
          };
        });

        return session.id;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        set({ isConnecting: false, connectionError: errorMsg });
        throw error;
      }
    },

    disconnect: async (sessionId: string): Promise<void> => {
      try {
        await invoke('disconnect_v2', { sessionId });
        
        set(state => {
          const newSessions = new Map(state.sessions);
          newSessions.delete(sessionId);
          
          // Remove tab
          const newTabs = state.tabs.filter(t => t.sessionId !== sessionId);
          
          // If active tab was removed, activate another
          let newActiveTabId = state.activeTabId;
          const removedTab = state.tabs.find(t => t.sessionId === sessionId);
          if (removedTab && removedTab.id === state.activeTabId) {
            newActiveTabId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
          }
          
          return {
            sessions: newSessions,
            tabs: newTabs,
            activeTabId: newActiveTabId,
          };
        });
      } catch (error) {
        console.error('Disconnect failed:', error);
        throw error;
      }
    },

    setActiveTab: (tabId: string) => {
      set(state => ({
        tabs: state.tabs.map(t => ({ ...t, isActive: t.id === tabId })),
        activeTabId: tabId,
      }));
    },

    reorderTabs: (fromIndex: number, toIndex: number) => {
      set(state => {
        const newTabs = [...state.tabs];
        const [moved] = newTabs.splice(fromIndex, 1);
        newTabs.splice(toIndex, 0, moved);
        
        // Sync order to backend
        const orderedIds = newTabs.map(t => t.sessionId);
        invoke('reorder_sessions', { orderedIds }).catch(console.error);
        
        return { tabs: newTabs };
      });
    },

    updateSession: (session: SessionInfo) => {
      set(state => {
        const newSessions = new Map(state.sessions);
        newSessions.set(session.id, session);
        
        // Update tab title if needed
        const newTabs = state.tabs.map(t => 
          t.sessionId === session.id 
            ? { ...t, title: session.name, color: session.color }
            : t
        );
        
        return { sessions: newSessions, tabs: newTabs };
      });
    },

    removeSession: (sessionId: string) => {
      set(state => {
        const newSessions = new Map(state.sessions);
        newSessions.delete(sessionId);
        
        const newTabs = state.tabs.filter(t => t.sessionId !== sessionId);
        
        let newActiveTabId = state.activeTabId;
        const removedTab = state.tabs.find(t => t.sessionId === sessionId);
        if (removedTab && removedTab.id === state.activeTabId) {
          newActiveTabId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
        }
        
        return {
          sessions: newSessions,
          tabs: newTabs,
          activeTabId: newActiveTabId,
        };
      });
    },

    refreshSessions: async () => {
      try {
        const sessions = await invoke<SessionInfo[]>('list_sessions_v2');
        
        set(state => {
          const newSessions = new Map<string, SessionInfo>();
          const existingTabIds = new Set(state.tabs.map(t => t.sessionId));
          const newTabs = [...state.tabs];
          
          for (const session of sessions) {
            newSessions.set(session.id, session);
            
            // Create tab if it doesn't exist
            if (!existingTabIds.has(session.id)) {
              newTabs.push({
                id: `tab-${session.id}`,
                sessionId: session.id,
                title: session.name,
                color: session.color,
                isActive: false,
                isPinned: false,
              });
            }
          }
          
          // Remove tabs for sessions that no longer exist
          const validSessionIds = new Set(sessions.map(s => s.id));
          const filteredTabs = newTabs.filter(t => validSessionIds.has(t.sessionId));
          
          return { sessions: newSessions, tabs: filteredTabs };
        });
      } catch (error) {
        console.error('Failed to refresh sessions:', error);
      }
    },

    refreshStats: async () => {
      try {
        const stats = await invoke<SessionStats>('get_session_stats');
        set({ stats });
      } catch (error) {
        console.error('Failed to refresh stats:', error);
      }
    },

    getActiveSession: () => {
      const state = get();
      if (!state.activeTabId) return null;
      
      const activeTab = state.tabs.find(t => t.id === state.activeTabId);
      if (!activeTab) return null;
      
      return state.sessions.get(activeTab.sessionId) ?? null;
    },

    getSessionById: (id: string) => {
      return get().sessions.get(id);
    },

    canConnect: () => {
      const state = get();
      const activeCount = Array.from(state.sessions.values())
        .filter(s => s.state === 'connecting' || s.state === 'connected')
        .length;
      return activeCount < MAX_SESSIONS;
    },
  }))
);

// Selector hooks for common patterns
export const useActiveSession = () => 
  useSessionStoreV2(state => state.getActiveSession());

export const useTabs = () => 
  useSessionStoreV2(state => state.tabs);

export const useSessionStats = () => 
  useSessionStoreV2(state => state.stats);

export const useIsConnecting = () => 
  useSessionStoreV2(state => state.isConnecting);

export const useConnectionError = () => 
  useSessionStoreV2(state => state.connectionError);
