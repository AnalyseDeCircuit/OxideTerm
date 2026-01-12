/**
 * Sidebar Component (Warp-Inspired)
 *
 * Collapsible sidebar with connection list, search, and actions.
 * Features:
 * - Normal title case (no uppercase)
 * - Smooth rounded corners
 * - Subtle hover states
 * - Clean spacing
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Folder,
  Server,
  Import,
  Settings,
  User,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAppShell } from './AppShell';
import { Button } from '@/components/ui/Button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/Tooltip';

interface SidebarProps {
  onNewConnection?: () => void;
  onOpenSettings?: () => void;
  onImportSSH?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function Sidebar({
  onNewConnection,
  onOpenSettings,
  onImportSSH,
  className,
  children,
}: SidebarProps) {
  const { sidebarCollapsed, toggleSidebar } = useAppShell();
  const [searchQuery, setSearchQuery] = React.useState('');

  return (
    <TooltipProvider delayDuration={200}>
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 64 : 240 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          'flex flex-col h-full shrink-0 overflow-hidden',
          'bg-sidebar-bg-solid border-r border-glass-border',
          className
        )}
      >
        {/* Header with Search */}
        <SidebarHeader
          collapsed={sidebarCollapsed}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onToggle={toggleSidebar}
        />

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
          {sidebarCollapsed ? (
            <CollapsedNav
              onNewConnection={onNewConnection}
              onOpenSettings={onOpenSettings}
            />
          ) : (
            <ExpandedContent searchQuery={searchQuery}>
              {children}
            </ExpandedContent>
          )}
        </div>

        {/* Footer Actions */}
        <SidebarFooter
          collapsed={sidebarCollapsed}
          onOpenSettings={onOpenSettings}
          onImportSSH={onImportSSH}
        />
      </motion.aside>
    </TooltipProvider>
  );
}

// ============================================
// Sidebar Header
// ============================================

interface SidebarHeaderProps {
  collapsed: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onToggle: () => void;
}

function SidebarHeader({
  collapsed,
  searchQuery,
  onSearchChange,
  onToggle,
}: SidebarHeaderProps) {
  return (
    <div className="p-0 border-b border-glass-border bg-mantle">
      <AnimatePresence mode="wait">
        {collapsed ? (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-2 py-2"
          >
            {/* Toggle button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggle}
                  className="text-subtext-1 hover:text-text rounded-lg"
                >
                  <ChevronRight size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Expand <kbd className="ml-1">⌘B</kbd>
              </TooltipContent>
            </Tooltip>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col"
          >
            {/* Search Bar - Warp style */}
            <div className="relative group px-2 py-3">
              <div className="relative flex items-center">
                <Search
                  size={14}
                  className="absolute left-3 text-subtext-1 group-focus-within:text-purple-500 transition-colors duration-200"
                />
                <input
                  type="text"
                  className={cn(
                    'w-full bg-ui-surface-bg border border-glass-border rounded-lg text-xs h-9 pl-9 pr-9',
                    'focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20',
                    'text-text placeholder:text-subtext-1 font-sans'
                  )}
                  placeholder="Search connections..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
                <div className="absolute right-3 flex items-center pointer-events-none">
                  <kbd className="text-[9px] text-subtext-1 bg-surface-0 border border-glass-border rounded-md px-1.5 py-0.5">
                    ⌘K
                  </kbd>
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center justify-between px-3 py-2 bg-ui-surface-bg border-b border-glass-border/50">
              <span className="text-xs font-medium text-subtext-0">
                Connections
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onToggle}
                className="text-subtext-1 hover:text-text hover:bg-transparent h-7 w-7 rounded-md"
              >
                <ChevronLeft size={12} />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Collapsed Navigation
// ============================================

interface CollapsedNavProps {
  onNewConnection?: () => void;
  onOpenSettings?: () => void;
}

function CollapsedNav({ onNewConnection, onOpenSettings }: CollapsedNavProps) {
  return (
    <div className="flex flex-col items-center py-2 gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNewConnection}
            className="text-purple-500 hover:bg-purple-500/10 rounded-lg"
          >
            <Plus size={18} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          New connection <kbd className="ml-1 text-xs">⌘N</kbd>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="text-subtext-1 hover:text-text hover:bg-ui-surface-hover rounded-lg">
            <Clock size={18} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Recent connections</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="text-subtext-1 hover:text-text hover:bg-ui-surface-hover rounded-lg">
            <Folder size={18} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Saved connections</TooltipContent>
      </Tooltip>

      <div className="flex-1" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSettings}
            className="text-subtext-1 hover:text-text hover:bg-ui-surface-hover rounded-lg"
          >
            <Settings size={18} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          Settings <kbd className="ml-1 text-xs">⌘,</kbd>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// ============================================
// Expanded Content
// ============================================

interface ExpandedContentProps {
  searchQuery: string;
  children?: React.ReactNode;
}

function ExpandedContent({ searchQuery: _searchQuery, children }: ExpandedContentProps) {
  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-thin">
      {/* Quick Actions */}
      <div className="p-2 border-b border-glass-border/50">
        <button
          onClick={() => {}}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 text-xs font-sans text-purple-500 rounded-lg',
            'hover:bg-purple-500/10 transition-colors duration-200 group'
          )}
        >
          <span className="flex items-center justify-center w-5 h-5 bg-purple-500/20 text-purple-500 rounded-md group-hover:bg-purple-500/30 transition-all">
            <Plus size={10} strokeWidth={3} />
          </span>
          <span className="font-medium">New Connection</span>
        </button>
      </div>

      {/* Connection Groups */}
      <div className="flex-1">
        {/* Recent Section */}
        <SidebarSection icon={<Clock size={12} />} title="Recent">
          {/* Connection items will be rendered by parent */}
        </SidebarSection>

        {/* Saved Section */}
        <SidebarSection icon={<Folder size={12} />} title="Saved" defaultOpen>
          {children}
        </SidebarSection>
      </div>
    </div>
  );
}

// ============================================
// Sidebar Section
// ============================================

interface SidebarSectionProps {
  icon?: React.ReactNode;
  title: string;
  defaultOpen?: boolean;
  children?: React.ReactNode;
}

export function SidebarSection({
  icon,
  title,
  defaultOpen = true,
  children,
}: SidebarSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className="mb-0 border-b border-glass-border/30 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-2.5 rounded-lg',
          'hover:bg-ui-surface-hover transition-colors duration-200'
        )}
      >
        <ChevronRight
          size={14}
          className={cn(
            "text-subtext-0 hover:text-text transition-transform duration-200",
            isOpen && "rotate-90"
          )}
        />
        {icon && <span className="text-subtext-0">{icon}</span>}
        <span className="text-xs font-medium text-subtext-0 hover:text-text">{title}</span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="py-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Connection Item
