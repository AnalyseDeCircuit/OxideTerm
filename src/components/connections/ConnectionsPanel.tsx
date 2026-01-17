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

// Format connection state
const formatState = (state: SshConnectionState): { text: string; color: string } => {
  if (typeof state === 'object' && 'error' in state) {
    return { text: `Error: ${state.error}`, color: 'text-red-400' };
  }
  switch (state) {
    case 'connecting':
      return { text: 'Connecting...', color: 'text-yellow-400' };
    case 'active':
      return { text: 'Active', color: 'text-green-400' };
    case 'idle':
      return { text: 'Idle', color: 'text-amber-400' };
    case 'disconnecting':
      return { text: 'Disconnecting...', color: 'text-orange-400' };
    case 'disconnected':
      return { text: 'Disconnected', color: 'text-zinc-500' };
    default:
      return { text: String(state), color: 'text-zinc-400' };
  }
};

// Format time
const formatTime = (isoString: string): string => {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} mins ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hrs ago`;
  return date.toLocaleDateString();
};

// Single Connection Card
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
      {/* Header: Host Info and State */}
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
        
        {/* Keep Alive Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onToggleKeepAlive(connection.id, !connection.keepAlive)}
          title={connection.keepAlive ? "Disable Keep Alive (Disconnect after 30m idle)" : "Enable Keep Alive (Never disconnect)"}
        >
          {connection.keepAlive ? (
            <Shield className="h-4 w-4 text-green-400" />
          ) : (
            <ShieldOff className="h-4 w-4 text-zinc-500" />
          )}
        </Button>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-xs text-zinc-400">
        <div className="flex items-center gap-1">
          <Terminal className="h-3 w-3" />
          <span>{connection.terminalIds.length} Terminals</span>
        </div>
        <div className="flex items-center gap-1">
          <FolderOpen className="h-3 w-3" />
          <span>{connection.sftpSessionId ? '1' : '0'} SFTP</span>
        </div>
        <div className="flex items-center gap-1">
          <GitFork className="h-3 w-3" />
          <span>{connection.forwardIds.length} Forwards</span>
        </div>
      </div>
      
      {/* Time Info */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>Created: {formatTime(connection.createdAt)}</span>
        </div>
        {isIdle && (
          <span className="text-amber-400">
            Idle - {connection.keepAlive ? 'Keep Alive' : 'Disconnect in 30m'}
          </span>
        )}
      </div>
    </div>
  );
};

// Connection Management Panel Main Component
export const ConnectionsPanel: React.FC = () => {
  const { 
    connections, 
    refreshConnections, 
    setConnectionKeepAlive
  } = useAppStore();
  
  const [loading, setLoading] = React.useState(false);
  
  // Load connection list
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
  
  return (
    <div className="h-full flex flex-col bg-theme-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-theme-border bg-theme-bg-panel/50">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100">Connection Pool</h2>
          <p className="text-sm text-zinc-500 mt-1">Manage active SSH connections and keep-alive settings</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>
      
      {/* Connection List */}
      <div className="flex-1 overflow-y-auto p-6">
        {connectionList.length === 0 ? (
          <div className="text-center text-zinc-500 py-16">
            <Server className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No active SSH connections</p>
            <p className="text-sm mt-2 opacity-70">New connections will appear here</p>
          </div>
        ) : (
          <div className="grid gap-4 max-w-4xl">
            {connectionList.map(conn => (
              <ConnectionCard
                key={conn.id}
                connection={conn}
                onToggleKeepAlive={handleToggleKeepAlive}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Footer Legend */}
      <div className="px-6 py-4 border-t border-theme-border bg-theme-bg-panel/30 flex items-center gap-6 text-sm text-zinc-500">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-green-400" />
          <span>Keep Alive: Never auto-disconnect</span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldOff className="h-4 w-4 text-zinc-500" />
          <span>Standard: Auto-disconnect after 30 mins idle</span>
        </div>
      </div>
    </div>
  );
};
