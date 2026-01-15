import React, { useRef, useEffect, useState } from 'react';
import { X, Terminal, FolderOpen, GitFork, RefreshCw, XCircle, WifiOff, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const { 
    tabs, 
    activeTabId, 
    setActiveTab, 
    closeTab, 
    closeTerminalSession,
    reconnect, 
    cancelReconnect, 
    sessions, 
    networkOnline 
  } = useAppStore();
  const [reconnecting, setReconnecting] = React.useState<string | null>(null);
  const [closing, setClosing] = React.useState<string | null>(null);
  // Force re-render for countdown
  const [, setTick] = React.useState(0);
  
  // Scroll state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  
  // Check scroll state
  const updateScrollState = () => {
    const container = scrollContainerRef.current;
    if (container) {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(
        container.scrollLeft < container.scrollWidth - container.clientWidth - 1
      );
    }
  };
  
  useEffect(() => {
    updateScrollState();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollState);
      window.addEventListener('resize', updateScrollState);
      return () => {
        container.removeEventListener('scroll', updateScrollState);
        window.removeEventListener('resize', updateScrollState);
      };
    }
  }, [tabs]);
  
  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollAmount = 200;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

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

  // 关闭 Tab 时释放后端资源
  const handleCloseTab = async (e: React.MouseEvent, tabId: string, sessionId: string, tabType: string) => {
    e.stopPropagation();
    
    // 如果是终端 Tab，尝试调用新的 closeTerminalSession
    if (tabType === 'terminal') {
      setClosing(sessionId);
      try {
        // 检查 session 是否使用新的连接池架构
        const session = sessions.get(sessionId);
        if (session?.connectionId) {
          // 使用新 API 释放终端（会减少连接引用计数）
          await closeTerminalSession(sessionId);
        }
      } catch (error) {
        console.error('Failed to close terminal session:', error);
      } finally {
        setClosing(null);
      }
    }
    
    // 总是移除 Tab（即使后端调用失败）
    closeTab(tabId);
  };

  return (
    <div className="flex items-center h-9 bg-theme-bg border-b border-theme-border">
      {/* Left scroll button */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="flex-shrink-0 h-full px-1 hover:bg-zinc-800 border-r border-theme-border"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      
      {/* Network status indicator */}
      {!networkOnline && (
        <div className="flex-shrink-0 flex items-center gap-1.5 px-3 h-full border-r border-theme-border bg-amber-900/30 text-amber-400 text-xs">
          <WifiOff className="h-3.5 w-3.5" />
          <span>Offline</span>
        </div>
      )}
      
      {/* Scrollable tabs container */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 flex items-center overflow-x-auto no-scrollbar"
      >
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
                  onClick={(e) => handleCloseTab(e, tab.id, tab.sessionId, tab.type)}
                  disabled={closing === tab.sessionId}
                  className={cn(
                    "opacity-0 group-hover:opacity-100 hover:bg-zinc-700 rounded p-0.5 transition-opacity",
                    isActive && "opacity-100",
                    closing === tab.sessionId && "opacity-100"
                  )}
                  title="Close tab"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        );
      })}
      </div>
      
      {/* Right scroll button */}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="flex-shrink-0 h-full px-1 hover:bg-zinc-800 border-l border-theme-border"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
