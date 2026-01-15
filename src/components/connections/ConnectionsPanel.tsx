import React, { useEffect } from 'react';
import { 
  Server, 
  Terminal, 
  FolderOpen, 
  GitFork, 
  RefreshCw, 
  Clock,
  Shield,
  ShieldOff
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { SshConnectionInfo, SshConnectionState } from '../../types';

// 格式化连接状态
const formatState = (state: SshConnectionState): { text: string; color: string } => {
  if (typeof state === 'object' && 'error' in state) {
    return { text: `错误: ${state.error}`, color: 'text-red-400' };
  }
  switch (state) {
    case 'connecting':
      return { text: '连接中...', color: 'text-yellow-400' };
    case 'active':
      return { text: '活跃', color: 'text-green-400' };
    case 'idle':
      return { text: '空闲', color: 'text-amber-400' };
    case 'disconnecting':
      return { text: '断开中...', color: 'text-orange-400' };
    case 'disconnected':
      return { text: '已断开', color: 'text-zinc-500' };
    default:
      return { text: String(state), color: 'text-zinc-400' };
  }
};

// 格式化时间
const formatTime = (isoString: string): string => {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  return date.toLocaleDateString();
};

// 单个连接卡片
const ConnectionCard: React.FC<{
  connection: SshConnectionInfo;
  onToggleKeepAlive: (connectionId: string, keepAlive: boolean) => void;
}> = ({ connection, onToggleKeepAlive }) => {
  const { text: stateText, color: stateColor } = formatState(connection.state);
  const isIdle = connection.state === 'idle';
  const isActive = connection.state === 'active';
  
  return (
    <div className={cn(
      "border border-theme-border rounded-lg p-4 space-y-3",
      "bg-theme-bg-panel hover:border-zinc-600 transition-colors",
      isIdle && "border-amber-500/30"
    )}>
      {/* 头部：主机信息和状态 */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Server className={cn("h-5 w-5", isActive ? "text-green-400" : isIdle ? "text-amber-400" : "text-zinc-500")} />
          <div>
            <div className="font-medium text-sm">
              {connection.username}@{connection.host}:{connection.port}
            </div>
            <div className={cn("text-xs", stateColor)}>
              {stateText}
            </div>
          </div>
        </div>
        
        {/* Keep Alive 按钮 */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onToggleKeepAlive(connection.id, !connection.keepAlive)}
          title={connection.keepAlive ? "关闭保活 (30分钟空闲后断开)" : "启用保活 (永不自动断开)"}
        >
          {connection.keepAlive ? (
            <Shield className="h-4 w-4 text-green-400" />
          ) : (
            <ShieldOff className="h-4 w-4 text-zinc-500" />
          )}
        </Button>
      </div>
      
      {/* 统计信息 */}
      <div className="grid grid-cols-3 gap-2 text-xs text-zinc-400">
        <div className="flex items-center gap-1">
          <Terminal className="h-3 w-3" />
          <span>{connection.terminalIds.length} 终端</span>
        </div>
        <div className="flex items-center gap-1">
          <FolderOpen className="h-3 w-3" />
          <span>{connection.sftpSessionId ? '1' : '0'} SFTP</span>
        </div>
        <div className="flex items-center gap-1">
          <GitFork className="h-3 w-3" />
          <span>{connection.forwardIds.length} 转发</span>
        </div>
      </div>
      
      {/* 时间信息 */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>创建: {formatTime(connection.createdAt)}</span>
        </div>
        {isIdle && (
          <span className="text-amber-400">
            空闲中 - {connection.keepAlive ? '保活' : '30分钟后断开'}
          </span>
        )}
      </div>
    </div>
  );
};

// 连接管理面板主组件
export const ConnectionsPanel: React.FC = () => {
  const { 
    connections, 
    refreshConnections, 
    setConnectionKeepAlive
  } = useAppStore();
  
  const [loading, setLoading] = React.useState(false);
  
  // 加载连接列表
  useEffect(() => {
    refreshConnections();
  }, [refreshConnections]);
  
  const handleRefresh = async () => {
    setLoading(true);
    try {
      await refreshConnections();
    } finally {
      setLoading(false);
    }
  };
  
  const handleToggleKeepAlive = async (connectionId: string, keepAlive: boolean) => {
    try {
      await setConnectionKeepAlive(connectionId, keepAlive);
    } catch (error) {
      console.error('Failed to set keep alive:', error);
    }
  };
  
  const connectionList = Array.from(connections.values())
    .filter(conn => conn.state !== 'disconnected');
  
  const activeCount = connectionList.filter(c => c.state === 'active').length;
  const idleCount = connectionList.filter(c => c.state === 'idle').length;
  
  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-theme-border">
        <div>
          <h2 className="text-lg font-semibold">SSH 连接池</h2>
          <p className="text-xs text-zinc-500">
            {activeCount} 活跃 · {idleCount} 空闲
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>
      
      {/* 连接列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {connectionList.length === 0 ? (
          <div className="text-center text-zinc-500 py-8">
            <Server className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>没有活跃的 SSH 连接</p>
            <p className="text-xs mt-1">创建新连接后会在这里显示</p>
          </div>
        ) : (
          connectionList.map(conn => (
            <ConnectionCard
              key={conn.id}
              connection={conn}
              onToggleKeepAlive={handleToggleKeepAlive}
            />
          ))
        )}
      </div>
      
      {/* 底部说明 */}
      <div className="p-3 border-t border-theme-border bg-theme-bg text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-green-400" />
          <span>保活：连接将永远保持</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <ShieldOff className="h-3.5 w-3.5 text-zinc-500" />
          <span>非保活：空闲 30 分钟后自动断开</span>
        </div>
      </div>
    </div>
  );
};
