import { useState, useCallback } from 'react';
import { 
  Sidebar, 
  ConnectModal, 
  TabBar, 
  TerminalContainer, 
  TerminalSettings,
  SftpDrawer 
} from './components';
import { useSessionStore } from './store';
import { ConnectionInfo, getConnectionPassword } from './lib/config';
import { useKeyboardShortcuts } from './hooks';

function App() {
  // Modal states
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSftpOpen, setIsSftpOpen] = useState(false);
  
  // Sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
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
  const hasSessions = tabs.length > 0;
  
  // Get active session info for SFTP
  const activeTab = tabs.find(t => t.id === activeTabId);
  const activeSession = activeTab ? sessions.get(activeTab.sessionId) : undefined;

  // Handle connecting from saved connection
  const handleConnectSaved = useCallback(async (conn: ConnectionInfo) => {
    try {
      let password: string | undefined;
      
      if (conn.authType === 'password') {
        password = await getConnectionPassword(conn.id);
      }
      
      setPrefillConnection({
        host: conn.host,
        port: conn.port,
        username: conn.username,
        authType: conn.authType === 'agent' ? 'key' : conn.authType,
        password: password,
        keyPath: conn.keyPath || undefined,
      });
      
      setIsConnectModalOpen(true);
    } catch (err) {
      console.error('Failed to prepare connection:', err);
      setPrefillConnection({
        host: conn.host,
        port: conn.port,
        username: conn.username,
        authType: conn.authType === 'agent' ? 'key' : conn.authType,
        keyPath: conn.keyPath || undefined,
      });
      setIsConnectModalOpen(true);
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsConnectModalOpen(false);
    setPrefillConnection(null);
  }, []);

  const openNewConnection = useCallback(() => {
    setPrefillConnection(null);
    setIsConnectModalOpen(true);
  }, []);

  // Register keyboard shortcuts
  useKeyboardShortcuts({
    onNewTab: openNewConnection,
  });

  return (
    <div 
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{ background: 'var(--color-base)' }}
    >
      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <Sidebar 
          onNewConnection={openNewConnection}
          onConnectSaved={handleConnectSaved}
          isCollapsed={isSidebarCollapsed}
          onCollapsedChange={setIsSidebarCollapsed}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tab Bar */}
          {hasSessions && (
            <TabBar 
              onNewTab={openNewConnection}
              onOpenSftp={() => setIsSftpOpen(true)}
            />
          )}

          {/* Terminal Area */}
          <div className="flex-1 relative min-h-0">
            {!hasSessions ? (
              <WelcomeScreen onNewConnection={openNewConnection} />
            ) : (
              <TerminalContainer className="h-full" />
            )}
          </div>
        </div>
      </div>

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

      {/* SFTP Drawer */}
      <SftpDrawer
        isOpen={isSftpOpen}
        onClose={() => setIsSftpOpen(false)}
        sessionId={activeTab?.sessionId}
        hostName={activeSession?.config.host}
      />
    </div>
  );
}

// ============================================
// Welcome Screen Component
// ============================================

function WelcomeScreen({ onNewConnection }: { onNewConnection: () => void }) {
  return (
    <div 
      className="flex flex-col items-center justify-center h-full text-center px-8 py-12"
      style={{ background: 'var(--color-base)' }}
    >
      {/* Logo - Refined with soft outer glow */}
      <div className="relative mb-10">
        {/* Outer glow layer */}
        <div className="absolute -inset-10 bg-gradient-to-r from-blue/15 via-mauve/10 to-blue/15 rounded-full blur-3xl opacity-70" />
        {/* Icon container */}
        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-blue/15 to-mauve/15 border border-white/[0.06] flex items-center justify-center backdrop-blur-sm shadow-lg">
          <span className="text-2xl">⚡</span>
        </div>
      </div>
      
      {/* Title */}
      <h1 className="text-2xl font-semibold text-text mb-3 tracking-tight">
        Welcome to OxideTerm
      </h1>
      <p className="text-sm text-overlay-1 mb-8 max-w-xs leading-relaxed">
        A high-performance SSH terminal built with Rust.
        <br />
        Zero-latency • GPU-accelerated • Secure by design.
      </p>
      
      {/* CTA Button */}
      <button
        onClick={onNewConnection}
        className="btn-primary px-6 py-2.5 rounded-xl text-sm font-medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        New Connection
      </button>
      
      {/* Feature Pills - Demoted visual weight */}
      <div className="mt-10 flex flex-wrap justify-center gap-2">
        <FeaturePill icon="🚀" label="Zero Latency" />
        <FeaturePill icon="🎨" label="GPU Accelerated" />
        <FeaturePill icon="🔒" label="Keychain" />
        <FeaturePill icon="📁" label="SFTP" />
      </div>
      
      {/* Keyboard Shortcuts Hint - Refined kbd style */}
      <div className="mt-8 flex items-center justify-center gap-8 text-[11px] text-overlay-0/70">
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 bg-black/25 border border-white/[0.04] rounded-lg text-overlay-1/80 font-mono">⌘T</kbd>
          <span>New Connection</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 bg-black/25 border border-white/[0.04] rounded-lg text-overlay-1/80 font-mono">⌘B</kbd>
          <span>Toggle Sidebar</span>
        </div>
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

export default App;
