/**
 * Session Tree Store (Unified)
 * 
 * Single Source of Truth for all session state
 * 
 * 设计原则:
 * 1. sessionTreeStore 是唯一事实来源，驱动所有 UI 渲染
 * 2. appStore.connections 只作为底层句柄池缓存
 * 3. 状态映射: NodeState = f(ConnectionStatus, TerminalSessionCount)
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { api } from '../lib/api';
import type { 
  FlatNode, 
  SessionTreeSummary,
  ConnectServerRequest,
  DrillDownRequest,
  ConnectPresetChainRequest,
  UnifiedFlatNode,
  UnifiedNodeStatus,
  NodeRuntimeState,
  TreeNodeState,
} from '../types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 计算统一节点状态
 * NodeState = f(ConnectionStatus, TerminalSessionCount)
 */
function computeUnifiedStatus(
  backendState: TreeNodeState,
  terminalCount: number,
  isLinkDown: boolean
): UnifiedNodeStatus {
  // 优先级: link-down > error > connected/active > connecting > idle
  if (isLinkDown) {
    return 'link-down';
  }
  
  switch (backendState.status) {
    case 'connecting':
      return 'connecting';
    case 'connected':
      return terminalCount > 0 ? 'active' : 'connected';
    case 'failed':
      return 'error';
    case 'disconnected':
    case 'pending':
    default:
      return 'idle';
  }
}

// ============================================================================
// Types
// ============================================================================

interface SessionTreeStore {
  // ========== State ==========
  /** 后端原始节点数据 */
  rawNodes: FlatNode[];
  /** 统一节点数据 (Single Source of Truth) */
  nodes: UnifiedFlatNode[];
  /** 当前选中的节点 ID */
  selectedNodeId: string | null;
  /** 展开的节点 ID 集合 */
  expandedIds: Set<string>;
  /** 加载状态 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 树摘要 */
  summary: SessionTreeSummary | null;
  
  /** 节点终端映射 (nodeId -> terminalIds) - 支持多终端 */
  nodeTerminalMap: Map<string, string[]>;
  /** 终端到节点的反向映射 (terminalId -> nodeId) */
  terminalNodeMap: Map<string, string>;
  /** 链路断开的节点 ID 集合 */
  linkDownNodeIds: Set<string>;
  
  // ========== Data Actions ==========
  fetchTree: () => Promise<void>;
  fetchSummary: () => Promise<void>;
  
  // ========== Node Operations ==========
  addRootNode: (request: ConnectServerRequest) => Promise<string>;
  drillDown: (request: DrillDownRequest) => Promise<string>;
  expandManualPreset: (request: ConnectPresetChainRequest) => Promise<string>;
  removeNode: (nodeId: string) => Promise<string[]>;
  clearTree: () => Promise<void>;
  
  // ========== Connection Management ==========
  /** 连接节点 (建立 SSH 连接) */
  connectNode: (nodeId: string) => Promise<void>;
  /** 断开节点 (级联断开所有子节点) */
  disconnectNode: (nodeId: string) => Promise<void>;
  
  // ========== Terminal Management (新增) ==========
  /** 为节点创建新终端 */
  createTerminalForNode: (nodeId: string, cols?: number, rows?: number) => Promise<string>;
  /** 关闭节点的指定终端 */
  closeTerminalForNode: (nodeId: string, terminalId: string) => Promise<void>;
  /** 获取节点的所有终端 */
  getTerminalsForNode: (nodeId: string) => string[];
  /** 通过终端 ID 查找所属节点 */
  getNodeByTerminalId: (terminalId: string) => UnifiedFlatNode | undefined;
  
  // ========== SFTP Management ==========
  /** 打开节点的 SFTP 会话 */
  openSftpForNode: (nodeId: string) => Promise<string>;
  /** 关闭节点的 SFTP 会话 */
  closeSftpForNode: (nodeId: string) => Promise<void>;
  
