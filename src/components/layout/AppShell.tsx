/**
 * AppShell Component
 * 
 * Main application layout framework with collapsible sidebar,
 * tab bar, terminal area, and bottom panel.
 * 
 * Layout Structure:
 * ┌──────────────────────────────────────────────────┐
 * │ [Sidebar] │ [TabBar]                             │
 * │           ├──────────────────────────────────────│
 * │           │                                      │
 * │           │          [Main Content]              │
 * │           │                                      │
 * │           ├──────────────────────────────────────│
 * │           │ [BottomPanel - collapsible]          │
 * └──────────────────────────────────────────────────┘
 */

import * as React from 'react';
import { cn } from '@/lib/cn';

interface AppShellContextValue {
  // Sidebar
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  
  // Bottom panel
  bottomPanelOpen: boolean;
  setBottomPanelOpen: (open: boolean) => void;
  toggleBottomPanel: () => void;
  bottomPanelHeight: number;
  setBottomPanelHeight: (height: number) => void;
  
  // Command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
}

const AppShellContext = React.createContext<AppShellContextValue | null>(null);

export function useAppShell() {
  const context = React.useContext(AppShellContext);
  if (!context) {
    throw new Error('useAppShell must be used within AppShellProvider');
  }
  return context;
}

interface AppShellProviderProps {
  children: React.ReactNode;
  defaultSidebarCollapsed?: boolean;
  defaultBottomPanelOpen?: boolean;
  defaultBottomPanelHeight?: number;
}

export function AppShellProvider({
  children,
  defaultSidebarCollapsed = false,
  defaultBottomPanelOpen = false,
  defaultBottomPanelHeight = 200,
}: AppShellProviderProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => {
    const stored = localStorage.getItem('oxideterm:sidebar-collapsed');
    return stored ? JSON.parse(stored) : defaultSidebarCollapsed;
  });
  
  const [bottomPanelOpen, setBottomPanelOpen] = React.useState(defaultBottomPanelOpen);
  const [bottomPanelHeight, setBottomPanelHeight] = React.useState(() => {
    const stored = localStorage.getItem('oxideterm:panel-height');
    return stored ? JSON.parse(stored) : defaultBottomPanelHeight;
  });
  
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);

  // Persist sidebar state
  React.useEffect(() => {
    localStorage.setItem('oxideterm:sidebar-collapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Persist panel height
  React.useEffect(() => {
    localStorage.setItem('oxideterm:panel-height', JSON.stringify(bottomPanelHeight));
  }, [bottomPanelHeight]);

  const toggleSidebar = React.useCallback(() => {
    setSidebarCollapsed((prev: boolean) => !prev);
  }, []);

  const toggleBottomPanel = React.useCallback(() => {
    setBottomPanelOpen((prev: boolean) => !prev);
  }, []);

  const toggleCommandPalette = React.useCallback(() => {
    setCommandPaletteOpen(prev => !prev);
  }, []);

  // Global keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘B - Toggle sidebar
      if (e.metaKey && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
      // ⌘J - Toggle bottom panel
      if (e.metaKey && e.key === 'j') {
        e.preventDefault();
        toggleBottomPanel();
      }
      // ⌘K - Toggle command palette
      if (e.metaKey && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
      }
      // Escape - Close command palette
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar, toggleBottomPanel, toggleCommandPalette, commandPaletteOpen]);

  const value: AppShellContextValue = {
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebar,
    bottomPanelOpen,
    setBottomPanelOpen,
    toggleBottomPanel,
    bottomPanelHeight,
    setBottomPanelHeight,
    commandPaletteOpen,
    setCommandPaletteOpen,
    toggleCommandPalette,
  };

  return (
    <AppShellContext.Provider value={value}>
      {children}
    </AppShellContext.Provider>
  );
}

interface AppShellProps {
  children: React.ReactNode;
  className?: string;
}

export function AppShell({ children, className }: AppShellProps) {
  return (
    <div
      className={cn(
        'flex h-screen w-screen overflow-hidden bg-base text-text selection:bg-primary/20 selection:text-primary',
        // Add subtle grid background to the whole app shell, masked by content usually
        'bg-grid-pattern',
        className
      )}
    >
      {children}
    </div>
  );
}

// Sub-components for layout slots
interface AppShellSidebarProps {
  children: React.ReactNode;
  className?: string;
}

export function AppShellSidebar({ children, className }: AppShellSidebarProps) {
  const { sidebarCollapsed } = useAppShell();
  
  return (
    <aside
      className={cn(
        'flex flex-col h-full shrink-0 overflow-hidden z-20', // Increased Z-index to sit above grid
        'bg-sidebar-bg-solid border-r border-sidebar-border', // Solid BG mandatory now
        // Removed transition for "Snappy" feel - instant width change could be jarring, 
        // keeping fast transition but removing "ease-expo-out" for simpler one
        'transition-[width] duration-fast ease-out',
        sidebarCollapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
        className
      )}
      style={{
        width: sidebarCollapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)',
      }}
    >
      {children}
    </aside>
  );
}

interface AppShellMainProps {
  children: React.ReactNode;
  className?: string;
}

export function AppShellMain({ children, className }: AppShellMainProps) {
  return (
    <main className={cn('flex-1 flex flex-col min-w-0 min-h-0', className)}>
      {children}
    </main>
  );
}

interface AppShellContentProps {
  children: React.ReactNode;
  className?: string;
}

export function AppShellContent({ children, className }: AppShellContentProps) {
  return (
    <div className={cn('flex-1 relative min-h-0 overflow-hidden', className)}>
      {children}
    </div>
  );
}

export {
  AppShellContext,
  type AppShellContextValue,
};
