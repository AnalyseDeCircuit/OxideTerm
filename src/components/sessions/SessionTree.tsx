/**
 * Session Tree Component
 * 
 * 动态交互式跳板机会话树组件
 * 
 * 支持三种跳板机模式:
 * - 模式1: 静态全手工 (manual_preset)
 * - 模式2: 静态自动计算 (auto_route)  
 * - 模式3: 动态钻入 (drill_down)
 */

import React, { useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { 
  Server, 
  ChevronRight, 
  ChevronDown,
  Loader2,
  AlertCircle,
  Link2,
  Route,
  Settings2,
  MoreHorizontal,
  Terminal,
  FolderOpen,
  Unplug,
  Trash2,
} from 'lucide-react';
import type { FlatNode, TreeNodeState } from '@/types';

// ============================================================================
// Constants
// ============================================================================

const INDENT_SIZE = 16; // px per depth level

// ============================================================================
// Types
// ============================================================================

export interface SessionTreeProps {
  nodes: FlatNode[];
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (nodeId: string) => void;
  onToggleExpand: (nodeId: string) => void;
  onDrillDown: (parentId: string) => void;
  onConnect: (nodeId: string) => void;
  onDisconnect: (nodeId: string) => void;
  onOpenTerminal: (nodeId: string) => void;
  onOpenSftp: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
}

interface LineGuide {
  depth: number;
  type: 'vertical' | 'corner' | 'tee';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 计算连接线指南
 */
function computeLineGuides(nodes: FlatNode[], currentIndex: number): LineGuide[] {
  const current = nodes[currentIndex];
  const guides: LineGuide[] = [];
  
  // 为每个深度层级确定是否需要画线
  for (let d = 0; d < current.depth; d++) {
    // 检查后续节点中是否有同深度的兄弟节点
    let hasMoreSiblingsAtDepth = false;
    let foundLowerOrEqual = false;
    
    for (let i = currentIndex + 1; i < nodes.length && !foundLowerOrEqual; i++) {
      const n = nodes[i];
      if (n.depth <= d) {
        foundLowerOrEqual = true;
      } else if (n.depth === d + 1) {
        hasMoreSiblingsAtDepth = true;
        foundLowerOrEqual = true;
      }
    }
    
    if (hasMoreSiblingsAtDepth) {
      guides.push({ depth: d, type: 'vertical' });
    }
  }
  
  // 当前节点的连接线类型
  if (current.depth > 0) {
    guides.push({
      depth: current.depth - 1,
      type: current.isLastChild ? 'corner' : 'tee',
    });
  }
  
  return guides;
}

/**
 * 获取状态图标
 */
function getStateIcon(state: TreeNodeState) {
  if (state.status === 'failed') {
    return <AlertCircle className="w-3 h-3 text-red-500" />;
  }
  switch (state.status) {
    case 'connecting':
      return <Loader2 className="w-3 h-3 animate-spin text-yellow-500" />;
    case 'connected':
      return <div className="w-2 h-2 rounded-full bg-green-500" />;
    case 'disconnected':
      return <div className="w-2 h-2 rounded-full bg-gray-500" />;
    case 'pending':
    default:
      return <div className="w-2 h-2 rounded-full bg-gray-400/50" />;
  }
}

/**
 * 获取来源图标
 */
function getOriginIcon(originType: string) {
  switch (originType) {
    case 'drill_down':
      return (
        <span title="动态钻入">
          <Link2 className="w-3 h-3 text-blue-400" />
        </span>
      );
    case 'auto_route':
      return (
        <span title="自动路由">
          <Route className="w-3 h-3 text-purple-400" />
        </span>
      );
    case 'manual_preset':
      return (
        <span title="手动预设">
          <Settings2 className="w-3 h-3 text-orange-400" />
        </span>
      );
    default:
      return null;
  }
}

// ============================================================================
// Tree Lines Component
// ============================================================================

interface TreeLinesProps {
  guides: LineGuide[];
  indentSize: number;
}

const TreeLines: React.FC<TreeLinesProps> = ({ guides, indentSize }) => {
  return (
    <>
      {guides.map((guide, i) => {
        const left = guide.depth * indentSize + indentSize / 2;
        
        switch (guide.type) {
          case 'vertical':
            return (
              <div
                key={`v-${i}`}
                className="absolute top-0 bottom-0 w-px bg-white/10"
                style={{ left }}
              />
            );
          case 'corner':
            return (
              <React.Fragment key={`c-${i}`}>
                {/* 垂直线（上半部分） */}
                <div
                  className="absolute top-0 w-px bg-white/10"
                  style={{ left, height: '50%' }}
                />
                {/* 水平线 */}
                <div
                  className="absolute h-px bg-white/10"
                  style={{ 
                    left, 
                    top: '50%', 
                    width: indentSize / 2 
                  }}
                />
              </React.Fragment>
            );
          case 'tee':
            return (
              <React.Fragment key={`t-${i}`}>
                {/* 垂直线（全高） */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-white/10"
                  style={{ left }}
                />
                {/* 水平线 */}
                <div
                  className="absolute h-px bg-white/10"
                  style={{ 
                    left, 
                    top: '50%', 
                    width: indentSize / 2 
                  }}
                />
              </React.Fragment>
            );
          default:
            return null;
        }
      })}
    </>
  );
};

// ============================================================================
// Session Tree Node Component
// ============================================================================

interface SessionTreeNodeProps {
  node: FlatNode;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onDrillDown: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onOpenTerminal: () => void;
  onOpenSftp: () => void;
  onRemove: () => void;
  lineGuides: LineGuide[];
}

const SessionTreeNode: React.FC<SessionTreeNodeProps> = ({
  node,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  onDrillDown,
  onConnect,
  onDisconnect,
  onOpenTerminal,
  onOpenSftp,
  onRemove,
  lineGuides,
}) => {
  const paddingLeft = node.depth * INDENT_SIZE;
  const displayLabel = node.displayName || `${node.username}@${node.host}`;
  const isConnected = node.state.status === 'connected';
  
  const [showMenu, setShowMenu] = React.useState(false);
  
  const handleDoubleClick = useCallback(() => {
    if (isConnected) {
      // 已连接：打开终端
      onOpenTerminal();
    } else if (node.state.status === 'pending' || node.state.status === 'disconnected') {
      // 未连接：发起连接
      onConnect();
    }
  }, [isConnected, node.state.status, onOpenTerminal, onConnect]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowMenu(true);
  }, []);
  
  return (
    <div
      className={cn(
        "session-tree-node relative flex items-center h-7 px-2 cursor-pointer group",
        "hover:bg-white/5 transition-colors",
        isSelected && "bg-white/10"
      )}
      style={{ paddingLeft }}
      onClick={onSelect}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      {/* 连接线 */}
      <TreeLines guides={lineGuides} indentSize={INDENT_SIZE} />
      
      {/* 展开/折叠箭头 */}
      {node.hasChildren ? (
        <button
          className="w-4 h-4 flex items-center justify-center mr-1 hover:bg-white/10 rounded"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>
      ) : (
        <div className="w-4 h-4 mr-1" />
      )}
      
      {/* 服务器图标 */}
      <Server className="w-4 h-4 mr-2 text-gray-400" />
      
      {/* 来源标记 */}
      {getOriginIcon(node.originType)}
      
      {/* 名称 */}
      <span className="truncate flex-1 text-sm ml-1">{displayLabel}</span>
      
      {/* 状态指示器 */}
      <div className="ml-2">{getStateIcon(node.state)}</div>
      
      {/* 更多操作按钮 */}
      <button
        className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
      >
        <MoreHorizontal className="w-3 h-3" />
      </button>
      
      {/* 右键菜单 */}
      {showMenu && (
        <div 
          className="absolute right-2 top-7 z-50 min-w-[160px] bg-zinc-800 border border-zinc-700 rounded-md shadow-lg py-1"
          onMouseLeave={() => setShowMenu(false)}
        >
          {isConnected ? (
            <>
              <button
                className="w-full px-3 py-1.5 text-sm text-left hover:bg-white/10 flex items-center gap-2"
                onClick={() => { onOpenTerminal(); setShowMenu(false); }}
              >
                <Terminal className="w-4 h-4" /> 打开终端
              </button>
              <button
                className="w-full px-3 py-1.5 text-sm text-left hover:bg-white/10 flex items-center gap-2"
                onClick={() => { onOpenSftp(); setShowMenu(false); }}
              >
                <FolderOpen className="w-4 h-4" /> 打开 SFTP
              </button>
              <div className="h-px bg-zinc-700 my-1" />
              <button
                className="w-full px-3 py-1.5 text-sm text-left hover:bg-white/10 flex items-center gap-2"
                onClick={() => { onDrillDown(); setShowMenu(false); }}
              >
                <Link2 className="w-4 h-4" /> 钻入新服务器
              </button>
              <div className="h-px bg-zinc-700 my-1" />
              <button
                className="w-full px-3 py-1.5 text-sm text-left hover:bg-white/10 flex items-center gap-2 text-orange-400"
                onClick={() => { onDisconnect(); setShowMenu(false); }}
              >
                <Unplug className="w-4 h-4" /> 断开连接
              </button>
            </>
          ) : (
            <>
              <button
                className="w-full px-3 py-1.5 text-sm text-left hover:bg-white/10 flex items-center gap-2"
                onClick={() => { onConnect(); setShowMenu(false); }}
              >
                <Server className="w-4 h-4" /> 连接
              </button>
              <div className="h-px bg-zinc-700 my-1" />
              <button
                className="w-full px-3 py-1.5 text-sm text-left hover:bg-white/10 flex items-center gap-2 text-red-400"
                onClick={() => { onRemove(); setShowMenu(false); }}
              >
                <Trash2 className="w-4 h-4" /> 移除
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Session Tree Component
// ============================================================================

export const SessionTree: React.FC<SessionTreeProps> = ({
  nodes,
  selectedId,
  expandedIds,
  onSelect,
  onToggleExpand,
  onDrillDown,
  onConnect,
  onDisconnect,
  onOpenTerminal,
  onOpenSftp,
  onRemove,
}) => {
  // 过滤出应该显示的节点（考虑展开状态）
  const visibleNodes = useMemo(() => {
    const visible: FlatNode[] = [];
    const collapsedParents = new Set<string>();
    
    for (const node of nodes) {
      // 检查是否有任何祖先被折叠
      let hidden = false;
      if (node.parentId) {
        let parentId: string | null = node.parentId;
        while (parentId) {
          if (collapsedParents.has(parentId)) {
            hidden = true;
            break;
          }
          const parent = nodes.find(n => n.id === parentId);
          parentId = parent?.parentId || null;
        }
      }
      
      if (!hidden) {
        visible.push(node);
        
        // 如果此节点未展开且有子节点，标记为折叠
        if (node.hasChildren && !expandedIds.has(node.id)) {
          collapsedParents.add(node.id);
        }
      }
    }
    
    return visible;
  }, [nodes, expandedIds]);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-500 text-sm">
        <Server className="w-8 h-8 mb-2 opacity-50" />
        <p>暂无会话</p>
        <p className="text-xs mt-1">点击左侧连接列表开始</p>
      </div>
    );
  }

  return (
    <div className="session-tree select-none">
      {visibleNodes.map((node, index) => (
        <SessionTreeNode
          key={node.id}
          node={node}
          isSelected={selectedId === node.id}
          isExpanded={expandedIds.has(node.id)}
          onSelect={() => onSelect(node.id)}
          onToggleExpand={() => onToggleExpand(node.id)}
          onDrillDown={() => onDrillDown(node.id)}
          onConnect={() => onConnect(node.id)}
          onDisconnect={() => onDisconnect(node.id)}
          onOpenTerminal={() => onOpenTerminal(node.id)}
          onOpenSftp={() => onOpenSftp(node.id)}
          onRemove={() => onRemove(node.id)}
          lineGuides={computeLineGuides(visibleNodes, index)}
        />
      ))}
    </div>
  );
};

export default SessionTree;
