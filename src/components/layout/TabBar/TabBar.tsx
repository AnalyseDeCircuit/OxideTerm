/**
 * TabBar Component (Warp-Inspired)
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
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          'flex items-center h-10 px-0 gap-0',
          'bg-mantle border-b border-glass-border',
          'shrink-0',
          className
        )}
      >
        {/* Tabs */}
        <div className="flex-1 flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-none pl-1">
          <Reorder.Group
            axis="x"
            values={tabs}
            onReorder={onTabsReorder || (() => {})}
            className="flex items-center gap-1"
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
        <div className="flex items-center gap-1 shrink-0 pl-2 border-l border-glass-border">
          {/* New Tab */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onNewTab}
                className="text-subtext-1 hover:text-text rounded-md"
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
                className="text-subtext-1 hover:text-text rounded-md"
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
                className="text-subtext-1 hover:text-text rounded-md"
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
      transition={{ duration: 0.15 }}
    >
      <div
        onClick={onSelect}
        onMouseDown={handleMouseDown}
        className={cn(
          'group relative flex items-center gap-2 px-4 py-2 cursor-pointer',
          'transition-all duration-200',
          'min-w-[140px] max-w-[220px]',
          'rounded-t-md', // Warp-style: rounded top corners only
          isActive
            ? 'bg-ui-surface-active text-text font-medium'
            : 'bg-transparent text-subtext-0 hover:bg-ui-surface-hover hover:text-text'
        )}
      >
        {/* Active Bottom Line Indicator - Warp style */}
        {isActive && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-purple-500 rounded-t-full" />
        )}

        {/* Status indicator - Circle (Warp style) */}
        <TabStatusDot status={tab.status} sftpActive={tab.sftpActive} />

        {/* Title */}
        <span className="flex-1 truncate text-xs font-medium tracking-wide">{tab.title}</span>

        {/* Close button - Only visible on hover or active */}
        <button
          onClick={handleClose}
          className={cn(
            'shrink-0 p-0.5',
            'opacity-0 group-hover:opacity-100',
            'hover:text-red transition-opacity duration-200',
            'rounded-md hover:bg-ui-surface-hover',
            isActive && 'opacity-100' // Always show close on active
          )}
        >
          <X size={12} strokeWidth={2} />
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
    disconnected: 'bg-subtext-1',
    error: 'bg-red',
  };

  return (
    <div className="flex gap-1">
      <span className={cn('w-2 h-2 rounded-full', colors[status])} />
       {/* SFTP indicator */}
      {sftpActive && status === 'connected' && (
        <span className="w-2 h-2 rounded-full bg-blue" />
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
