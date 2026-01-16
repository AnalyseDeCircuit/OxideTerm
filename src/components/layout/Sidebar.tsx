import React, { useEffect, useState, useCallback } from 'react';
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
  Download,
  Upload,
  Link2,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useSessionTreeStore } from '../../store/sessionTreeStore';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { EditConnectionModal } from '../modals/EditConnectionModal';
import { OxideExportModal } from '../modals/OxideExportModal';
import { OxideImportModal } from '../modals/OxideImportModal';
import { ConnectionsPanel } from '../connections/ConnectionsPanel';
import { SessionTree } from '../sessions/SessionTree';
import { DrillDownDialog } from '../modals/DrillDownDialog';
import { SavePathAsPresetDialog } from '../modals/SavePathAsPresetDialog';
import { AddRootNodeDialog } from '../modals/AddRootNodeDialog';
import { api } from '../../lib/api';
import type { UnifiedFlatNode } from '../../types';

export const Sidebar = () => {
  const { 
    sidebarCollapsed, 
    sidebarActiveSection, 
    setSidebarSection,
    sessions,
    connections,
    toggleModal,
    createTab,
    closeTab,
    tabs,
    activeTabId,
    setActiveTab,
    savedConnections,
    groups,
    selectedGroup,
    loadSavedConnections,
    loadGroups,
    setSelectedGroup,
    modals,
    editingConnection,
    refreshConnections,
    openConnectionEditor,
  } = useAppStore();

  // SessionTree store
  const {
    nodes: treeNodes,
    selectedNodeId,
    fetchTree,
    selectNode,
    toggleExpand,
    removeNode,
    getNode,
    createTerminalForNode,
    closeTerminalForNode,
    connectNode,
    addRootNode,
  } = useSessionTreeStore();

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['ungrouped']));
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedConnections, setSelectedConnections] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // SessionTree 对话框状态
  const [drillDownDialog, setDrillDownDialog] = useState<{ open: boolean; parentId: string; parentHost: string }>({
    open: false,
    parentId: '',
    parentHost: '',
  });
  const [savePresetDialog, setSavePresetDialog] = useState<{ open: boolean; nodeId: string }>({
    open: false,
    nodeId: '',
  });
  const [addRootNodeOpen, setAddRootNodeOpen] = useState(false);

  // Load saved connections and groups on mount
  useEffect(() => {
    loadSavedConnections();
    loadGroups();
  }, []);

  // Load session tree on mount
  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  // ========== SessionTree 回调函数 ==========
  const handleTreeDrillDown = useCallback((parentId: string) => {
    const node = getNode(parentId);
    if (node) {
      setDrillDownDialog({
        open: true,
        parentId,
        parentHost: node.displayName || `${node.username}@${node.host}`,
      });
    }
  }, [getNode]);

  const handleTreeConnect = useCallback(async (nodeId: string) => {
    try {
      // 1. 建立 SSH 连接
      const result = await api.connectTreeNode({ nodeId, cols: 80, rows: 24 });
      
      // 2. 创建终端会话
      const terminalResponse = await api.createTerminal({
        connectionId: result.sshConnectionId,
        cols: 80,
        rows: 24,
      });
      
      // 3. 关联终端会话到节点
      await api.setTreeNodeTerminal(nodeId, terminalResponse.sessionId);
      
      // 4. 刷新树和连接池
      await Promise.all([
        fetchTree(),
        refreshConnections(),
      ]);
      
      // 5. 打开终端 tab
      createTab('terminal', terminalResponse.sessionId);
    } catch (err) {
      console.error('Failed to connect tree node:', err);
      // 刷新树以显示错误状态
      await fetchTree();
    }
  }, [fetchTree, refreshConnections, createTab]);

  const handleTreeDisconnect = useCallback(async (nodeId: string) => {
    try {
      await api.disconnectTreeNode(nodeId);
      await Promise.all([
        fetchTree(),
        refreshConnections(),
      ]);
    } catch (err) {
      console.error('Failed to disconnect tree node:', err);
    }
  }, [fetchTree, refreshConnections]);

  const handleTreeOpenSftp = useCallback(async (nodeId: string) => {
    const node = getNode(nodeId);
    if (!node) return;
    
    // 如果已有 SFTP 会话
    if (node.sftpSessionId) {
      const existingTab = tabs.find(t => t.sessionId === node.sftpSessionId && t.type === 'sftp');
      if (existingTab) {
        setActiveTab(existingTab.id);
      } else {
        createTab('sftp', node.sftpSessionId);
      }
      return;
    }
    
    // 如果已有终端会话，用它打开 SFTP
    if (node.terminalSessionId) {
      createTab('sftp', node.terminalSessionId);
      return;
    }
    
    // 如果节点已连接但没有会话，先创建终端会话再打开 SFTP
    if (node.state.status === 'connected' && node.sshConnectionId) {
      try {
        const terminalResponse = await api.createTerminal({
          connectionId: node.sshConnectionId,
          cols: 80,
          rows: 24,
        });
        
        await api.setTreeNodeTerminal(nodeId, terminalResponse.sessionId);
        await Promise.all([
          fetchTree(),
          refreshConnections(),
        ]);
        
        createTab('sftp', terminalResponse.sessionId);
      } catch (err) {
        console.error('Failed to create session for SFTP:', err);
      }
    }
  }, [getNode, tabs, setActiveTab, createTab, fetchTree, refreshConnections]);

  // 打开端口转发
  const handleTreeOpenForwards = useCallback((nodeId: string) => {
    const node = getNode(nodeId);
    if (!node) return;
    
    // 如果已有终端会话，用它打开转发
    if (node.terminalSessionId) {
      createTab('forwards', node.terminalSessionId);
      return;
    }
    
    // 如果节点有终端，用第一个
    const terminalIds = node.runtime?.terminalIds || [];
    if (terminalIds.length > 0) {
      createTab('forwards', terminalIds[0]);
    }
  }, [getNode, createTab]);

  const handleTreeRemove = useCallback(async (nodeId: string) => {
    const node = getNode(nodeId);
    const displayName = node?.displayName || `${node?.username}@${node?.host}`;
    if (window.confirm(`移除节点 "${displayName}" 及其所有子节点？`)) {
      try {
        await removeNode(nodeId);
      } catch (err) {
        console.error('Failed to remove tree node:', err);
      }
    }
  }, [getNode, removeNode]);

  const handleTreeSaveAsPreset = useCallback((nodeId: string) => {
    setSavePresetDialog({ open: true, nodeId });
  }, []);

  // 新建终端 (使用统一 store)
  const handleTreeNewTerminal = useCallback(async (nodeId: string) => {
    try {
      const terminalId = await createTerminalForNode(nodeId, 80, 24);
      createTab('terminal', terminalId);
    } catch (err) {
      console.error('Failed to create terminal:', err);
    }
  }, [createTerminalForNode, createTab]);

  // 关闭终端
  const handleTreeCloseTerminal = useCallback(async (nodeId: string, terminalId: string) => {
    try {
      // 关闭对应的 tab
      const tab = tabs.find(t => t.sessionId === terminalId);
      if (tab) {
        closeTab(tab.id);
      }
      await closeTerminalForNode(nodeId, terminalId);
    } catch (err) {
      console.error('Failed to close terminal:', err);
    }
  }, [closeTerminalForNode, tabs, closeTab]);

  // 选择终端 (切换 tab)
  const handleTreeSelectTerminal = useCallback((terminalId: string) => {
    const existingTab = tabs.find(t => t.sessionId === terminalId && t.type === 'terminal');
    if (existingTab) {
      setActiveTab(existingTab.id);
    } else {
      createTab('terminal', terminalId);
    }
  }, [tabs, setActiveTab, createTab]);

  // 重连节点
  const handleTreeReconnect = useCallback(async (nodeId: string) => {
    try {
      await connectNode(nodeId);
    } catch (err) {
      console.error('Failed to reconnect:', err);
    }
  }, [connectNode]);

  // 从 Saved Connections 连接 - 在树中创建根节点
  const handleConnectSaved = useCallback(async (connectionId: string) => {
    try {
      // 获取保存连接的完整信息
      const savedConn = await api.getSavedConnectionForConnect(connectionId);
      
      // 映射 auth_type
      const mapAuthType = (authType: string): 'password' | 'key' | 'agent' | undefined => {
        if (authType === 'agent') return 'agent';
        if (authType === 'key') return 'key';
        if (authType === 'password') return 'password';
        return undefined; // default_key
      };
      
      // TODO: 暂不支持 proxy_chain，显示提示
      if (savedConn.proxy_chain && savedConn.proxy_chain.length > 0) {
        console.warn('Proxy chain connections not yet supported in unified tree');
        // 可以后续用 expandManualPreset 实现
      }
      
      // 检查是否已有相同主机的根节点
      const { nodes } = useSessionTreeStore.getState();
      const existingNode = nodes.find((n: UnifiedFlatNode) => 
        n.depth === 0 && 
        n.host === savedConn.host && 
        n.port === savedConn.port && 
        n.username === savedConn.username
      );
      
      let nodeId: string;
      
      if (existingNode) {
        // 已存在相同节点 - 直接使用
        nodeId = existingNode.id;
        useSessionTreeStore.setState({ selectedNodeId: nodeId });
        
        // 如果节点未连接，尝试连接
        if (existingNode.runtime.status === 'idle' || existingNode.runtime.status === 'error') {
          await connectNode(nodeId);
        }
      } else {
        // 创建新节点
        nodeId = await addRootNode({
          host: savedConn.host,
          port: savedConn.port,
          username: savedConn.username,
          authType: mapAuthType(savedConn.auth_type),
          password: savedConn.password,
          keyPath: savedConn.key_path,
          passphrase: savedConn.passphrase,
          displayName: savedConn.name,
        });
        
        // 自动连接新创建的节点
        await connectNode(nodeId);
      }
      
      // 标记连接已使用
      await api.markConnectionUsed(connectionId);
    } catch (error) {
      console.error('Failed to connect to saved connection:', error);
      // 出错时打开编辑器
      openConnectionEditor(connectionId);
    }
  }, [addRootNode, connectNode, openConnectionEditor]);

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
            
            {/* Unified Session Tree - 统一会话树 */}
            <SessionTree
              nodes={treeNodes}
              selectedNodeId={selectedNodeId}
              activeTerminalId={activeTabId ? tabs.find(t => t.id === activeTabId)?.sessionId : null}
              onSelectNode={selectNode}
              onToggleExpand={toggleExpand}
              onConnect={handleTreeConnect}
              onDisconnect={handleTreeDisconnect}
              onReconnect={handleTreeReconnect}
              onNewTerminal={handleTreeNewTerminal}
              onCloseTerminal={handleTreeCloseTerminal}
              onSelectTerminal={handleTreeSelectTerminal}
              onOpenSftp={handleTreeOpenSftp}
              onOpenForwards={handleTreeOpenForwards}
              onDrillDown={handleTreeDrillDown}
              onRemove={handleTreeRemove}
              onSaveAsPreset={handleTreeSaveAsPreset}
            />

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
                          onClick={isManageMode ? (e) => toggleConnectionSelection(conn.id, e) : () => handleConnectSaved(conn.id)}
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

      {/* DrillDown Dialog */}
      <DrillDownDialog
        open={drillDownDialog.open}
        onOpenChange={(open) => setDrillDownDialog(prev => ({ ...prev, open }))}
        parentNodeId={drillDownDialog.parentId}
        parentHost={drillDownDialog.parentHost}
        onSuccess={async () => {
          await fetchTree();
        }}
      />

      {/* Save As Preset Dialog */}
      <SavePathAsPresetDialog
        isOpen={savePresetDialog.open}
        onClose={() => setSavePresetDialog({ open: false, nodeId: '' })}
        targetNodeId={savePresetDialog.nodeId}
        nodes={treeNodes}
        onSaved={() => {
          loadSavedConnections();
        }}
      />

      {/* Add Root Node Dialog */}
      <AddRootNodeDialog
        open={addRootNodeOpen}
        onOpenChange={setAddRootNodeOpen}
        onSuccess={async () => {
          await fetchTree();
        }}
      />
    </div>
  );
};
