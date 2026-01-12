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
import { CommandCenter } from './components/layout/CommandCenter';

// New UI Components (Phase 1 & 4)
import {
  TooltipProvider,
  Toaster,
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
              <PageTransition key="command-center" pageKey="command-center">
                <CommandCenter onNewConnection={openNewConnection} />
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

export default App;
