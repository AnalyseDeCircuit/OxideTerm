/**
 * OxideTerm - Main Application Entry
 * 
 * Refactored to use new UI component system (Phase 0-4).
 * Uses AppShell layout with integrated Sidebar, TabBar, and BottomPanel.
 */

import { useState, useCallback, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';

// New Layout Components (Phase 2)
import {
  AppShellProvider,
  AppShell,
  AppShellSidebar,
  AppShellMain,
  AppShellContent,
  useAppShell,
} from './components/layout/AppShell';
import { Sidebar } from './components/layout/Sidebar';
import { TabBar, type TabItem } from './components/layout/TabBar';
import { BottomPanel } from './components/layout/BottomPanel';
import { CommandPalette } from './components/layout/CommandPalette';

// New UI Components (Phase 1 & 4)
import {
  TooltipProvider,
  Toaster,
  EmptyState,
  PageTransition,
} from './components/ui';

// Legacy components (still needed)
import { 
  ConnectModal, 
  TerminalContainer,
  TerminalSettings,
} from './components';

// Store & utilities
import { useSessionStore } from './store';
import { useKeyboardShortcuts } from './hooks';

// ============================================
// Main App Wrapper with Providers
// ============================================

function App() {
  return (
    <TooltipProvider>
      <AppShellProvider>
        <AppContent />
        <Toaster />
      </AppShellProvider>
    </TooltipProvider>
  );
}

// ============================================
// App Content (inside providers)
// ============================================

function AppContent() {
  const { toggleBottomPanel } = useAppShell();
  
  // Modal states
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Connection prefill
  const [prefillConnection, setPrefillConnection] = useState<{
    host: string;
    port: number;
    username: string;
    authType: 'password' | 'key';
    password?: string;
    keyPath?: string;
  } | null>(null);
  
  // Session store
  const tabs = useSessionStore((state) => state.tabs);
  const activeTabId = useSessionStore((state) => state.activeTabId);
  const sessions = useSessionStore((state) => state.sessions);
  const setActiveTab = useSessionStore((state) => state.setActiveTab);
  const disconnect = useSessionStore((state) => state.disconnect);
  const hasSessions = tabs.length > 0;
  
  // Convert store tabs to TabBar format
  const tabBarTabs: TabItem[] = useMemo(() => {
    return tabs.map((tab) => {
      const session = sessions.get(tab.sessionId);
      let status: TabItem['status'] = 'disconnected';
      if (session) {
        if (session.state === 'connected') status = 'connected';
        else if (session.state === 'connecting') status = 'connecting';
        else if (session.state === 'error') status = 'error';
      }
      return {
        id: tab.id,
        title: tab.title,
        status,
        hasActivity: false,
        sftpActive: false,
      };
    });
  }, [tabs, sessions]);

  const handleCloseModal = useCallback(() => {
    setIsConnectModalOpen(false);
    setPrefillConnection(null);
  }, []);

  const openNewConnection = useCallback(() => {
    setPrefillConnection(null);
    setIsConnectModalOpen(true);
  }, []);

  // Tab actions
  const handleTabSelect = useCallback((id: string) => {
    setActiveTab(id);
  }, [setActiveTab]);
  
  const handleTabClose = useCallback((id: string) => {
    // Find the tab's sessionId to disconnect
    const tab = tabs.find(t => t.id === id);
    if (tab) {
      disconnect(tab.sessionId);
    }
  }, [tabs, disconnect]);

  // Register keyboard shortcuts
  useKeyboardShortcuts({
    onNewTab: openNewConnection,
  });

  return (
    <AppShell>
      {/* Sidebar */}
      <AppShellSidebar>
        <Sidebar
          onNewConnection={openNewConnection}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      </AppShellSidebar>

      {/* Main Content Area */}
      <AppShellMain>
        {/* Tab Bar - Only show when there are sessions */}
        {hasSessions && (
          <TabBar
            tabs={tabBarTabs}
            activeTabId={activeTabId}
            onTabSelect={handleTabSelect}
            onTabClose={handleTabClose}
            onNewTab={openNewConnection}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenPortForwarding={toggleBottomPanel}
          />
        )}

        {/* Terminal Area */}
        <AppShellContent>
          <AnimatePresence mode="wait">
            {!hasSessions ? (
              <PageTransition key="welcome" pageKey="welcome">
                <WelcomeScreen onNewConnection={openNewConnection} />
              </PageTransition>
            ) : (
              <PageTransition key="terminal" pageKey="terminal">
                <TerminalContainer className="h-full" />
              </PageTransition>
            )}
          </AnimatePresence>
        </AppShellContent>

        {/* Bottom Panel (SFTP/Transfers/Port Forward) */}
        {hasSessions && <BottomPanel />}
      </AppShellMain>

      {/* Command Palette - uses internal state from useAppShell */}
      <CommandPalette
        onNewConnection={openNewConnection}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPortForwarding={toggleBottomPanel}
      />

      {/* Connect Modal */}
      <ConnectModal
        isOpen={isConnectModalOpen}
        onClose={handleCloseModal}
        prefill={prefillConnection || undefined}
      />

      {/* Terminal Settings Modal */}
      <TerminalSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </AppShell>
  );
}

// ============================================
// Welcome Screen Component (Redesigned)
// ============================================

function WelcomeScreen({ onNewConnection }: { onNewConnection: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-base">
      <EmptyState
        variant="no-sessions"
        title="Welcome to OxideTerm"
        description="A high-performance SSH terminal built with Rust. Zero-latency • GPU-accelerated • Secure by design."
        icon={
          <div className="relative">
            {/* Outer glow */}
            <div className="absolute -inset-8 bg-gradient-to-r from-blue/15 via-mauve/10 to-blue/15 rounded-full blur-3xl opacity-70" />
            {/* Icon */}
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-blue/15 to-mauve/15 border border-white/[0.06] flex items-center justify-center backdrop-blur-sm shadow-lg">
              <span className="text-3xl">⚡</span>
            </div>
          </div>
        }
        action={{
          label: 'New Connection',
          onClick: onNewConnection,
        }}
      />

      {/* Feature Pills */}
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <FeaturePill icon="🚀" label="Zero Latency" />
        <FeaturePill icon="🎨" label="GPU Accelerated" />
        <FeaturePill icon="🔒" label="Keychain" />
        <FeaturePill icon="📁" label="SFTP" />
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="mt-8 flex items-center justify-center gap-8 text-[11px] text-overlay-0/70">
        <KeyHint shortcut="⌘N" label="New Connection" />
        <KeyHint shortcut="⌘B" label="Toggle Sidebar" />
        <KeyHint shortcut="⌘K" label="Command Palette" />
      </div>
    </div>
  );
}

function FeaturePill({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.02] rounded-full text-xs text-overlay-0/70">
      <span className="opacity-70">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function KeyHint({ shortcut, label }: { shortcut: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <kbd className="px-2 py-1 bg-black/25 border border-white/[0.04] rounded-lg text-overlay-1/80 font-mono">
        {shortcut}
      </kbd>
      <span>{label}</span>
    </div>
  );
}

export default App;
