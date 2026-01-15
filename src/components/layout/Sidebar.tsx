import React, { useEffect, useState } from 'react';
import { 
  Terminal, 
  Folder, 
  ArrowLeftRight, 
  Settings, 
  Plus,
  ChevronRight,
  ChevronDown,
  Server,
  Trash2,
  ListChecks,
  Check,
  X,
  Download,
  Upload,
  Link2
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { EditConnectionModal } from '../modals/EditConnectionModal';
import { OxideExportModal } from '../modals/OxideExportModal';
import { OxideImportModal } from '../modals/OxideImportModal';
import { ConnectionsPanel } from '../connections/ConnectionsPanel';
import { api } from '../../lib/api';

export const Sidebar = () => {
  const { 
    sidebarCollapsed, 
    sidebarActiveSection, 
    setSidebarSection,
    sessions,
    connections,
    toggleModal,
    createTab,
    tabs,
    setActiveTab,
    savedConnections,
    groups,
    selectedGroup,
    loadSavedConnections,
    loadGroups,
    setSelectedGroup,
    connectToSaved,
    modals,
    editingConnection,
    disconnect,
    disconnectSsh,
    createTerminalSession
  } = useAppStore();

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['ungrouped']));
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set());
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedConnections, setSelectedConnections] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Load saved connections and groups on mount
  useEffect(() => {
    loadSavedConnections();
    loadGroups();
  }, []);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  const toggleConnection = (connectionId: string) => {
    setExpandedConnections(prev => {
      const next = new Set(prev);
      if (next.has(connectionId)) {
        next.delete(connectionId);
      } else {
        next.add(connectionId);
      }
      return next;
    });
  };

  const toggleConnectionSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedConnections(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBatchDelete = async () => {
    if (selectedConnections.size === 0) return;
    
    const count = selectedConnections.size;
    const confirmed = window.confirm(`Are you sure you want to delete ${count} connection(s)?`);
    
    if (!confirmed) {
      return; // User cancelled, do nothing
    }
    
    try {
      // Delete all selected connections
      await Promise.all(
        Array.from(selectedConnections).map(async (id) => {
          try {
            await api.deleteConnection(id);
            console.log(`Successfully deleted connection: ${id}`);
          } catch (err) {
            console.error(`Failed to delete connection ${id}:`, err);
            throw err;
          }
        })
      );
      
      // Success: Clear selection and refresh list
      setSelectedConnections(new Set());
      await loadSavedConnections();
      console.log(`Successfully deleted ${count} connection(s)`);
      
    } catch (error: unknown) {
      console.error('Failed to delete connections:', error);
      const message = error instanceof Error ? error.message : String(error);
      alert(`Failed to delete some connections: ${message}`);
      // Refresh list anyway to show which ones were deleted
      await loadSavedConnections();
    }
  };

  const toggleManageMode = () => {
    setIsManageMode(prev => !prev);
    setSelectedConnections(new Set());
  };

  if (sidebarCollapsed) {
    return null;
  }

  const sessionList = Array.from(sessions.values());

  return (
    <div className="flex h-full border-r border-theme-border bg-theme-bg-panel w-64 flex-col">
      {/* Activity Bar (Top of sidebar) */}
      <div className="flex items-center p-2 gap-1 border-b border-theme-border">
        <Button 
          variant={sidebarActiveSection === 'sessions' ? 'secondary' : 'ghost'} 
          size="icon"
          onClick={() => setSidebarSection('sessions')}
          title="Sessions"
          className="rounded-sm"
        >
          <Link2 className="h-4 w-4" />
        </Button>
        <Button 
          variant={sidebarActiveSection === 'sftp' ? 'secondary' : 'ghost'} 
          size="icon"
          onClick={() => setSidebarSection('sftp')}
          title="SFTP"
          className="rounded-sm"
        >
          <Folder className="h-4 w-4" />
        </Button>
        <Button 
          variant={sidebarActiveSection === 'forwards' ? 'secondary' : 'ghost'} 
          size="icon"
          onClick={() => setSidebarSection('forwards')}
          title="Port Forwarding"
          className="rounded-sm"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </Button>
        <Button 
          variant={sidebarActiveSection === 'connections' ? 'secondary' : 'ghost'} 
          size="icon"
          onClick={() => setSidebarSection('connections')}
          title="SSH 连接池"
          className="rounded-sm relative"
        >
          <Terminal className="h-4 w-4" />
          {/* 连接数角标 */}
          {connections.size > 0 && (
            <span className="absolute -top-1 -right-1 bg-green-500 text-[10px] text-white rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
              {connections.size}
            </span>
          )}
        </Button>
        <div className="flex-1" />
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-sm"
          onClick={() => toggleModal('settings', true)}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-2">
        {sidebarActiveSection === 'sessions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-semibold text-theme-text-muted uppercase tracking-wider">Active Sessions</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={() => toggleModal('newConnection', true)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            
            <div className="space-y-1">
              {connections.size === 0 ? (
                <div className="text-sm text-theme-text-muted px-2 py-4 text-center">
                  No active sessions
                </div>
              ) : (
                Array.from(connections.values()).map(connection => {
                  const isExpanded = expandedConnections.has(connection.id);
                  // 获取该连接下的所有终端 session
                  const terminalSessions = connection.terminalIds
                    .map(tid => sessions.get(tid))
                    .filter(Boolean);
                  const displayName = `${connection.username}@${connection.host}`;
                  
                  // 状态指示灯样式
                  const getStatusLight = () => {
                    const state = connection.state;
                    if (state === 'active') return 'bg-green-500';
                    if (state === 'idle') return 'bg-blue-500';
                    if (state === 'link_down') return 'bg-red-500 animate-pulse';
                    if (state === 'reconnecting') return 'bg-yellow-500 animate-pulse';
                    if (state === 'connecting') return 'bg-yellow-500';
                    if (state === 'disconnecting' || state === 'disconnected') return 'bg-zinc-500';
                    if (typeof state === 'object' && state.error) return 'bg-red-500';
                    return 'bg-zinc-500';
                  };
                  
                  return (
                    <div key={connection.id} className="space-y-0.5">
                      {/* 连接主行 */}
                      <div 
                        className="flex items-center gap-1 px-2 py-1.5 text-sm text-theme-text hover:bg-theme-bg-hover rounded-sm group cursor-pointer"
                        onClick={() => toggleConnection(connection.id)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3 text-theme-text-muted" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-theme-text-muted" />
                        )}
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          getStatusLight()
                        )} />
                        <Server className="h-3.5 w-3.5 text-theme-text-muted" />
                        <span className="truncate flex-1">{displayName}</span>
                        <span className="text-[10px] text-theme-text-muted">
                          {terminalSessions.length > 0 && `${terminalSessions.length}`}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Disconnect from "${displayName}"? This will close all terminals.`)) {
                              disconnectSsh(connection.id);
                            }
                          }}
                          title="Disconnect"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      {/* 展开的子列表 */}
                      {isExpanded && (
                        <div className="ml-4 pl-2 border-l border-theme-border space-y-0.5">
                          {/* 终端列表 */}
                          {terminalSessions.map((session, index) => {
                            if (!session) return null;
                            const existingTab = tabs.find(t => t.sessionId === session.id && t.type === 'terminal');
                            return (
                              <div
                                key={session.id}
                                className="flex items-center gap-2 px-2 py-1 text-xs text-theme-text hover:bg-theme-bg-hover rounded-sm group cursor-pointer"
                                onClick={() => {
                                  if (existingTab) {
                                    setActiveTab(existingTab.id);
                                  } else {
                                    createTab('terminal', session.id);
                                  }
                                }}
                              >
                                <Terminal className="h-3 w-3 text-theme-text-muted" />
                                <span className="flex-1 truncate">Terminal {index + 1}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    disconnect(session.id);
                                  }}
                                  title="Close terminal"
                                >
                                  <X className="h-2.5 w-2.5" />
                                </Button>
                              </div>
                            );
                          })}
                          
                          {/* 新建终端按钮 */}
                          <div
                            className="flex items-center gap-2 px-2 py-1 text-xs text-theme-text-muted hover:text-theme-text hover:bg-theme-bg-hover rounded-sm cursor-pointer"
                            onClick={() => createTerminalSession(connection.id)}
                          >
                            <Plus className="h-3 w-3" />
                            <span>New Terminal</span>
                          </div>
                          
                          {/* SFTP 入口 */}
                          <div
                            className="flex items-center gap-2 px-2 py-1 text-xs text-theme-text-muted hover:text-theme-text hover:bg-theme-bg-hover rounded-sm cursor-pointer"
                            onClick={() => {
                              // 如果有终端 session，用第一个打开 SFTP
                              const firstSession = terminalSessions[0];
                              if (firstSession) {
                                createTab('sftp', firstSession.id);
                              }
                            }}
                          >
                            <Folder className="h-3 w-3" />
                            <span>SFTP</span>
                            {connection.sftpSessionId && (
                              <span className="text-[10px] text-green-500">●</span>
                            )}
                          </div>
                          
                          {/* 端口转发入口 */}
                          <div
                            className="flex items-center gap-2 px-2 py-1 text-xs text-theme-text-muted hover:text-theme-text hover:bg-theme-bg-hover rounded-sm cursor-pointer"
                            onClick={() => {
                              const firstSession = terminalSessions[0];
                              if (firstSession) {
                                createTab('forwards', firstSession.id);
                              }
                            }}
                          >
                            <ArrowLeftRight className="h-3 w-3" />
                            <span>Port Forwarding</span>
                            {connection.forwardIds.length > 0 && (
                              <span className="text-[10px] text-theme-text-muted">
                                ({connection.forwardIds.length})
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Saved Connections Section */}
            <div className="space-y-2 mt-6">
              <div className="flex items-center justify-between px-2">
                <span className="text-xs font-semibold text-theme-text-muted uppercase tracking-wider">
                  Saved Connections
                </span>
                <div className="flex items-center gap-1">
                    <Button 
                        variant="ghost"
                        size="icon" 
                        className="h-6 w-6 text-theme-text-muted hover:text-theme-text hover:bg-theme-bg-hover"
                        onClick={() => setShowImportModal(true)}
                        title="Import from .oxide file"
                    >
                        <Download className="h-3 w-3" />
                    </Button>
                    <Button 
                        variant="ghost"
                        size="icon" 
                        className="h-6 w-6 text-theme-text-muted hover:text-theme-text hover:bg-theme-bg-hover"
                        onClick={() => setShowExportModal(true)}
                        title="Export to .oxide file"
                    >
                        <Upload className="h-3 w-3" />
                    </Button>
                    {isManageMode && selectedConnections.size > 0 && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-red-500 hover:text-red-400 hover:bg-theme-bg-hover"
                            onClick={handleBatchDelete}
                            title="Delete Selected"
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    )}
                    <Button 
                        variant={isManageMode ? "secondary" : "ghost"}
                        size="icon" 
                        className={cn("h-6 w-6 text-theme-text-muted hover:text-theme-text hover:bg-theme-bg-hover", isManageMode && "text-theme-accent bg-theme-bg-hover")}
                        onClick={toggleManageMode}
                        title={isManageMode ? "Done" : "Manage Connections"}
                    >
                        {isManageMode ? <Check className="h-3 w-3" /> : <ListChecks className="h-3 w-3" />}
                    </Button>
                </div>
              </div>

              {/* Group Filter */}
              {groups.length > 0 && (
                <div className="px-2">
                  <Select
                    value={selectedGroup || 'all'}
                    onValueChange={(value) => setSelectedGroup(value === 'all' ? null : value)}
                  >
                    <SelectTrigger className="w-full h-7 text-xs bg-theme-bg-panel border-theme-border text-theme-text hover:bg-theme-bg-hover focus:ring-1 focus:ring-theme-accent">
                      <SelectValue placeholder="All Groups" />
                    </SelectTrigger>
                    <SelectContent className="bg-theme-bg-panel border-theme-border text-theme-text">
                        <SelectItem value="all" className="text-xs">All Groups</SelectItem>
                        {groups.map(group => (
                            <SelectItem key={group} value={group} className="text-xs">{group}</SelectItem>
                        ))}
                        <SelectItem value="ungrouped" className="text-xs">Ungrouped</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Connections List */}
              <div className="space-y-1">
                {(() => {
                  const filteredConnections = selectedGroup !== null
                    ? savedConnections.filter(c => c.group === selectedGroup)
                    : savedConnections;

                  // Group connections
                  const grouped = filteredConnections.reduce((acc, conn) => {
                    const groupName = conn.group || 'ungrouped';
                    if (!acc[groupName]) acc[groupName] = [];
                    acc[groupName].push(conn);
                    return acc;
                  }, {} as Record<string, typeof savedConnections>);

                  if (Object.keys(grouped).length === 0) {
                    return (
                      <div className="text-sm text-theme-text-muted px-2 py-4 text-center">
                        No saved connections
                      </div>
                    );
                  }

                  return Object.entries(grouped).map(([groupName, conns]) => (
                    <div key={groupName} className="space-y-1">
                      {/* Group Header */}
                      {Object.keys(grouped).length > 1 && (
                        <div
                          onClick={() => toggleGroup(groupName)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-theme-text-muted hover:bg-theme-bg-hover rounded-sm cursor-pointer select-none"
                        >
                          {expandedGroups.has(groupName) ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          <span className="font-medium">{groupName}</span>
                          <span className="text-theme-text-muted">({conns.length})</span>
                        </div>
                      )}

                      {/* Group Connections */}
                      {(Object.keys(grouped).length === 1 || expandedGroups.has(groupName)) && conns.map(conn => (
                        <div
                          key={conn.id}
                          onClick={isManageMode ? (e) => toggleConnectionSelection(conn.id, e) : () => connectToSaved(conn.id)}
                          className={cn(
                              "flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer group ml-4 transition-colors",
                              selectedConnections.has(conn.id) 
                                ? "bg-theme-accent/20 text-theme-accent hover:bg-theme-accent/30" 
                                : "text-theme-text hover:bg-theme-bg-hover"
                          )}
                        >
                          {isManageMode ? (
                              <div className="flex items-center justify-center w-3 h-3">
                                  <Checkbox 
                                    checked={selectedConnections.has(conn.id)}
                                    onCheckedChange={() => {}} // Handled by parent click
                                    className="h-3 w-3 border-theme-border data-[state=checked]:bg-theme-accent data-[state=checked]:border-theme-accent"
                                  />
                              </div>
                          ) : (
                            <Server className="h-3 w-3 text-theme-text-muted" />
                          )}
                          
                          <div className="flex-1 truncate">
                            <div className="truncate font-medium">{conn.name}</div>
                            <div className="text-xs text-theme-text-muted truncate">
                              {conn.username}@{conn.host}:{conn.port}
                            </div>
                          </div>
                          {!isManageMode && (
                            <ChevronRight className="h-3 w-3 text-theme-text-muted opacity-0 group-hover:opacity-100" />
                          )}
                        </div>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}
        
        {sidebarActiveSection === 'sftp' && (
          <div className="space-y-4">
            <div className="px-2">
              <span className="text-xs font-semibold text-theme-text-muted uppercase tracking-wider">SFTP Sessions</span>
            </div>
            <div className="space-y-1">
              {sessionList.length === 0 ? (
                <div className="text-sm text-theme-text-muted px-2 py-4 text-center">
                  No active sessions
                </div>
              ) : (
                sessionList.filter(s => s.state === 'connected').map(session => (
                  <div 
                    key={session.id}
                    onClick={() => createTab('sftp', session.id)}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-theme-text rounded-sm cursor-pointer"
                  >
                    <Folder className="h-3 w-3 text-theme-text-muted" />
                    <span className="truncate flex-1">{session.name}</span>
                  </div>
                ))
              )}
              {sessionList.length > 0 && sessionList.filter(s => s.state === 'connected').length === 0 && (
                <div className="text-sm text-theme-text-muted px-2 py-4 text-center">
                  No connected sessions
                </div>
              )}
            </div>
          </div>
        )}

        {sidebarActiveSection === 'forwards' && (
          <div className="space-y-4">
            <div className="px-2">
              <span className="text-xs font-semibold text-theme-text-muted uppercase tracking-wider">Port Forwarding</span>
            </div>
            <div className="space-y-1">
              {sessionList.length === 0 ? (
                <div className="text-sm text-theme-text-muted px-2 py-4 text-center">
                  No active sessions
                </div>
              ) : (
                sessionList.filter(s => s.state === 'connected').map(session => (
                  <div 
                    key={session.id}
                    onClick={() => createTab('forwards', session.id)}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-theme-text rounded-sm cursor-pointer"
                  >
                    <ArrowLeftRight className="h-3 w-3 text-theme-text-muted" />
                    <span className="truncate flex-1">{session.name}</span>
                  </div>
                ))
              )}
              {sessionList.length > 0 && sessionList.filter(s => s.state === 'connected').length === 0 && (
                <div className="text-sm text-theme-text-muted px-2 py-4 text-center">
                  No connected sessions
                </div>
              )}
            </div>
          </div>
        )}

        {/* SSH 连接池面板 */}
        {sidebarActiveSection === 'connections' && (
          <ConnectionsPanel />
        )}
      </div>

      {/* Edit Connection Modal */}
      <EditConnectionModal
        open={modals.editConnection}
        onOpenChange={(open) => toggleModal('editConnection', open)}
        connection={editingConnection}
        onConnect={() => {
          loadSavedConnections();
        }}
      />
      
      <OxideExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
      
      <OxideImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
    </div>
  );
};
