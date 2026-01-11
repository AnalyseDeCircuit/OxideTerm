/**
 * TabBar Component
 * 
 * Features:
 * - Drag and drop reordering
 * - Visual state indicators
 * - Close button with confirmation
 * - Color-coded tabs based on host
 */

import { useState, useCallback } from 'react';
import { useTabs, useSessionStore } from '../store';
import type { TabConfig, SessionState } from '../types';

interface TabBarProps {
  onNewTab?: () => void;
}

export function TabBar({ onNewTab }: TabBarProps) {
  const tabs = useTabs();
  const { setActiveTab, reorderTabs, disconnect } = useSessionStore();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
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

  return (
    <div className="flex items-center bg-gray-900 border-b border-gray-800 h-9 px-1">
      <div className="flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700">
        {tabs.map((tab, index) => (
          <Tab
            key={tab.id}
            tab={tab}
            index={index}
            isDragging={draggedIndex === index}
            isDragOver={dragOverIndex === index}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            onClick={() => setActiveTab(tab.id)}
            onClose={(e) => handleClose(e, tab.sessionId)}
          />
        ))}
      </div>
      
      {/* New Tab Button */}
      {onNewTab && (
        <button
          onClick={onNewTab}
          className="flex items-center justify-center w-7 h-7 ml-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          title="New Connection (Cmd+T)"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
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
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
}

function Tab({
  tab,
  index,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onClick,
  onClose,
}: TabProps) {
  const session = useSessionStore(state => state.sessions.get(tab.sessionId));
  const state = session?.state ?? 'disconnected';

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      onDrop={(e) => onDrop(e, index)}
      onClick={onClick}
      className={`
        group flex items-center gap-2 px-3 h-8 min-w-[120px] max-w-[200px]
        border-r border-gray-800 cursor-pointer select-none
        transition-all duration-150
        ${tab.isActive 
          ? 'bg-gray-800 text-white' 
          : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-gray-200'}
        ${isDragging ? 'opacity-50' : ''}
        ${isDragOver ? 'border-l-2 border-l-blue-500' : ''}
      `}
    >
      {/* State Indicator */}
      <StateIndicator state={state} color={tab.color} />
      
      {/* Title */}
      <span className="flex-1 truncate text-sm">
        {tab.title}
      </span>
      
      {/* Close Button */}
      <button
        onClick={onClose}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-600 transition-opacity"
        title="Close (Cmd+W)"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

interface StateIndicatorProps {
  state: SessionState;
  color: string;
}

function StateIndicator({ state, color }: StateIndicatorProps) {
  const getIndicatorClass = () => {
    switch (state) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500 animate-pulse';
      case 'disconnecting':
        return 'bg-orange-500 animate-pulse';
      case 'error':
        return 'bg-red-500';
      case 'disconnected':
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div 
      className={`w-2 h-2 rounded-full ${getIndicatorClass()}`}
      style={{ boxShadow: state === 'connected' ? `0 0 4px ${color}` : undefined }}
      title={state}
    />
  );
}

export default TabBar;
