import { create } from 'zustand';
import { Session, ConnectionConfig, ConnectionStatus, ConnectResponse } from '../types';
import { invoke } from '@tauri-apps/api/core';

interface SessionState {
  sessions: Map<string, Session>;
  activeSessionId: string | null;
  
  // Actions
  addSession: (config: ConnectionConfig) => Promise<string>;
  removeSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string | null) => void;
  updateSessionStatus: (sessionId: string, status: ConnectionStatus, error?: string) => void;
  updateSessionWsUrl: (sessionId: string, wsUrl: string) => void;
  getActiveSession: () => Session | null;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: new Map(),
  activeSessionId: null,

  addSession: async (config: ConnectionConfig): Promise<string> => {
    // Generate a temporary ID
    const tempId = `temp-${Date.now()}`;
    
    // Create initial session
    const session: Session = {
      id: tempId,
      config,
      status: 'connecting',
      createdAt: new Date(),
    };

    // Add to store
    set((state) => {
      const newSessions = new Map(state.sessions);
      newSessions.set(tempId, session);
      return { sessions: newSessions, activeSessionId: tempId };
    });

    try {
      // Call Tauri command to establish connection
      const response: ConnectResponse = await invoke('ssh_connect', {
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password || '',
        cols: 80,
        rows: 24,
      });

      // Update session with real ID and WebSocket URL
      set((state) => {
        const newSessions = new Map(state.sessions);
        const existingSession = newSessions.get(tempId);
        
        if (existingSession) {
          newSessions.delete(tempId);
          newSessions.set(response.session_id, {
            ...existingSession,
            id: response.session_id,
            status: 'connected',
            wsUrl: response.ws_url,
          });
        }
        
        return { 
          sessions: newSessions, 
          activeSessionId: response.session_id 
        };
      });

      return response.session_id;
    } catch (error) {
      // Update session with error status
      set((state) => {
        const newSessions = new Map(state.sessions);
        const existingSession = newSessions.get(tempId);
        
        if (existingSession) {
          newSessions.set(tempId, {
            ...existingSession,
            status: 'error',
            error: String(error),
          });
        }
        
        return { sessions: newSessions };
      });

      throw error;
    }
  },

  removeSession: (sessionId: string) => {
    set((state) => {
      const newSessions = new Map(state.sessions);
      newSessions.delete(sessionId);
      
      // If removing active session, set new active
      let newActiveId = state.activeSessionId;
      if (state.activeSessionId === sessionId) {
        const remaining = Array.from(newSessions.keys());
        newActiveId = remaining.length > 0 ? remaining[0] : null;
      }
      
      return { sessions: newSessions, activeSessionId: newActiveId };
    });

    // Call Tauri to disconnect
    invoke('disconnect_session', { sessionId }).catch(console.error);
  },

  setActiveSession: (sessionId: string | null) => {
    set({ activeSessionId: sessionId });
  },

  updateSessionStatus: (sessionId: string, status: ConnectionStatus, error?: string) => {
    set((state) => {
      const newSessions = new Map(state.sessions);
      const session = newSessions.get(sessionId);
      
      if (session) {
        newSessions.set(sessionId, { ...session, status, error });
      }
      
      return { sessions: newSessions };
    });
  },

  updateSessionWsUrl: (sessionId: string, wsUrl: string) => {
    set((state) => {
      const newSessions = new Map(state.sessions);
      const session = newSessions.get(sessionId);
      
      if (session) {
        newSessions.set(sessionId, { ...session, wsUrl });
      }
      
      return { sessions: newSessions };
    });
  },

  getActiveSession: () => {
    const state = get();
    if (!state.activeSessionId) return null;
    return state.sessions.get(state.activeSessionId) || null;
  },
}));
