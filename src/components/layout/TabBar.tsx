import React from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { cn } from '../../lib/utils';

export const TabBar = () => {
  const { tabs, activeTabId, setActiveTab, closeTab } = useAppStore();

  return (
    <div className="flex items-center h-9 bg-oxide-bg border-b border-oxide-border overflow-x-auto no-scrollbar">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "group flex items-center gap-2 px-3 h-full min-w-[120px] max-w-[200px] border-r border-oxide-border cursor-pointer select-none text-sm transition-colors",
              isActive 
                ? "bg-oxide-panel text-oxide-text border-t-2 border-t-oxide-accent" 
                : "bg-oxide-bg text-zinc-500 hover:bg-zinc-900 border-t-2 border-t-transparent"
            )}
          >
            {tab.icon && <span className="text-xs opacity-70">{tab.icon}</span>}
            <span className="truncate flex-1">{tab.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className={cn(
                "opacity-0 group-hover:opacity-100 hover:bg-zinc-700 rounded p-0.5 transition-opacity",
                isActive && "opacity-100" // Always show close on active
              )}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
