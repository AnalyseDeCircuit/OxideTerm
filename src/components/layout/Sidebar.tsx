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
  X
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { EditConnectionModal } from '../modals/EditConnectionModal';
import { api } from '../../lib/api';

export const Sidebar = () => {
  const { 
    sidebarCollapsed, 
    sidebarActiveSection, 
    setSidebarSection,
    sessions,
    toggleModal,
    createTab,
    savedConnections,
    groups,
    selectedGroup,
    loadSavedConnections,
    loadGroups,
    setSelectedGroup,
    connectToSaved,
    modals,
    editingConnection,
    disconnect
  } = useAppStore();

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['ungrouped']));
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedConnections, setSelectedConnections] = useState<Set<string>>(new Set());

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
      
    } catch (error: any) {
      console.error('Failed to delete connections:', error);
      alert(`Failed to delete some connections: ${error?.message || error}`);
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
          <Terminal className="h-4 w-4" />
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
              {sessionList.length === 0 ? (
                <div className="text-sm text-theme-text-muted px-2 py-4 text-center">
                  No active sessions
                </div>
              ) : (
                sessionList.map(session => (
                  <div 
                    key={session.id}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-theme-text hover:bg-theme-bg-hover rounded-sm group"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${session.state === 'connected' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <span 
                      className="truncate flex-1 cursor-pointer"
                      onClick={() => createTab('terminal', session.id)}
                    >
                      {session.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Disconnect from "${session.name}"?`)) {
                          disconnect(session.id);
                        }
                      }}
                      title="Disconnect"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            {/* Saved Connections Section */}
            <div className="space-y-2 mt-6">
              <div className="flex items-center justify-between px-2">
                <span className="text-xs font-semibold text-theme-text-muted uppercase tracking-wider">
                  Saved Connections
                </span>
                <div className="flex items-center gap-1">
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
                        className={cn("h-6 w-6", isManageMode && "text-theme-accent")}
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
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-theme-text hover:bg-theme-bg-hover rounded-sm cursor-pointer group"
                  >
                    <Folder className="h-3 w-3 text-theme-text-muted" />
                    <span className="truncate flex-1">{session.name}</span>
                    <ChevronRight className="h-3 w-3 text-theme-text-muted opacity-0 group-hover:opacity-100" />
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
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-theme-text hover:bg-theme-bg-hover rounded-sm cursor-pointer group"
                  >
                    <ArrowLeftRight className="h-3 w-3 text-theme-text-muted" />
                    <span className="truncate flex-1">{session.name}</span>
                    <ChevronRight className="h-3 w-3 text-theme-text-muted opacity-0 group-hover:opacity-100" />
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
    </div>
  );
};
