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
    <div className="p-0 border-b border-sidebar-border bg-mantle">
      <AnimatePresence mode="wait">
        {collapsed ? (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-2 py-2"
          >
           {/* ... existing toggle button code ... */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggle}
                  className="text-subtext-1 hover:text-text rounded-none"
                >
                  <ChevronRight size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Expand <kbd className="ml-1 text-xs">⌘B</kbd>
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
            {/* Hard-edge Search Bar */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={14} className="text-overlay-1 group-focus-within:text-primary transition-colors duration-fast" />
              </div>
              <input
                type="text"
                className="w-full bg-transparent border-none text-xs h-10 pl-9 pr-10 focus:ring-0 text-text placeholder:text-overlay-0 font-mono tracking-wide"
                placeholder="FIND_CONNECTION..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
               <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                 <kbd className="text-[9px] text-overlay-0 font-mono border border-overlay-0 px-1 rounded-sm">
                   ⌘K
                 </kbd>
              </div>
              {/* Bottom active line instead of ring */}
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-sidebar-border group-focus-within:bg-primary transition-colors duration-fast" />
            </div>
            
            {/* Header Actions Row */}
             <div className="flex items-center justify-between px-2 h-8 bg-surface-0/30 border-b border-sidebar-border">
                <span className="text-[10px] uppercase tracking-wider font-bold text-overlay-1 pl-2">Explorer</span>
                 <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onToggle}
                    className="text-overlay-1 hover:text-text hover:bg-transparent h-6 w-6 rounded-none"
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
      {/* Quick Actions - Removed primary button, replaced with subtle text action */}
      <div className="p-0 border-b border-sidebar-border/50">
        <button
          className="w-full flex items-center gap-3 px-4 py-3 text-xs font-mono text-primary hover:bg-primary-muted transition-colors duration-fast group text-left"
        >
          <span className="flex items-center justify-center w-4 h-4 border border-primary/50 text-white rounded-[1px] group-hover:bg-primary group-hover:text-black transition-all">
            <Plus size={10} strokeWidth={3} />
          </span>
          <span className="tracking-wide font-semibold">NEW_CONNECTION</span>
        </button>
      </div>

      {/* Connection Groups */}
      <div className="flex-1">
        {/* Recent Section - No padding to keep strict lines */}
        <SidebarSection icon={<Clock size={10} />} title="RECENT_LOGS">
          {/* Connection items will be rendered by parent */}
        </SidebarSection>

        {/* Saved Section */}
        <SidebarSection icon={<Folder size={10} />} title="SAVED_HOSTS" defaultOpen>
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
    <div className="mb-0 border-b border-sidebar-border/30 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-2 group',
          'hover:bg-surface-0/50 transition-colors'
        )}
      >
        <ChevronRight 
          size={14} 
          className={cn(
            "text-subtext-1 group-hover:text-text transition-transform duration-200",
            isOpen && "rotate-90"
          )} 
        />
        <span className="text-xs font-semibold text-subtext-0 group-hover:text-text">{title}</span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            // Use faster transition
            transition={{ duration: 0.1 }}
            className="overflow-hidden"
          >
            <div className="py-0">{children}</div>
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
    online: 'text-green-400',
    offline: 'text-overlay-1',
    connecting: 'text-yellow-400 animate-pulse',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-3 w-full px-3 py-1.5 text-left rounded-md mx-1 mb-0.5',
        'transition-colors duration-fast',
        isActive
          ? 'bg-surface2 text-white'
          : 'text-subtext-0 hover:bg-surface-0 hover:text-text'
      )}
    >
      <Server size={14} className={cn("shrink-0 transition-colors", isActive ? "text-white" : statusColors[status])} />
      
      <div className="flex-1 min-w-0">
        <div className={cn("text-sm font-sans font-medium truncate leading-tight")}>
            {name}
        </div>
        <div className={cn("text-xs font-mono truncate opacity-80", isActive ? "text-white/80" : "text-overlay-1")}>
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

function SidebarFooter({
  collapsed,
  onOpenSettings,
  onImportSSH,
}: SidebarFooterProps) {
  if (collapsed) {
    return null;
  }

  return (
    <div className="border-t border-sidebar-border bg-mantle">
       {/* Settings Row - Hard edged */}
       <div className="flex">
        <button
            onClick={onImportSSH}
            className="flex-1 flex items-center justify-center gap-2 py-3 border-r border-sidebar-border text-[10px] uppercase font-mono text-overlay-1 hover:text-text hover:bg-surface-0 transition-colors"
        >
            <Import size={10} />
            Import Config
        </button>
        <button
            onClick={onOpenSettings}
             className="w-12 flex items-center justify-center py-3 border-r border-sidebar-border text-overlay-1 hover:text-text hover:bg-surface-0 transition-colors"
        >
             <Settings size={12} />
        </button>
         <button
             className="w-12 flex items-center justify-center py-3 text-overlay-1 hover:text-text hover:bg-surface-0 transition-colors"
        >
             <User size={12} />
        </button>
       </div>
    </div>
  );
}

export { SidebarSection, SidebarHeader, SidebarFooter };
