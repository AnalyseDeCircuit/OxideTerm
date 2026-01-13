import React from 'react';
import { X, Terminal, FolderOpen, GitFork, RefreshCw } from 'lucide-react';
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

export const TabBar = () => {
  const { tabs, activeTabId, setActiveTab, closeTab, reconnect } = useAppStore();
  const [reconnecting, setReconnecting] = React.useState<string | null>(null);

  const handleReconnect = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setReconnecting(sessionId);
    try {
      await reconnect(sessionId);
    } finally {
      setReconnecting(null);
    }
  };

  return (
    <div className="flex items-center h-9 bg-theme-bg border-b border-theme-border overflow-x-auto no-scrollbar">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const isReconnecting = reconnecting === tab.sessionId;
        return (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "group flex items-center gap-2 px-3 h-full min-w-[120px] max-w-[200px] border-r border-theme-border cursor-pointer select-none text-sm transition-colors",
              isActive 
                ? "bg-theme-bg-panel text-oxide-text border-t-2 border-t-oxide-accent" 
                : "bg-theme-bg text-zinc-500 hover:bg-zinc-900 border-t-2 border-t-transparent"
            )}
          >
            <TabIcon type={tab.type} />
            <span className="truncate flex-1">{tab.title}</span>
            <div className="flex items-center gap-0.5">
              {/* Refresh button for terminal tabs */}
              {tab.type === 'terminal' && (
                <button
                  onClick={(e) => handleReconnect(e, tab.sessionId)}
                  disabled={isReconnecting}
                  className={cn(
                    "opacity-0 group-hover:opacity-100 hover:bg-zinc-700 rounded p-0.5 transition-opacity",
                    isActive && "opacity-100",
                    isReconnecting && "opacity-100"
                  )}
                  title="Reconnect"
                >
                  <RefreshCw className={cn("h-3 w-3", isReconnecting && "animate-spin")} />
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
          </div>
        );
      })}
    </div>
  );
};
