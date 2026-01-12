/**
 * CommandPalette Component (Warp-Inspired)
 *
 * Global command launcher (⌘K) for quick access to all app functionality.
 * Features:
 * - Glassmorphism
 * - Smooth animations
 * - Rounded corners
 * - Subtle shadows
 */

import * as React from 'react';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Settings,
  FolderOpen,
  Network,
  Palette,
  Terminal,
  Search,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAppShell } from '../AppShell';
import { commandPaletteVariants, modalBackdropVariants } from '@/lib/animations';

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  category: 'action' | 'connection' | 'theme' | 'navigation';
  onSelect: () => void;
}

interface RecentConnection {
  id: string;
  name: string;
  host: string;
}

interface CommandPaletteProps {
  commands?: CommandItem[];
  recentConnections?: RecentConnection[];
  onNewConnection?: () => void;
  onOpenSettings?: () => void;
  onOpenSftp?: () => void;
  onOpenPortForwarding?: () => void;
  onConnectRecent?: (id: string) => void;
  onThemeChange?: (themeId: string) => void;
  className?: string;
}

export function CommandPalette({
  commands = [],
  recentConnections = [],
  onNewConnection,
  onOpenSettings,
  onOpenSftp,
  onOpenPortForwarding,
  onConnectRecent,
  onThemeChange,
  className,
}: CommandPaletteProps) {
  const { commandPaletteOpen, setCommandPaletteOpen, toggleSidebar, toggleBottomPanel } =
    useAppShell();
  const [search, setSearch] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus input when opened
  React.useEffect(() => {
    if (commandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [commandPaletteOpen]);

  // Built-in commands
  const builtInCommands: CommandItem[] = [
    {
      id: 'new-connection',
      label: 'New Connection',
      icon: <Plus size={16} />,
      shortcut: '⌘N',
      category: 'action',
      onSelect: () => {
        setCommandPaletteOpen(false);
        onNewConnection?.();
      },
    },
    {
      id: 'settings',
      label: 'Open Settings',
      icon: <Settings size={16} />,
      shortcut: '⌘,',
      category: 'action',
      onSelect: () => {
        setCommandPaletteOpen(false);
        onOpenSettings?.();
      },
    },
    {
      id: 'toggle-sidebar',
      label: 'Toggle Sidebar',
      icon: <Terminal size={16} />,
      shortcut: '⌘B',
      category: 'navigation',
      onSelect: () => {
        setCommandPaletteOpen(false);
        toggleSidebar();
      },
    },
    {
      id: 'toggle-panel',
      label: 'Toggle Bottom Panel',
      icon: <FolderOpen size={16} />,
      shortcut: '⌘J',
      category: 'navigation',
      onSelect: () => {
        setCommandPaletteOpen(false);
        toggleBottomPanel();
      },
    },
    {
      id: 'open-sftp',
      label: 'Open SFTP Panel',
      icon: <FolderOpen size={16} />,
      category: 'action',
      onSelect: () => {
        setCommandPaletteOpen(false);
        onOpenSftp?.();
      },
    },
    {
      id: 'port-forwarding',
      label: 'Port Forwarding',
      icon: <Network size={16} />,
      category: 'action',
      onSelect: () => {
        setCommandPaletteOpen(false);
        onOpenPortForwarding?.();
      },
    },
  ];

  const allCommands = [...builtInCommands, ...commands];

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            variants={modalBackdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-modal-backdrop bg-crust/60 backdrop-blur-md"
            onClick={() => setCommandPaletteOpen(false)}
          />

          {/* Palette */}
          <motion.div
            variants={commandPaletteVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'fixed top-[20%] left-1/2 -translate-x-1/2 z-modal',
              'w-full max-w-lg',
              className
            )}
          >
            <Command
              className={cn(
                'rounded-xl border border-glass-border bg-glass-bg backdrop-blur-md shadow-xl overflow-hidden',
                '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2',
                '[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium',
                '[&_[cmdk-group-heading]]:text-subtext-0 [&_[cmdk-group-heading]]:capitalize'
              )}
              shouldFilter={true}
            >
              {/* Search Input */}
              <div className="flex items-center gap-2 px-3 border-b border-glass-border/50">
                <Search size={16} className="text-subtext-1 shrink-0" />
                <Command.Input
                  ref={inputRef}
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Search commands..."
                  className={cn(
                    'flex-1 h-11 bg-transparent text-sm text-text',
                    'placeholder:text-subtext-1 font-sans',
                    'focus:outline-none'
                  )}
                />
                <kbd className="text-[10px] text-subtext-1 bg-surface-0 border border-glass-border rounded-lg px-1.5 py-0.5">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <Command.List className="max-h-[300px] overflow-y-auto p-2">
                <Command.Empty className="py-6 text-center text-sm text-subtext-1">
                  No commands found.
                </Command.Empty>

                {/* Recent Connections */}
                {recentConnections.length > 0 && (
                  <Command.Group heading="Recent">
                    {recentConnections.map((conn) => (
                      <CommandPaletteItem
                        key={conn.id}
                        icon={<Clock size={14} className="text-subtext-1" />}
                        label={conn.name}
                        hint={conn.host}
                        onSelect={() => {
                          setCommandPaletteOpen(false);
                          onConnectRecent?.(conn.id);
                        }}
                      />
                    ))}
                  </Command.Group>
                )}

                {/* Commands */}
                <Command.Group heading="Commands">
                  {allCommands.map((cmd) => (
                    <CommandPaletteItem
                      key={cmd.id}
                      icon={cmd.icon}
                      label={cmd.label}
                      shortcut={cmd.shortcut}
                      onSelect={cmd.onSelect}
                    />
                  ))}
                </Command.Group>

                {/* Theme Selection (when searching for theme) */}
                {search.toLowerCase().includes('theme') && (
                  <Command.Group heading="Themes">
                    {['Purple', 'Blue', 'Dracula', 'Nord', 'Tokyo Night'].map(
                      (theme) => (
                        <CommandPaletteItem
                          key={theme}
                          icon={<Palette size={14} className="text-purple-500" />}
                          label={`Switch to ${theme}`}
                          onSelect={() => {
                            setCommandPaletteOpen(false);
                            onThemeChange?.(theme.toLowerCase().replace(' ', '-'));
                          }}
                        />
                      )
                    )}
                  </Command.Group>
                )}
              </Command.List>

              {/* Footer Hints */}
              <div className="flex items-center gap-4 px-3 py-2 border-t border-glass-border/50 text-[10px] text-subtext-1">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-surface-0 border border-glass-border rounded-md">↑↓</kbd> Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-surface-0 border border-glass-border rounded-md">↵</kbd> Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-surface-0 border border-glass-border rounded-md">ESC</kbd> Close
                </span>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================
// Command Item
// ============================================

interface CommandPaletteItemProps {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  shortcut?: string;
  onSelect: () => void;
}

function CommandPaletteItem({
  icon,
  label,
  hint,
  shortcut,
  onSelect,
}: CommandPaletteItemProps) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer',
        'text-sm text-text font-sans',
        'data-[selected=true]:bg-purple-500/10 data-[selected=true]:text-purple-500',
        'transition-all duration-200'
      )}
    >
      <span className="shrink-0 text-subtext-1">{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && (
        <span className="text-xs text-subtext-0 truncate max-w-[150px]">
          {hint}
        </span>
      )}
      {shortcut && (
        <kbd className="text-[10px] text-subtext-1 bg-surface-0 border border-glass-border rounded-lg px-1.5 py-0.5 ml-2">
          {shortcut}
        </kbd>
      )}
    </Command.Item>
  );
}

export { CommandPaletteItem };
