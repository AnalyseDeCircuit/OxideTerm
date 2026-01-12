/**
 * TabBar Component (Redesigned)
 * 
 * Horizontal tab bar with session tabs, status indicators,
 * and action buttons. Supports drag-and-drop reordering.
 * 
 * Tab Status:
 * ● Green - Connected & healthy
 * ○ Yellow - High latency / connecting
 * ○ Gray - Disconnected
 */

import * as React from 'react';
import { AnimatePresence, Reorder } from 'framer-motion';
import {
  X,
  Plus,
  Settings,
  Network,
  Terminal,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/Tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';

export interface TabItem {
  id: string;
  title: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  hasActivity?: boolean;
  sftpActive?: boolean;
}

interface TabBarProps {
  tabs: TabItem[];
  activeTabId: string | null;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabsReorder?: (tabs: TabItem[]) => void;
  onNewTab?: () => void;
  onOpenSettings?: () => void;
  onOpenPortForwarding?: () => void;
  className?: string;
}

export function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabsReorder,
  onNewTab,
  onOpenSettings,
  onOpenPortForwarding,
  className,
}: TabBarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'flex items-center h-9 px-2 gap-1',
          'bg-tab-bg border-b border-tab-border',
          'shrink-0',
          className
        )}
      >
        {/* Tabs */}
        <div className="flex-1 flex items-center gap-0.5 min-w-0 overflow-x-auto scrollbar-none">
          <Reorder.Group
            axis="x"
            values={tabs}
            onReorder={onTabsReorder || (() => {})}
            className="flex items-center gap-0.5"
          >
            <AnimatePresence initial={false}>
              {tabs.map((tab) => (
                <Tab
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  onSelect={() => onTabSelect(tab.id)}
                  onClose={() => onTabClose(tab.id)}
                />
              ))}
            </AnimatePresence>
          </Reorder.Group>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0 pl-2 border-l border-surface-0">
          {/* New Tab */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onNewTab}
                className="text-subtext-1 hover:text-text"
              >
                <Plus size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              New connection <kbd className="ml-1">⌘T</kbd>
            </TooltipContent>
          </Tooltip>

          {/* Port Forwarding */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onOpenPortForwarding}
                className="text-subtext-1 hover:text-text"
              >
                <Network size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Port forwarding</TooltipContent>
          </Tooltip>

          {/* Settings */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onOpenSettings}
                className="text-subtext-1 hover:text-text"
              >
                <Settings size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Settings <kbd className="ml-1">⌘,</kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ============================================
// Individual Tab
// ============================================

interface TabProps {
  tab: TabItem;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

function Tab({ tab, isActive, onSelect, onClose }: TabProps) {
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  // Middle click to close
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <Reorder.Item
      value={tab}
      id={tab.id}
      initial={{ opacity: 0, width: 0 }}
      animate={{ opacity: 1, width: 'auto' }}
      exit={{ opacity: 0, width: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        onClick={onSelect}
        onMouseDown={handleMouseDown}
        className={cn(
          'group flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-pointer',
          'transition-colors duration-fast',
          'max-w-[180px] min-w-[100px]',
          isActive
            ? 'bg-tab-active text-text'
            : 'text-subtext-1 hover:bg-tab-hover hover:text-text'
        )}
      >
        {/* Status indicator */}
        <TabStatusDot status={tab.status} sftpActive={tab.sftpActive} />

        {/* Tab icon */}
        <Terminal size={12} className="shrink-0 text-overlay-1" />

        {/* Title */}
        <span className="flex-1 truncate text-xs font-medium">{tab.title}</span>

        {/* Close button */}
        <button
          onClick={handleClose}
          className={cn(
            'shrink-0 p-0.5 rounded-sm',
            'opacity-0 group-hover:opacity-100',
            'hover:bg-surface-1 transition-opacity',
            isActive && 'opacity-60'
          )}
        >
          <X size={12} />
        </button>
      </div>
    </Reorder.Item>
  );
}

// ============================================
// Status Indicator
// ============================================

interface TabStatusDotProps {
  status: TabItem['status'];
  sftpActive?: boolean;
}

function TabStatusDot({ status, sftpActive }: TabStatusDotProps) {
  const colors = {
    connected: 'bg-green',
    connecting: 'bg-yellow animate-pulse',
    disconnected: 'bg-overlay-0',
    error: 'bg-red',
  };

  return (
    <div className="relative shrink-0">
      <span className={cn('block w-1.5 h-1.5 rounded-full', colors[status])} />
      {/* SFTP indicator (second dot) */}
      {sftpActive && status === 'connected' && (
        <span className="absolute -right-1 -top-0.5 w-1 h-1 rounded-full bg-green" />
      )}
    </div>
  );
}

// ============================================
// Tab Context Menu
// ============================================

interface TabContextMenuProps {
  children: React.ReactNode;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseAll: () => void;
  onDuplicate: () => void;
}

export function TabContextMenu({
  children,
  onClose,
  onCloseOthers,
  onCloseAll,
  onDuplicate,
}: TabContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={onDuplicate}>
          Duplicate Session
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onClose}>Close</DropdownMenuItem>
        <DropdownMenuItem onClick={onCloseOthers}>Close Others</DropdownMenuItem>
        <DropdownMenuItem onClick={onCloseAll}>Close All</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
