/**
 * TabBar Component (Redesigned)
 * 
 * Features:
 * - Modern compact design (VS Code / Warp style)
 * - Drag and drop reordering with smooth animations
 * - Visual state indicators with glowing effects
 * - Keyboard navigation support
 */

import { useState, useCallback } from 'react';
import { useTabs, useSessionStore } from '../store';
import type { TabConfig, SessionState } from '../types';
import { ConnectionHealthIndicator } from './ConnectionHealthIndicator';

interface TabBarProps {
  onNewTab?: () => void;
  onOpenSftp?: () => void;
  onOpenPortForwarding?: () => void;
}

export function TabBar({ onNewTab, onOpenSftp, onOpenPortForwarding }: TabBarProps) {
  const tabs = useTabs();
  const { setActiveTab, reorderTabs, disconnect } = useSessionStore();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    // Add drag image effect
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    
    if (fromIndex !== toIndex) {
      reorderTabs(fromIndex, toIndex);
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [reorderTabs]);

  const handleClose = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    disconnect(sessionId);
  }, [disconnect]);

  // Handle middle-click to close
  const handleMouseDown = useCallback((e: React.MouseEvent, sessionId: string) => {
    if (e.button === 1) {
      e.preventDefault();
      disconnect(sessionId);
    }
  }, [disconnect]);

  if (tabs.length === 0) return null;

  return (
    <div 
      className="flex items-center h-9 shrink-0 select-none"
      style={{ 
        background: 'var(--color-mantle)',
        borderBottom: '1px solid var(--color-surface-0)'
      }}
    >
      {/* Tabs Container */}
      <div className="flex items-center flex-1 overflow-x-auto scrollbar-none">
        {tabs.map((tab, index) => (
          <Tab
            key={tab.id}
            tab={tab}
            index={index}
            isDragging={draggedIndex === index}
            isDragOver={dragOverIndex === index && draggedIndex !== index}
            isFirst={index === 0}
            isLast={index === tabs.length - 1}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            onClick={() => setActiveTab(tab.id)}
            onClose={(e) => handleClose(e, tab.sessionId)}
            onMouseDown={(e) => handleMouseDown(e, tab.sessionId)}
          />
        ))}
      </div>
      
      {/* New Tab Button */}
      {onNewTab && (
        <button
          onClick={onNewTab}
          className="flex items-center justify-center w-8 h-8 mx-1 text-overlay-1 hover:text-text hover:bg-surface-0/50 rounded-md transition-colors"
          title="New Connection (⌘T)"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {/* Port Forwarding Button */}
      {onOpenPortForwarding && (
        <button
          onClick={onOpenPortForwarding}
          className="flex items-center justify-center w-8 h-8 mr-1 text-overlay-1 hover:text-mauve hover:bg-mauve/10 rounded-md transition-colors"
          title="Port Forwarding"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </button>
      )}

      {/* SFTP Button */}
      {onOpenSftp && (
        <button
          onClick={onOpenSftp}
          className="flex items-center justify-center w-8 h-8 mr-2 text-overlay-1 hover:text-teal hover:bg-teal/10 rounded-md transition-colors"
          title="File Manager (SFTP)"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </button>
      )}
    </div>
  );
}

interface TabProps {
  tab: TabConfig;
  index: number;
  isDragging: boolean;
  isDragOver: boolean;
  isFirst: boolean;
  isLast: boolean;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

function Tab({
  tab,
  index,
  isDragging,
  isDragOver,
  isFirst,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onClick,
  onClose,
  onMouseDown,
}: TabProps) {
  const session = useSessionStore(state => state.sessions.get(tab.sessionId));
  const state = session?.state ?? 'disconnected';
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      onDrop={(e) => onDrop(e, index)}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        group relative flex items-center gap-2 px-3 h-9
        min-w-[140px] max-w-[200px]
        cursor-pointer select-none
        transition-all duration-150
        ${tab.isActive 
          ? 'bg-base text-text' 
          : 'text-overlay-1 hover:text-subtext-1 hover:bg-surface-0/30'}
        ${isDragging ? 'opacity-50 scale-95' : ''}
        ${isDragOver ? 'bg-blue/10' : ''}
        ${isFirst ? 'ml-1' : ''}
      `}
      style={{
        borderBottom: tab.isActive ? '2px solid var(--color-blue)' : '2px solid transparent'
      }}
    >
      {/* Drag Over Indicator */}
      {isDragOver && (
        <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-blue rounded-full" />
      )}

      {/* State Indicator */}
      <StateIndicator state={state} color={tab.color} />
      
      {/* Health Indicator (only for connected sessions) */}
      {state === 'connected' && (
        <ConnectionHealthIndicator
          sessionId={tab.sessionId}
          size="sm"
          showDetails={false}
          className="mr-1"
        />
      )}
      
      {/* Title */}
      <span className="flex-1 truncate text-[13px] font-medium">
        {tab.title}
      </span>
      
      {/* Close Button */}
      <button
        onClick={onClose}
        className={`
          p-0.5 rounded transition-all
          ${isHovered || tab.isActive 
            ? 'opacity-100' 
            : 'opacity-0'}
          hover:bg-red/20 text-overlay-1 hover:text-red
        `}
        title="Close (⌘W)"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Active Tab Top Border Highlight */}
      {tab.isActive && (
        <div 
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, var(--color-blue), transparent)' }}
        />
      )}
    </div>
  );
}

interface StateIndicatorProps {
  state: SessionState;
  color: string;
}

function StateIndicator({ state, color }: StateIndicatorProps) {
  const getIndicatorStyle = () => {
    switch (state) {
      case 'connected':
        return {
          className: 'bg-green',
          glow: true,
          glowColor: 'var(--color-green)'
        };
      case 'connecting':
        return {
          className: 'bg-yellow animate-pulse',
          glow: false,
          glowColor: ''
        };
      case 'disconnecting':
        return {
          className: 'bg-peach animate-pulse',
          glow: false,
          glowColor: ''
        };
      case 'error':
        return {
          className: 'bg-red',
          glow: true,
          glowColor: 'var(--color-red)'
        };
      case 'disconnected':
      default:
        return {
          className: 'bg-overlay-0',
          glow: false,
          glowColor: ''
        };
    }
  };

  const style = getIndicatorStyle();

  return (
    <div 
      className={`w-2 h-2 rounded-full shrink-0 ${style.className}`}
      style={{ 
        boxShadow: style.glow ? `0 0 6px ${style.glowColor}` : undefined,
        backgroundColor: state === 'connected' ? color || undefined : undefined
      }}
      title={state.charAt(0).toUpperCase() + state.slice(1)}
    />
  );
}

export default TabBar;
