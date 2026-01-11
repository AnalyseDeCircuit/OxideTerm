/**
 * Sidebar Component (Redesigned)
 * 
 * Features:
 * - Glassmorphism (毛玻璃效果)
 * - Resizable width
 * - Collapsible (⌘+B)
 * - SSH host list with status indicators
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSessionStore } from '../store';
import type { SessionInfo } from '../types';
import { ConnectionList } from './ConnectionList';
import { ConnectionFormModal } from './ConnectionFormModal';
import type { ConnectionInfo, SshHostInfo } from '../lib/config';

interface SidebarProps {
  onNewConnection: () => void;
  onConnectSaved?: (connection: ConnectionInfo) => void;
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onOpenSettings?: () => void;
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 260;
const COLLAPSED_WIDTH = 0;

export function Sidebar({ 
  onNewConnection, 
  onConnectSaved,
  isCollapsed = false,
  onCollapsedChange,
  onOpenSettings
}: SidebarProps) {
  // Sidebar state
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  // Modal state
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionInfo | undefined>();
  const [importingHosts, setImportingHosts] = useState<SshHostInfo[] | undefined>();
  const [activeTab, setActiveTab] = useState<'saved' | 'active'>('saved');

  // Session store
  const sessions = useSessionStore((state) => state.sessions);
  const tabs = useSessionStore((state) => state.tabs);
  const activeTabId = useSessionStore((state) => state.activeTabId);
  const setActiveTabStore = useSessionStore((state) => state.setActiveTab);
  const disconnect = useSessionStore((state) => state.disconnect);

  const sessionList = Array.from(sessions.values());
  const activeSessionId = tabs.find(t => t.id === activeTabId)?.sessionId ?? null;

  // Handle resize
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Keyboard shortcut for collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        onCollapsedChange?.(!isCollapsed);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCollapsed, onCollapsedChange]);

  const handleSelectSession = (sessionId: string) => {
    const tab = tabs.find(t => t.sessionId === sessionId);
    if (tab) {
      setActiveTabStore(tab.id);
    }
  };

  const handleCloseSession = (sessionId: string) => {
    disconnect(sessionId);
  };

  // Calculate actual width
  const actualWidth = isCollapsed ? COLLAPSED_WIDTH : width;

  return (
    <>
      {/* Sidebar Container */}
      <div
        ref={sidebarRef}
        className={`
          relative flex flex-col h-full shrink-0
          transition-all duration-300 ease-out
          ${isCollapsed ? 'overflow-hidden' : ''}
        `}
        style={{ 
          width: actualWidth,
          background: 'var(--sidebar-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: isCollapsed ? 'none' : '1px solid rgba(255, 255, 255, 0.03)'
        }}
      >
        {!isCollapsed && (
          <>
            {/* Header with Logo */}
            <div className="pt-5 pb-4 px-4 border-b border-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue/20 to-mauve/20 border border-white/[0.06] flex items-center justify-center">
                  <span className="text-lg">⚡</span>
                </div>
                <span className="font-semibold text-text tracking-tight">OxideTerm</span>
              </div>
            </div>

            {/* New Connection Button */}
            <div className="px-4 pt-4 pb-5">
              <button
                onClick={onNewConnection}
                className="w-full btn-primary py-2.5 rounded-xl"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Connection
              </button>
            </div>

            {/* Tab Switcher */}
            <div className="flex mx-4 mb-4 p-1 bg-black/20 rounded-xl">
              <button
                onClick={() => setActiveTab('saved')}
                className={`
                  flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200
                  ${activeTab === 'saved'
                    ? 'bg-surface-1/80 text-text shadow-sm'
                    : 'text-overlay-1 hover:text-text hover:bg-white/[0.03]'
                  }
                `}
              >
                Saved
              </button>
              <button
                onClick={() => setActiveTab('active')}
                className={`
                  flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200
                  ${activeTab === 'active'
                    ? 'bg-surface-1/80 text-text shadow-sm'
                    : 'text-overlay-1 hover:text-text hover:bg-white/[0.03]'
                  }
                `}
              >
                Active
                {sessionList.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-blue/20 text-blue rounded-full">
                    {sessionList.length}
                  </span>
                )}
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-1">
              {activeTab === 'saved' ? (
                <ConnectionList
                  onConnect={(conn) => onConnectSaved?.(conn)}
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
                <ActiveSessionsList
                  sessions={sessionList}
                  activeSessionId={activeSessionId}
                  onSelect={handleSelectSession}
                  onClose={handleCloseSession}
                />
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-4 border-t border-white/[0.02]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-overlay-0/60 font-mono">v0.1.0</span>
                <div className="flex items-center gap-0.5">
                  {/* Settings Button */}
                  {onOpenSettings && (
                    <button
                      onClick={onOpenSettings}
                      className="p-1.5 text-overlay-0/60 hover:text-text hover:bg-white/[0.04] rounded-lg transition-all duration-200"
                      title="Settings"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  )}
                  {/* Collapse Button */}
                  <button
                    onClick={() => onCollapsedChange?.(!isCollapsed)}
                    className="p-1.5 text-overlay-0/60 hover:text-text hover:bg-white/[0.04] rounded-lg transition-all duration-200"
                    title="Toggle Sidebar (⌘B)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Resize Handle */}
            <div
              className="resize-handle"
              onMouseDown={startResizing}
            />
          </>
        )}
      </div>

      {/* Collapsed Toggle Button */}
      {isCollapsed && (
        <button
          onClick={() => onCollapsedChange?.(false)}
          className="fixed left-2 top-1/2 -translate-y-1/2 z-20 p-2 bg-surface-0/80 hover:bg-surface-1 text-overlay-1 hover:text-text rounded-lg backdrop-blur-sm transition-all"
          title="Show Sidebar (⌘B)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Connection Form Modal */}
      <ConnectionFormModal
        isOpen={showConnectionForm}
        onClose={() => {
          setShowConnectionForm(false);
          setEditingConnection(undefined);
          setImportingHosts(undefined);
        }}
        onSaved={(conn) => {
          console.log('Connection saved:', conn.name);
        }}
        editConnection={editingConnection}
        importHosts={importingHosts}
      />
    </>
  );
}

// ============================================
// Active Sessions List Component
// ============================================

interface ActiveSessionsListProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onClose: (sessionId: string) => void;
}

