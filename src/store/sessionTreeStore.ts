/**
 * Session Tree Store
 * 
 * 动态交互式跳板机会话树状态管理
 */

import { create } from 'zustand';
import { api } from '../lib/api';
import type { 
  FlatNode, 
  SessionTreeSummary,
  ConnectServerRequest,
  DrillDownRequest,
  ConnectPresetChainRequest,
} from '../types';

// ============================================================================
// Types
// ============================================================================

interface SessionTreeStore {
  // State
  nodes: FlatNode[];
  selectedNodeId: string | null;
  expandedIds: Set<string>;
  isLoading: boolean;
  error: string | null;
  summary: SessionTreeSummary | null;
  
  // Actions - Data
  fetchTree: () => Promise<void>;
  fetchSummary: () => Promise<void>;
  
  // Actions - Node Operations
  addRootNode: (request: ConnectServerRequest) => Promise<string>;
  drillDown: (request: DrillDownRequest) => Promise<string>;
  expandManualPreset: (request: ConnectPresetChainRequest) => Promise<string>;
  removeNode: (nodeId: string) => Promise<string[]>;
  clearTree: () => Promise<void>;
  
  // Actions - State Updates
  updateNodeState: (nodeId: string, state: string, error?: string) => Promise<void>;
  setNodeConnection: (nodeId: string, connectionId: string) => Promise<void>;
  setNodeTerminal: (nodeId: string, sessionId: string) => Promise<void>;
  setNodeSftp: (nodeId: string, sessionId: string) => Promise<void>;
  
  // Actions - UI
  selectNode: (nodeId: string | null) => void;
  toggleExpand: (nodeId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  
  // Helpers
  getNode: (nodeId: string) => FlatNode | undefined;
  getNodePath: (nodeId: string) => Promise<FlatNode[]>;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useSessionTreeStore = create<SessionTreeStore>((set, get) => ({
  // Initial State
  nodes: [],
  selectedNodeId: null,
  expandedIds: new Set<string>(),
  isLoading: false,
  error: null,
  summary: null,
  
  // ============ Data Actions ============
  
  fetchTree: async () => {
    set({ isLoading: true, error: null });
    try {
      const nodes = await api.getSessionTree();
      // 默认展开所有节点
      const expandedIds = new Set(nodes.filter(n => n.hasChildren).map(n => n.id));
      set({ nodes, expandedIds, isLoading: false });
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
  
  // ============ Node Operations ============
  
  addRootNode: async (request: ConnectServerRequest) => {
    set({ isLoading: true, error: null });
    try {
      const nodeId = await api.addRootNode(request);
      await get().fetchTree();
      // 自动选中新节点
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
      // 确保父节点展开
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
      const removedIds = await api.removeTreeNode(nodeId);
      await get().fetchTree();
      
      // 如果删除的节点包含当前选中的节点，清除选中状态
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
        nodes: [], 
        selectedNodeId: null, 
        expandedIds: new Set(), 
        isLoading: false 
      });
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },
  
  // ============ State Updates ============
  
  updateNodeState: async (nodeId: string, state: string, error?: string) => {
    try {
      await api.updateTreeNodeState(nodeId, state, error);
      // 刷新树以获取最新状态
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
  
  // ============ UI Actions ============
  
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
  },
  
  expandAll: () => {
    const { nodes } = get();
    const expandedIds = new Set(nodes.filter(n => n.hasChildren).map(n => n.id));
    set({ expandedIds });
  },
  
  collapseAll: () => {
    set({ expandedIds: new Set() });
  },
  
  // ============ Helpers ============
  
  getNode: (nodeId: string) => {
    return get().nodes.find(n => n.id === nodeId);
  },
  
  getNodePath: async (nodeId: string) => {
    return api.getTreeNodePath(nodeId);
  },
}));

export default useSessionTreeStore;
