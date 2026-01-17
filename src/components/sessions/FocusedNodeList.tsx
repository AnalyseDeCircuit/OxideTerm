/**
 * FocusedNodeList Component
 * 
 * 聚焦模式下的节点列表组件 - 只显示当前聚焦节点的直接子节点
 */

import React from 'react';
import { cn } from '@/lib/utils';
import {
  Server,
  ChevronRight,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Link2,
  Route,
  Terminal,
  FolderOpen,
  Unplug,
  Plug,
  ArrowRightLeft,
  ArrowDownRight,
  X,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { UnifiedFlatNode, UnifiedNodeStatus } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface FocusedNodeListProps {
  /** 当前聚焦的节点（null 表示根视图） */
  focusedNode: UnifiedFlatNode | null;
  /** 可见的子节点列表 */
  children: UnifiedFlatNode[];
  /** 当前选中的节点 ID */
  selectedNodeId: string | null;
  /** 当前激活的终端 ID */
  activeTerminalId?: string | null;
  
  // 事件回调
  onSelect: (nodeId: string) => void;
  onEnter: (nodeId: string) => void;
  onConnect: (nodeId: string) => void;
  onDisconnect: (nodeId: string) => void;
  onReconnect?: (nodeId: string) => void;
  onNewTerminal: (nodeId: string) => void;
  onSelectTerminal: (terminalId: string) => void;
  onCloseTerminal: (nodeId: string, terminalId: string) => void;
  onOpenSftp: (nodeId: string) => void;
  onOpenForwards?: (nodeId: string) => void;
  onDrillDown: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
}

// ============================================================================
// Status Helpers
// ============================================================================

function getStatusStyles(status: UnifiedNodeStatus): {
  dot: string;
  text: string;
  bg: string;
} {
  switch (status) {
    case 'idle':
      return { 
        dot: 'bg-zinc-500', 
        text: 'text-zinc-400',
        bg: 'hover:bg-white/5',
      };
    case 'connecting':
      return { 
        dot: 'bg-blue-500 animate-pulse', 
        text: 'text-blue-400',
        bg: 'hover:bg-blue-500/10',
      };
    case 'connected':
      return { 
        dot: 'bg-emerald-500 ring-2 ring-emerald-500/30', 
        text: 'text-emerald-400',
        bg: 'hover:bg-emerald-500/10',
      };
    case 'active':
      return { 
        dot: 'bg-emerald-500', 
        text: 'text-emerald-300',
        bg: 'bg-emerald-500/10 hover:bg-emerald-500/15',
      };
    case 'link-down':
      return { 
        dot: 'bg-orange-500 animate-pulse', 
        text: 'text-orange-400',
        bg: 'hover:bg-orange-500/10',
      };
    case 'error':
      return { 
        dot: 'bg-red-500', 
        text: 'text-red-400',
        bg: 'hover:bg-red-500/10',
      };
    default:
      return { 
        dot: 'bg-zinc-500', 
        text: 'text-zinc-400',
        bg: 'hover:bg-white/5',
      };
  }
}

function getStatusIcon(status: UnifiedNodeStatus) {
  switch (status) {
    case 'connecting':
      return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />;
    case 'link-down':
      return <AlertTriangle className="w-4 h-4 text-orange-400" />;
    case 'error':
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    default:
      return null;
  }
}

function getOriginIcon(originType: string) {
  switch (originType) {
    case 'drill_down':
      return <Link2 className="w-3 h-3 text-blue-400 opacity-60" />;
    case 'auto_route':
      return <Route className="w-3 h-3 text-purple-400 opacity-60" />;
    default:
      return null;
  }
}

function getStatusLabel(status: UnifiedNodeStatus): string {
  switch (status) {
    case 'idle': return '未连接';
    case 'connecting': return '连接中...';
    case 'connected': return '已连接';
    case 'active': return '活跃';
    case 'link-down': return '链路断开';
    case 'error': return '错误';
    default: return '';
  }
}

// ============================================================================
// Node Item Component
// ============================================================================

interface NodeItemProps {
  node: UnifiedFlatNode;
  isSelected: boolean;
  activeTerminalId?: string | null;
  onClick: () => void;
  onDoubleClick: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onReconnect?: () => void;
  onNewTerminal: () => void;
  onSelectTerminal: (terminalId: string) => void;
  onCloseTerminal: (terminalId: string) => void; // NodeItem level only needs terminalId
  onOpenSftp: () => void;
  onOpenForwards?: () => void;
  onDrillDown: () => void;
  onRemove: () => void;
}

const NodeItem: React.FC<NodeItemProps> = ({
  node,
  isSelected,
  activeTerminalId,
  onClick,
  onDoubleClick,
  onConnect,
  onDisconnect,
  onReconnect,
  onNewTerminal,
  onSelectTerminal,
  onCloseTerminal,
  onOpenSftp,
  onOpenForwards,
  onDrillDown,
  onRemove,
}) => {
  const status = node.runtime.status;
  const styles = getStatusStyles(status);
  const statusIcon = getStatusIcon(status);
  const originIcon = getOriginIcon(node.originType);
  const displayName = node.displayName || `${node.username}@${node.host}`;
  const subtitle = node.displayName ? `${node.username}@${node.host}` : `Port ${node.port}`;
  
  const isConnected = status === 'connected' || status === 'active';
  const isConnecting = status === 'connecting';
  const canEnter = node.hasChildren;
  const terminals = node.runtime.terminalIds || [];
  
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className={cn(
            "group flex flex-col gap-1 p-3 mx-2 mb-2 rounded-lg border transition-all cursor-pointer",
            "border-theme-border/50",
            styles.bg,
            isSelected && "ring-1 ring-oxide-accent border-oxide-accent/50 bg-oxide-accent/5"
          )}
          onClick={onClick}
          onDoubleClick={canEnter ? onDoubleClick : undefined}
        >
          {/* 主行 */}
          <div className="flex items-center gap-3">
            {/* 状态点/图标 */}
            <div className="flex-shrink-0">
              {statusIcon || (
                <div className={cn("w-2.5 h-2.5 rounded-full", styles.dot)} />
              )}
            </div>
            
            {/* 服务器图标 */}
            <Server className={cn("w-4 h-4 flex-shrink-0", styles.text)} />
            
            {/* 名称和副标题 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn("font-medium truncate", styles.text)}>
                  {displayName}
                </span>
                {originIcon}
              </div>
              <div className="text-xs text-theme-text-muted truncate">
                {subtitle}
              </div>
            </div>
            
            {/* 右侧操作区 */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* 终端数量标记 */}
              {terminals.length > 0 && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                  <Terminal className="w-3 h-3" />
                  <span className="text-xs">{terminals.length}</span>
                </div>
              )}
              
              {/* 进入箭头（有子节点时显示） */}
              {canEnter && (
                <ChevronRight 
                  className={cn(
                    "w-4 h-4 transition-transform",
                    "text-theme-text-muted group-hover:text-oxide-accent group-hover:translate-x-0.5"
                  )} 
                />
              )}
              
              {/* 快捷操作按钮 */}
              {!isConnected && !isConnecting && (
                <button
                  className="px-2 py-1 text-xs rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onConnect();
                  }}
                >
                  连接
                </button>
              )}
            </div>
          </div>
          
          {/* 终端列表（展开时显示） */}
          {isSelected && terminals.length > 0 && (
            <div className="mt-2 pt-2 border-t border-theme-border/30 space-y-1">
              {terminals.map((termId, idx) => (
                <div
                  key={termId}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors group/term",
                    activeTerminalId === termId 
                      ? "bg-blue-500/20 text-blue-300" 
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTerminal(termId);
                  }}
                >
                  <Terminal className="w-3 h-3" />
                  <span className="text-xs flex-1">Terminal #{idx + 1}</span>
                  <button
                    className="opacity-0 group-hover/term:opacity-100 p-0.5 rounded hover:bg-red-500/20 hover:text-red-400 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTerminal(termId);
                    }}
                    title="关闭终端"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* 状态标签 */}
          {(status === 'connecting' || status === 'link-down' || status === 'error') && (
            <div className={cn("text-xs mt-1", styles.text)}>
              {getStatusLabel(status)}
              {node.runtime.errorMessage && (
                <span className="text-red-400 ml-2">{node.runtime.errorMessage}</span>
              )}
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      
      {/* 右键菜单 */}
      <ContextMenuContent className="w-48">
        {/* 连接操作 */}
        {!isConnected && !isConnecting && (
          <ContextMenuItem onClick={onConnect}>
            <Plug className="w-4 h-4 mr-2" />
            连接
          </ContextMenuItem>
        )}
        {isConnected && (
          <>
            <ContextMenuItem onClick={onNewTerminal}>
              <Terminal className="w-4 h-4 mr-2" />
              新建终端
            </ContextMenuItem>
            <ContextMenuItem onClick={onOpenSftp}>
              <FolderOpen className="w-4 h-4 mr-2" />
              打开 SFTP
            </ContextMenuItem>
            {onOpenForwards && (
              <ContextMenuItem onClick={onOpenForwards}>
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                端口转发
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem onClick={onDrillDown}>
              <ArrowDownRight className="w-4 h-4 mr-2" />
              钻入连接
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={onDisconnect} className="text-red-400">
              <Unplug className="w-4 h-4 mr-2" />
              断开连接
            </ContextMenuItem>
          </>
        )}
        {(status === 'link-down' || status === 'error') && onReconnect && (
          <ContextMenuItem onClick={onReconnect}>
            <Plug className="w-4 h-4 mr-2" />
            重新连接
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onRemove} className="text-red-400">
          <Unplug className="w-4 h-4 mr-2" />
          移除节点
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const FocusedNodeList: React.FC<FocusedNodeListProps> = ({
  focusedNode,
  children,
  selectedNodeId,
  activeTerminalId,
  onSelect,
  onEnter,
  onConnect,
  onDisconnect,
  onReconnect,
  onNewTerminal,
  onSelectTerminal,
  onCloseTerminal,
  onOpenSftp,
  onOpenForwards,
  onDrillDown,
  onRemove,
}) => {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 当前位置标题 */}
      <div className="px-3 py-2 text-xs text-theme-text-muted uppercase tracking-wider border-b border-theme-border/30">
        {focusedNode ? (
          <span className="flex items-center gap-2">
            <span>📍</span>
            <span className="truncate">
              {focusedNode.displayName || `${focusedNode.username}@${focusedNode.host}`}
            </span>
            <span className="text-theme-text-muted/50">
              ({children.length} 个子节点)
            </span>
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <span>🏠</span>
            <span>全部服务器</span>
            <span className="text-theme-text-muted/50">
              ({children.length})
            </span>
          </span>
        )}
      </div>
      
      {/* 节点列表 */}
      <div className="flex-1 overflow-y-auto py-2">
        {children.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-theme-text-muted">
            <Server className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-sm">
              {focusedNode ? '此节点没有子节点' : '暂无服务器'}
            </span>
            <span className="text-xs mt-1 opacity-60">
              {focusedNode ? '可以通过钻入添加子节点' : '点击 + 添加新连接'}
            </span>
          </div>
        ) : (
          children.map(node => (
            <NodeItem
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id}
              activeTerminalId={activeTerminalId}
              onClick={() => onSelect(node.id)}
              onDoubleClick={() => onEnter(node.id)}
              onConnect={() => onConnect(node.id)}
              onDisconnect={() => onDisconnect(node.id)}
              onReconnect={onReconnect ? () => onReconnect(node.id) : undefined}
              onNewTerminal={() => onNewTerminal(node.id)}
              onSelectTerminal={onSelectTerminal}
              onCloseTerminal={(terminalId) => onCloseTerminal(node.id, terminalId)}
              onOpenSftp={() => onOpenSftp(node.id)}
              onOpenForwards={onOpenForwards ? () => onOpenForwards(node.id) : undefined}
              onDrillDown={() => onDrillDown(node.id)}
              onRemove={() => onRemove(node.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default FocusedNodeList;