// ============================================

interface ConnectionItemProps {
  name: string;
  host: string;
  status?: 'online' | 'offline' | 'connecting';
  isActive?: boolean;
  onClick?: () => void;
}

export function ConnectionItem({
  name,
  host,
  status = 'offline',
  isActive = false,
  onClick,
}: ConnectionItemProps) {
  const statusColors = {
    online: 'text-green',
    offline: 'text-subtext-1',
    connecting: 'text-yellow animate-pulse',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-3 w-full px-3 py-2 text-left rounded-lg mx-1 mb-0.5',
        'transition-all duration-200',
        isActive
          ? 'bg-ui-surface-active text-white'
          : 'text-subtext-0 hover:bg-ui-surface-hover hover:text-text'
      )}
    >
      <Server size={14} className={cn("shrink-0 transition-colors", isActive ? "text-white" : statusColors[status])} />

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium font-sans truncate leading-tight">
          {name}
        </div>
        <div className="text-xs font-mono truncate opacity-70">
          {host}
        </div>
      </div>
    </button>
  );
}

// ============================================
// Sidebar Footer
// ============================================

interface SidebarFooterProps {
  collapsed: boolean;
  onOpenSettings?: () => void;
  onImportSSH?: () => void;
}

export function SidebarFooter({
  collapsed,
  onOpenSettings,
  onImportSSH,
}: SidebarFooterProps) {
  if (collapsed) {
    return null;
  }

  return (
    <div className="border-t border-glass-border bg-mantle">
      {/* Settings Row */}
      <div className="flex">
        <button
          onClick={onImportSSH}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 border-r border-glass-border',
            'text-xs font-medium text-subtext-1',
            'hover:text-text hover:bg-ui-surface-hover transition-colors rounded-bl-lg'
          )}
        >
          <Import size={12} />
          Import
        </button>
        <button
          onClick={onOpenSettings}
          className={cn(
            'w-12 flex items-center justify-center py-3 border-r border-glass-border',
            'text-subtext-1 hover:text-text hover:bg-ui-surface-hover transition-colors rounded-br-lg'
          )}
        >
          <Settings size={12} />
        </button>
        <button
          className={cn(
            'w-12 flex items-center justify-center py-3',
            'text-subtext-1 hover:text-text hover:bg-ui-surface-hover transition-colors rounded-tr-lg'
          )}
        >
          <User size={12} />
        </button>
      </div>
    </div>
  );
}

// Export types
export type { SidebarHeaderProps, CollapsedNavProps, ExpandedContentProps, SidebarSectionProps, ConnectionItemProps, SidebarFooterProps };
