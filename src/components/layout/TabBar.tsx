import React from 'react';
import { X, Terminal, FolderOpen, GitFork, RefreshCw, XCircle, WifiOff } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { cn } from '../../lib/utils';

const TabIcon = ({ type }: { type: string }) => {
  const iconClass = "h-3.5 w-3.5 opacity-70";
  switch (type) {
    case 'terminal':
      return <Terminal className={iconClass} />;
    case 'sftp':
      return <FolderOpen className={iconClass} />;
    case 'forwards':
      return <GitFork className={iconClass} />;
    default:
      return null;
  }
};

// Format time remaining for reconnect
const formatTimeRemaining = (nextRetry: number): string => {
  const remaining = Math.max(0, nextRetry - Date.now());
  const seconds = Math.ceil(remaining / 1000);
  return `${seconds}s`;
};

export const TabBar = () => {
  const { tabs, activeTabId, setActiveTab, closeTab, reconnect, cancelReconnect, sessions, networkOnline } = useAppStore();
  const [reconnecting, setReconnecting] = React.useState<string | null>(null);
  // Force re-render for countdown
  const [, setTick] = React.useState(0);

  // Update countdown every second when there are reconnecting sessions
  React.useEffect(() => {
    const hasReconnecting = tabs.some((tab) => {
      const session = sessions.get(tab.sessionId);
      return session?.state === 'reconnecting' && session.reconnectNextRetry;
    });

    if (!hasReconnecting) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [tabs, sessions]);

  const handleReconnect = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setReconnecting(sessionId);
    try {
      await reconnect(sessionId);
    } finally {
      setReconnecting(null);
    }
  };

  const handleCancelReconnect = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    await cancelReconnect(sessionId);
  };

  return (
    <div className="flex items-center h-9 bg-theme-bg border-b border-theme-border overflow-x-auto no-scrollbar">
      {/* Network status indicator */}
      {!networkOnline && (
        <div className="flex items-center gap-1.5 px-3 h-full border-r border-theme-border bg-amber-900/30 text-amber-400 text-xs">
          <WifiOff className="h-3.5 w-3.5" />
          <span>Offline</span>
        </div>
      )}
      
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const isManualReconnecting = reconnecting === tab.sessionId;
        const session = sessions.get(tab.sessionId);
        const isAutoReconnecting = session?.state === 'reconnecting';
        const reconnectAttempt = session?.reconnectAttempt;
        const reconnectMax = session?.reconnectMaxAttempts;
        const reconnectNextRetry = session?.reconnectNextRetry;
        const showReconnectProgress = isAutoReconnecting && reconnectAttempt !== undefined;

        return (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "group flex items-center gap-2 px-3 h-full min-w-[120px] max-w-[240px] border-r border-theme-border cursor-pointer select-none text-sm transition-colors",
              isActive 
                ? "bg-theme-bg-panel text-oxide-text border-t-2 border-t-oxide-accent" 
                : "bg-theme-bg text-zinc-500 hover:bg-zinc-900 border-t-2 border-t-transparent",
              showReconnectProgress && "border-t-amber-500"
            )}
          >
            <TabIcon type={tab.type} />
            <span className="truncate flex-1">{tab.title}</span>
            
            {/* Reconnect progress indicator */}
            {showReconnectProgress && (
              <div className="flex items-center gap-1 text-xs text-amber-400">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>
                  {reconnectAttempt}/{reconnectMax}
                  {reconnectNextRetry && ` (${formatTimeRemaining(reconnectNextRetry)})`}
                </span>
                <button
                  onClick={(e) => handleCancelReconnect(e, tab.sessionId)}
                  className="hover:bg-zinc-700 rounded p-0.5"
                  title="Cancel reconnect"
                >
                  <XCircle className="h-3 w-3" />
                </button>
              </div>
            )}
            
            {/* Normal tab controls */}
            {!showReconnectProgress && (
              <div className="flex items-center gap-0.5">
                {/* Refresh button for terminal tabs */}
                {tab.type === 'terminal' && (
                  <button
                    onClick={(e) => handleReconnect(e, tab.sessionId)}
                    disabled={isManualReconnecting}
                    className={cn(
                      "opacity-0 group-hover:opacity-100 hover:bg-zinc-700 rounded p-0.5 transition-opacity",
                      isActive && "opacity-100",
                      isManualReconnecting && "opacity-100"
                    )}
                    title="Reconnect"
                  >
                    <RefreshCw className={cn("h-3 w-3", isManualReconnecting && "animate-spin")} />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={cn(
                    "opacity-0 group-hover:opacity-100 hover:bg-zinc-700 rounded p-0.5 transition-opacity",
                    isActive && "opacity-100"
                  )}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
