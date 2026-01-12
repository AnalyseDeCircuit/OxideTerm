/**
 * Sidebar Component (Redesigned)
 * 
 * Collapsible sidebar with connection list, search, and actions.
 * Supports both expanded (220px) and collapsed (48px) states.
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  Settings,
  ChevronLeft,
  ChevronRight,
  Clock,
  Folder,
  Server,
  Import,
  HelpCircle,
  User,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAppShell } from '../AppShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/Tooltip';
import { sidebarVariants } from '@/lib/animations';

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
        variants={sidebarVariants}
        animate={sidebarCollapsed ? 'collapsed' : 'expanded'}
        className={cn(
          'flex flex-col h-full shrink-0 overflow-hidden',
          'bg-sidebar-bg-solid border-r border-sidebar-border',
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
    <div className="p-2 border-b border-sidebar-border">
      <AnimatePresence mode="wait">
        {collapsed ? (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-2"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggle}
                  className="text-subtext-1 hover:text-text"
                >
                  <ChevronRight size={18} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Expand sidebar <kbd className="ml-1 text-xs">⌘B</kbd>
              </TooltipContent>
            </Tooltip>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            {/* Search Input */}
            <div className="relative">
              <Input
                variant="ghost"
                size="sm"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                leftIcon={<Search size={14} />}
                className="pr-12"
              />
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-overlay-0 bg-surface-0/50 px-1.5 py-0.5 rounded">
                ⌘K
              </kbd>
            </div>

            {/* Collapse Button */}
            <div className="flex justify-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onToggle}
                    className="text-overlay-1 hover:text-text"
                  >
                    <ChevronLeft size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Collapse sidebar <kbd className="ml-1 text-xs">⌘B</kbd>
                </TooltipContent>
              </Tooltip>
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
            className="text-mauve hover:bg-primary-muted"
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
          <Button variant="ghost" size="icon" className="text-subtext-1">
            <Clock size={18} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Recent connections</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="text-subtext-1">
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
            className="text-subtext-1"
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
      <div className="p-2">
        <Button
          variant="primary"
          size="sm"
          className="w-full justify-start gap-2"
        >
          <Plus size={14} />
          New Connection
        </Button>
      </div>

      {/* Connection Groups */}
      <div className="flex-1 px-2 py-1">
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

function SidebarSection({
  icon,
  title,
  defaultOpen = true,
  children,
}: SidebarSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 w-full px-2 py-1 text-[11px] font-medium uppercase tracking-wider',
          'text-overlay-1 hover:text-text transition-colors'
        )}
      >
        <motion.span
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-overlay-0"
        >
          <ChevronRight size={12} />
        </motion.span>
        {icon}
        {title}
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
    online: 'bg-green',
    offline: 'bg-overlay-0',
    connecting: 'bg-yellow animate-pulse',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-left',
        'transition-colors duration-fast',
        isActive
          ? 'bg-primary-muted text-text'
          : 'text-subtext-1 hover:bg-sidebar-hover hover:text-text'
      )}
    >
      <Server size={14} className="shrink-0 text-overlay-1" />
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{name}</div>
        <div className="text-xs text-overlay-0 truncate">{host}</div>
      </div>
      <span className={cn('w-2 h-2 rounded-full shrink-0', statusColors[status])} />
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

function SidebarFooter({
  collapsed,
  onOpenSettings,
  onImportSSH,
}: SidebarFooterProps) {
  if (collapsed) {
    return null;
  }

  return (
    <div className="p-2 border-t border-sidebar-border">
      {/* Import SSH Config */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onImportSSH}
        className="w-full justify-start gap-2 text-subtext-0 hover:text-text"
      >
        <Import size={14} />
        Import SSH Config
      </Button>

      {/* Bottom row with settings, user, help */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-sidebar-border">
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onOpenSettings}
                className="text-overlay-1 hover:text-text"
              >
                <Settings size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-overlay-1 hover:text-text"
              >
                <User size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Profile</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-overlay-1 hover:text-text"
              >
                <HelpCircle size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Help</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

export { SidebarSection, SidebarHeader, SidebarFooter };