function ActiveSessionsList({ sessions, activeSessionId, onSelect, onClose }: ActiveSessionsListProps) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-surface-0/50 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-overlay-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-sm text-overlay-1">No active sessions</p>
        <p className="text-xs text-overlay-0 mt-1">Create a new connection to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 py-1">
      {sessions.map((session) => (
        <SessionItem
          key={session.id}
          session={session}
          isActive={session.id === activeSessionId}
          onSelect={() => onSelect(session.id)}
          onClose={() => onClose(session.id)}
        />
      ))}
    </div>
  );
}

// ============================================
// Session Item Component
// ============================================

interface SessionItemProps {
  session: SessionInfo;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

function SessionItem({ session, isActive, onSelect, onClose }: SessionItemProps) {
  const getStatusIndicator = () => {
    switch (session.state) {
      case 'connected':
        return { color: 'bg-green', glow: true };
      case 'connecting':
        return { color: 'bg-yellow animate-pulse', glow: false };
      case 'disconnecting':
        return { color: 'bg-peach animate-pulse', glow: false };
      case 'error':
        return { color: 'bg-red', glow: false };
      default:
        return { color: 'bg-overlay-0', glow: false };
    }
  };

  const status = getStatusIndicator();

  return (
    <div
      className={`
        group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer
        transition-all duration-150
        ${isActive 
          ? 'bg-blue/10 border border-blue/20' 
          : 'hover:bg-surface-0/50 border border-transparent'
        }
      `}
      onClick={onSelect}
    >
      {/* Status Indicator */}
      <div className="relative">
        <div 
          className={`w-2 h-2 rounded-full ${status.color}`}
          style={{ 
            boxShadow: status.glow ? '0 0 8px var(--color-green)' : undefined 
          }}
        />
      </div>
      
      {/* Session Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text truncate">
          {session.name || `${session.config.username}@${session.config.host}`}
        </div>
        <div className="text-xs text-overlay-0 truncate font-mono">
          :{session.config.port}
        </div>
      </div>

      {/* Close Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red/20 rounded transition-all"
        title="Disconnect"
      >
        <svg className="w-3.5 h-3.5 text-overlay-1 hover:text-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default Sidebar;
