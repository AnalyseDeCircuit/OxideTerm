import { useState } from 'react';
import { useSessionStore } from '../store';
import { useSessionStoreV2 } from '../store/sessionStoreV2';
import { Session } from '../types';
import type { SessionInfo } from '../types';
import { ConnectionList } from './ConnectionList';
import { ConnectionFormModal } from './ConnectionFormModal';
import type { ConnectionInfo, SshHostInfo } from '../lib/config';

// Feature flag - should match App.tsx
const USE_V2_UI = true;

interface SidebarProps {
  onNewConnection: () => void;
  onConnectSaved?: (connection: ConnectionInfo) => void;
}

export function Sidebar({ onNewConnection, onConnectSaved }: SidebarProps) {
  // Modal state
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionInfo | undefined>();
  const [importingHosts, setImportingHosts] = useState<SshHostInfo[] | undefined>();
  const [showSavedConnections, setShowSavedConnections] = useState(true);

  // v1 store
  const sessionsV1 = useSessionStore((state) => state.sessions);
  const activeSessionIdV1 = useSessionStore((state) => state.activeSessionId);
  const setActiveSessionV1 = useSessionStore((state) => state.setActiveSession);
  const removeSessionV1 = useSessionStore((state) => state.removeSession);

  // v2 store
  const sessionsV2 = useSessionStoreV2((state) => state.sessions);
  const tabs = useSessionStoreV2((state) => state.tabs);
  const activeTabId = useSessionStoreV2((state) => state.activeTabId);
  const setActiveTab = useSessionStoreV2((state) => state.setActiveTab);
  const disconnect = useSessionStoreV2((state) => state.disconnect);

  // Choose which store to use
  const sessionList = USE_V2_UI 
    ? Array.from(sessionsV2.values())
    : Array.from(sessionsV1.values());
  
  const activeSessionId = USE_V2_UI
    ? (tabs.find(t => t.id === activeTabId)?.sessionId ?? null)
    : activeSessionIdV1;

  const handleSelect = (sessionId: string) => {
    if (USE_V2_UI) {
      // Find the tab for this session
      const tab = tabs.find(t => t.sessionId === sessionId);
      if (tab) {
        setActiveTab(tab.id);
      }
    } else {
      setActiveSessionV1(sessionId);
    }
  };

  const handleClose = (sessionId: string) => {
    if (USE_V2_UI) {
      disconnect(sessionId);
    } else {
      removeSessionV1(sessionId);
    }
  };

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          OxideTerm
        </h1>
      </div>

      {/* New Connection Button */}
      <div className="p-3">
        <button
          onClick={onNewConnection}
          className="w-full btn btn-primary flex items-center justify-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Connection
        </button>
      </div>

      {/* Section Toggle */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setShowSavedConnections(true)}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors
            ${showSavedConnections
              ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800/50'
              : 'text-gray-500 hover:text-gray-300'
            }`}
        >
          💾 Saved
        </button>
        <button
          onClick={() => setShowSavedConnections(false)}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors
            ${!showSavedConnections
              ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800/50'
              : 'text-gray-500 hover:text-gray-300'
            }`}
        >
          🔌 Active ({sessionList.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {showSavedConnections ? (
          /* Saved Connections List */
          <ConnectionList
            onConnect={(conn) => {
              if (onConnectSaved) {
                onConnectSaved(conn);
              }
            }}
            onEdit={(conn) => {
              setEditingConnection(conn);
              setImportingHosts(undefined);
              setShowConnectionForm(true);
            }}
            onNewConnection={() => {
              setEditingConnection(undefined);
              setImportingHosts(undefined);
              setShowConnectionForm(true);
            }}
            onImportFromSsh={(hosts) => {
              setEditingConnection(undefined);
              setImportingHosts(hosts);
              setShowConnectionForm(true);
            }}
          />
        ) : (
          /* Active Sessions List */
          <>
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Active Sessions ({sessionList.length})
            </div>
            
            {sessionList.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                No active sessions.<br />
                Click "New Connection" to start.
              </div>
            ) : (
              <div className="space-y-1 px-2">
                {USE_V2_UI ? (
                  // V2 sessions
                  (sessionList as SessionInfo[]).map((session) => (
                    <SessionItemV2
                      key={session.id}
                      session={session}
                      isActive={session.id === activeSessionId}
                      onSelect={() => handleSelect(session.id)}
                      onClose={() => handleClose(session.id)}
                    />
                  ))
                ) : (
                  // V1 sessions
                  (sessionList as Session[]).map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      isActive={session.id === activeSessionId}
                      onSelect={() => handleSelect(session.id)}
                      onClose={() => handleClose(session.id)}
                    />
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-800 text-xs text-gray-500">
        v0.1.0 • Built with Rust & Tauri
      </div>

      {/* Connection Form Modal */}
      <ConnectionFormModal
        isOpen={showConnectionForm}
        onClose={() => {
          setShowConnectionForm(false);
          setEditingConnection(undefined);
          setImportingHosts(undefined);
        }}
        onSaved={(conn) => {
          // Optionally connect after save
          console.log('Connection saved:', conn.name);
        }}
        editConnection={editingConnection}
        importHosts={importingHosts}
      />
    </div>
  );
}

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

function SessionItem({ session, isActive, onSelect, onClose }: SessionItemProps) {
  const statusColors = {
    disconnected: 'bg-gray-500',
    connecting: 'bg-yellow-500 animate-pulse',
    connected: 'bg-green-500',
    error: 'bg-red-500',
  };

  return (
    <div
      className={`
        group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer
        transition-colors duration-150
        ${isActive 
          ? 'bg-blue-600/20 border border-blue-500/30' 
          : 'hover:bg-gray-800 border border-transparent'
        }
      `}
      onClick={onSelect}
    >
      {/* Status indicator */}
      <div className={`w-2 h-2 rounded-full ${statusColors[session.status]}`} />
      
      {/* Session info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">
          {session.config.username}@{session.config.host}
        </div>
        <div className="text-xs text-gray-500 truncate">
          Port {session.config.port}
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-opacity"
        title="Close session"
      >
        <svg
          className="w-4 h-4 text-gray-400 hover:text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

// V2 session item with new SessionInfo type
interface SessionItemV2Props {
  session: SessionInfo;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

function SessionItemV2({ session, isActive, onSelect, onClose }: SessionItemV2Props) {
  const statusColors: Record<string, string> = {
    disconnected: 'bg-gray-500',
    connecting: 'bg-yellow-500 animate-pulse',
    connected: 'bg-green-500',
    disconnecting: 'bg-orange-500 animate-pulse',
    error: 'bg-red-500',
  };

  return (
    <div
      className={`
        group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer
        transition-colors duration-150
        ${isActive 
          ? 'bg-blue-600/20 border border-blue-500/30' 
          : 'hover:bg-gray-800 border border-transparent'
        }
      `}
      onClick={onSelect}
    >
      {/* Color indicator */}
      <div 
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: session.color || statusColors[session.state] || statusColors.disconnected }}
      />
      
      {/* Session info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">
          {session.name || `${session.config.username}@${session.config.host}`}
        </div>
        <div className="text-xs text-gray-500 truncate">
          {session.state} • Port {session.config.port}
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-opacity"
        title="Close session"
      >
        <svg
          className="w-4 h-4 text-gray-400 hover:text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