  // ========== State Sync ==========
  /** 更新节点状态 (来自后端事件) */
  updateNodeState: (nodeId: string, state: string, error?: string) => Promise<void>;
  /** 设置节点连接 ID */
  setNodeConnection: (nodeId: string, connectionId: string) => Promise<void>;
  /** 设置节点终端 (向后端同步) */
  setNodeTerminal: (nodeId: string, sessionId: string) => Promise<void>;
  /** 设置节点 SFTP (向后端同步) */
  setNodeSftp: (nodeId: string, sessionId: string) => Promise<void>;
  /** 标记节点为 link-down (级联) */
  markLinkDown: (nodeId: string) => void;
  /** 清除 link-down 标记 */
  clearLinkDown: (nodeId: string) => void;
  
  // ========== UI Actions ==========
  selectNode: (nodeId: string | null) => void;
  toggleExpand: (nodeId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  
  // ========== Helpers ==========
  getNode: (nodeId: string) => UnifiedFlatNode | undefined;
  getRawNode: (nodeId: string) => FlatNode | undefined;
  getNodePath: (nodeId: string) => Promise<FlatNode[]>;
  getDescendants: (nodeId: string) => UnifiedFlatNode[];
  /** 重建统一节点列表 */
  rebuildUnifiedNodes: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useSessionTreeStore = create<SessionTreeStore>()(
  subscribeWithSelector((set, get) => ({
    // ========== Initial State ==========
    rawNodes: [],
    nodes: [],
    selectedNodeId: null,
    expandedIds: new Set<string>(),
    isLoading: false,
    error: null,
    summary: null,
    nodeTerminalMap: new Map<string, string[]>(),
    terminalNodeMap: new Map<string, string>(),
    linkDownNodeIds: new Set<string>(),
    
    // ========== Data Actions ==========
    
    fetchTree: async () => {
      set({ isLoading: true, error: null });
      try {
        const rawNodes = await api.getSessionTree();
        // 默认展开所有有子节点的节点
        const expandedIds = new Set(rawNodes.filter(n => n.hasChildren).map(n => n.id));
        set({ rawNodes, expandedIds, isLoading: false });
        get().rebuildUnifiedNodes();
      } catch (e) {
        set({ error: String(e), isLoading: false });
      }
    },
    
    fetchSummary: async () => {
      try {
        const summary = await api.getSessionTreeSummary();
        set({ summary });
      } catch (e) {
        console.error('Failed to fetch session tree summary:', e);
      }
    },
    
    // ========== Node Operations ==========
    
    addRootNode: async (request: ConnectServerRequest) => {
      set({ isLoading: true, error: null });
      try {
        const nodeId = await api.addRootNode(request);
        await get().fetchTree();
        set({ selectedNodeId: nodeId, isLoading: false });
        return nodeId;
      } catch (e) {
        set({ error: String(e), isLoading: false });
        throw e;
      }
    },
    
    drillDown: async (request: DrillDownRequest) => {
      set({ isLoading: true, error: null });
      try {
        const nodeId = await api.treeDrillDown(request);
        await get().fetchTree();
        const { expandedIds } = get();
        const newExpanded = new Set(expandedIds);
        newExpanded.add(request.parentNodeId);
        set({ selectedNodeId: nodeId, expandedIds: newExpanded, isLoading: false });
        return nodeId;
      } catch (e) {
        set({ error: String(e), isLoading: false });
        throw e;
      }
    },
    
    expandManualPreset: async (request: ConnectPresetChainRequest) => {
      set({ isLoading: true, error: null });
      try {
        const targetId = await api.expandManualPreset(request);
        await get().fetchTree();
        set({ selectedNodeId: targetId, isLoading: false });
        return targetId;
      } catch (e) {
        set({ error: String(e), isLoading: false });
        throw e;
      }
    },
    
    removeNode: async (nodeId: string) => {
      set({ isLoading: true, error: null });
      try {
        // 清理该节点和所有子节点的终端映射
        const descendants = get().getDescendants(nodeId);
        const currentNode = get().getNode(nodeId);
        const nodesToRemove = currentNode ? [currentNode, ...descendants] : descendants;
        
        const { nodeTerminalMap, terminalNodeMap } = get();
        const newTerminalMap = new Map(nodeTerminalMap);
        const newNodeMap = new Map(terminalNodeMap);
        
        for (const node of nodesToRemove) {
          const terminals = newTerminalMap.get(node.id) || [];
          for (const termId of terminals) {
            newNodeMap.delete(termId);
          }
          newTerminalMap.delete(node.id);
        }
        
        set({ nodeTerminalMap: newTerminalMap, terminalNodeMap: newNodeMap });
        
        const removedIds = await api.removeTreeNode(nodeId);
        await get().fetchTree();
        
        const { selectedNodeId } = get();
        if (selectedNodeId && removedIds.includes(selectedNodeId)) {
          set({ selectedNodeId: null });
        }
        
        set({ isLoading: false });
        return removedIds;
      } catch (e) {
        set({ error: String(e), isLoading: false });
        throw e;
      }
    },
    
    clearTree: async () => {
      set({ isLoading: true, error: null });
      try {
        await api.clearSessionTree();
        set({ 
          rawNodes: [],
          nodes: [], 
          selectedNodeId: null, 
          expandedIds: new Set(),
          nodeTerminalMap: new Map(),
          terminalNodeMap: new Map(),
          linkDownNodeIds: new Set(),
          isLoading: false 
        });
      } catch (e) {
        set({ error: String(e), isLoading: false });
        throw e;
      }
    },
    
    // ========== Connection Management ==========
    
    connectNode: async (nodeId: string) => {
      const node = get().getRawNode(nodeId);
      if (!node) throw new Error(`Node ${nodeId} not found`);
      
      try {
        // 更新状态为 connecting
        await api.updateTreeNodeState(nodeId, 'connecting');
        get().rebuildUnifiedNodes();
        
        // 调用后端连接 API
        const response = await api.connectTreeNode({ nodeId });
        
        // 更新连接 ID
        await api.setTreeNodeConnection(nodeId, response.sshConnectionId);
        await get().fetchTree();
      } catch (e) {
        await api.updateTreeNodeState(nodeId, 'failed', String(e));
        get().rebuildUnifiedNodes();
        throw e;
      }
    },
    
    disconnectNode: async (nodeId: string) => {
      const node = get().getNode(nodeId);
      if (!node) return;
      
      // 1. 获取所有子节点
      const descendants = get().getDescendants(nodeId);
      
      // 2. 标记所有子节点为 link-down
      const { linkDownNodeIds } = get();
      const newLinkDownIds = new Set(linkDownNodeIds);
      for (const child of descendants) {
        newLinkDownIds.add(child.id);
      }
      set({ linkDownNodeIds: newLinkDownIds });
      
      // 3. 断开当前节点的 SSH 连接
      if (node.runtime.connectionId) {
        try {
          await api.sshDisconnect(node.runtime.connectionId);
        } catch (e) {
          console.error('Failed to disconnect SSH:', e);
        }
      }
      
      // 4. 刷新树状态
      await get().fetchTree();
    },
    
    // ========== Terminal Management ==========
    
    createTerminalForNode: async (nodeId: string, cols?: number, rows?: number) => {
      const node = get().getNode(nodeId);
      if (!node) throw new Error(`Node ${nodeId} not found`);
      if (!node.runtime.connectionId) {
        throw new Error(`Node ${nodeId} is not connected`);
      }
      
      // 调用 API 创建终端
      const response = await api.createTerminal({
        connectionId: node.runtime.connectionId,
        cols,
        rows,
      });
      const terminalId = response.sessionId;
      
      // 同步到 appStore.sessions（用于 createTab 兼容）
      const { useAppStore } = await import('./appStore');
      useAppStore.setState((state) => {
        const newSessions = new Map(state.sessions);
        newSessions.set(terminalId, response.session);
        return { sessions: newSessions };
      });
      
      // 更新终端映射
      const { nodeTerminalMap, terminalNodeMap } = get();
      const newTerminalMap = new Map(nodeTerminalMap);
      const newNodeMap = new Map(terminalNodeMap);
      
      const existing = newTerminalMap.get(nodeId) || [];
      newTerminalMap.set(nodeId, [...existing, terminalId]);
      newNodeMap.set(terminalId, nodeId);
      
      set({ nodeTerminalMap: newTerminalMap, terminalNodeMap: newNodeMap });
      
      // 通知后端更新节点终端 (使用第一个终端作为主终端)
      if (existing.length === 0) {
        await api.setTreeNodeTerminal(nodeId, terminalId);
      }
      
      // 重建统一节点
      get().rebuildUnifiedNodes();
      
      return terminalId;
    },
    
    closeTerminalForNode: async (nodeId: string, terminalId: string) => {
      const { nodeTerminalMap, terminalNodeMap } = get();
      
      // 从映射中移除
      const newTerminalMap = new Map(nodeTerminalMap);
      const newNodeMap = new Map(terminalNodeMap);
      
      const existing = newTerminalMap.get(nodeId) || [];
      const filtered = existing.filter(id => id !== terminalId);
      
      if (filtered.length > 0) {
        newTerminalMap.set(nodeId, filtered);
      } else {
        newTerminalMap.delete(nodeId);
      }
      newNodeMap.delete(terminalId);
      
      set({ nodeTerminalMap: newTerminalMap, terminalNodeMap: newNodeMap });
      
      // 调用 API 关闭终端
      try {
        await api.closeTerminal(terminalId);
      } catch (e) {
        console.error('Failed to close terminal:', e);
      }
      
      // 重建统一节点
      get().rebuildUnifiedNodes();
    },
    
    getTerminalsForNode: (nodeId: string) => {
      return get().nodeTerminalMap.get(nodeId) || [];
    },
    
    getNodeByTerminalId: (terminalId: string) => {
      const nodeId = get().terminalNodeMap.get(terminalId);
      if (!nodeId) return undefined;
      return get().getNode(nodeId);
    },
    
    // ========== SFTP Management ==========
    
    openSftpForNode: async (nodeId: string) => {
      const node = get().getNode(nodeId);
      if (!node) throw new Error(`Node ${nodeId} not found`);
      if (!node.runtime.connectionId) {
        throw new Error(`Node ${nodeId} is not connected`);
      }
      
      // 调用 API 初始化 SFTP (使用终端会话 ID)
      // 注意: SFTP 需要一个关联的终端会话
      const terminalIds = get().getTerminalsForNode(nodeId);
      if (terminalIds.length === 0) {
        throw new Error('No terminal session found for SFTP initialization');
      }
      const sftpId = await api.sftpInit(terminalIds[0]);
      
      // 更新后端节点状态
      await api.setTreeNodeSftp(nodeId, sftpId);
      
      // 刷新树
      await get().fetchTree();
      
      return sftpId;
    },
    
    closeSftpForNode: async (nodeId: string) => {
      const node = get().getNode(nodeId);
      if (!node || !node.runtime.sftpSessionId) return;
      
      // SFTP 会话会随终端关闭自动清理，这里只更新状态
      // 注意: 当前 API 没有显式的 closeSftpSession 方法
      
      // 刷新树
      await get().fetchTree();
    },
    
    // ========== State Sync ==========
    
    updateNodeState: async (nodeId: string, state: string, error?: string) => {
      try {
        await api.updateTreeNodeState(nodeId, state, error);
        await get().fetchTree();
      } catch (e) {
        console.error('Failed to update node state:', e);
      }
    },
    
    setNodeConnection: async (nodeId: string, connectionId: string) => {
      try {
        await api.setTreeNodeConnection(nodeId, connectionId);
        await get().fetchTree();
      } catch (e) {
        console.error('Failed to set node connection:', e);
      }
    },
    
    setNodeTerminal: async (nodeId: string, sessionId: string) => {
      try {
        await api.setTreeNodeTerminal(nodeId, sessionId);
        await get().fetchTree();
      } catch (e) {
        console.error('Failed to set node terminal:', e);
      }
    },
    
    setNodeSftp: async (nodeId: string, sessionId: string) => {
      try {
        await api.setTreeNodeSftp(nodeId, sessionId);
        await get().fetchTree();
      } catch (e) {
        console.error('Failed to set node SFTP:', e);
      }
    },
    
    markLinkDown: (nodeId: string) => {
      const descendants = get().getDescendants(nodeId);
      const { linkDownNodeIds } = get();
      const newLinkDownIds = new Set(linkDownNodeIds);
      
      for (const child of descendants) {
        newLinkDownIds.add(child.id);
      }
      
      set({ linkDownNodeIds: newLinkDownIds });
      get().rebuildUnifiedNodes();
    },
    
    clearLinkDown: (nodeId: string) => {
      const { linkDownNodeIds } = get();
      const newLinkDownIds = new Set(linkDownNodeIds);
      newLinkDownIds.delete(nodeId);
      
      // 如果父节点不再是 link-down，子节点也可以清除
      const descendants = get().getDescendants(nodeId);
      for (const child of descendants) {
        newLinkDownIds.delete(child.id);
      }
      
      set({ linkDownNodeIds: newLinkDownIds });
      get().rebuildUnifiedNodes();
    },
    
    // ========== UI Actions ==========
    
    selectNode: (nodeId: string | null) => {
      set({ selectedNodeId: nodeId });
    },
    
    toggleExpand: (nodeId: string) => {
      const { expandedIds } = get();
      const newExpanded = new Set(expandedIds);
      if (newExpanded.has(nodeId)) {
        newExpanded.delete(nodeId);
      } else {
        newExpanded.add(nodeId);
      }
      set({ expandedIds: newExpanded });
      get().rebuildUnifiedNodes();
    },
    
    expandAll: () => {
      const { rawNodes } = get();
      const expandedIds = new Set(rawNodes.filter(n => n.hasChildren).map(n => n.id));
      set({ expandedIds });
      get().rebuildUnifiedNodes();
    },
    
    collapseAll: () => {
      set({ expandedIds: new Set() });
      get().rebuildUnifiedNodes();
    },
    
    // ========== Helpers ==========
    
    getNode: (nodeId: string) => {
      return get().nodes.find(n => n.id === nodeId);
    },
    
    getRawNode: (nodeId: string) => {
      return get().rawNodes.find(n => n.id === nodeId);
    },
    
    getNodePath: async (nodeId: string) => {
      return api.getTreeNodePath(nodeId);
    },
    
    getDescendants: (nodeId: string) => {
      const { nodes } = get();
      const result: UnifiedFlatNode[] = [];
      
      // 递归收集所有子节点
      const collectChildren = (parentId: string) => {
        for (const node of nodes) {
          if (node.parentId === parentId) {
            result.push(node);
            collectChildren(node.id);
          }
        }
      };
      
      collectChildren(nodeId);
      return result;
    },
    
    rebuildUnifiedNodes: () => {
      const { rawNodes, expandedIds, nodeTerminalMap, linkDownNodeIds } = get();
      
      // 构建 lineGuides (连接线指示)
      const buildLineGuides = (node: FlatNode, allNodes: FlatNode[]): boolean[] => {
        const guides: boolean[] = [];
        let current = node;
        
        // 从当前节点向上遍历，确定每一层是否需要显示连接线
        while (current.parentId) {
          const parent = allNodes.find(n => n.id === current.parentId);
          if (!parent) break;
          
          // 检查父节点是否还有更多子节点
          const siblings = allNodes.filter(n => n.parentId === parent.id);
          const currentIndex = siblings.findIndex(s => s.id === current.id);
          const hasMoreSiblings = currentIndex < siblings.length - 1;
          
          guides.unshift(hasMoreSiblings);
          current = parent;
        }
        
        return guides;
      };
      
      // 创建统一节点
      const unifiedNodes: UnifiedFlatNode[] = rawNodes.map(node => {
        const isExpanded = expandedIds.has(node.id);
        const lineGuides = buildLineGuides(node, rawNodes);
        
        // 获取该节点的所有终端
        const terminalIds = nodeTerminalMap.get(node.id) || 
          (node.terminalSessionId ? [node.terminalSessionId] : []);
        
        // 计算状态
        const isLinkDown = linkDownNodeIds.has(node.id);
        const runtime: NodeRuntimeState = {
          connectionId: node.sshConnectionId,
          status: computeUnifiedStatus(node.state, terminalIds.length, isLinkDown),
          terminalIds,
          sftpSessionId: node.sftpSessionId,
          errorMessage: node.state.status === 'failed' ? node.state.error : undefined,
          lastConnectedAt: node.state.status === 'connected' ? Date.now() : undefined,
        };
        
        return {
          ...node,
          runtime,
          isExpanded,
          lineGuides,
        };
      });
      
      set({ nodes: unifiedNodes });
    },
  }))
);

// ============================================================================
// Subscriptions & Side Effects
// ============================================================================

// 监听后端事件并同步状态
// 这部分需要在 App 初始化时设置
export function setupTreeStoreSubscriptions() {
  // 可以在这里添加 Tauri 事件监听器
  // listen('ssh-connection-state-changed', (event) => { ... })
}

export default useSessionTreeStore;
