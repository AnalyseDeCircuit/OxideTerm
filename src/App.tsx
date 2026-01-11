import { useState, useCallback } from 'react';
import { 
  TitleBar, 
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
      {/* Custom Title Bar */}
      <TitleBar 
        title="OxideTerm"
        subtitle={activeSession ? `${activeSession.config.username}@${activeSession.config.host}` : undefined}
      />

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
            <TabBar onNewTab={openNewConnection} />
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
      className="flex flex-col items-center justify-center h-full text-center p-8"
      style={{ background: 'var(--color-base)' }}
    >
      {/* Logo */}
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue to-mauve flex items-center justify-center shadow-glow">
          <span className="text-4xl">⚡</span>
        </div>
        <div className="absolute -inset-4 bg-blue/10 rounded-3xl blur-xl -z-10" />
      </div>
      
      {/* Title */}
      <h1 className="text-3xl font-bold text-text mb-2 tracking-tight">
        Welcome to OxideTerm
      </h1>
      <p className="text-subtext-0 mb-8 max-w-md leading-relaxed">
        A high-performance SSH terminal built with Rust.
        <br />
        Zero-latency • GPU-accelerated • Secure by design.
      </p>
      
      {/* CTA Button */}
      <button
        onClick={onNewConnection}
        className="btn btn-primary text-base px-6 py-2.5 shadow-glow-sm"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        New Connection
      </button>
      
      {/* Feature Pills */}
      <div className="mt-12 flex flex-wrap justify-center gap-3">
        <FeaturePill icon="🚀" label="Zero Latency" />
        <FeaturePill icon="🎨" label="GPU Accelerated" />
        <FeaturePill icon="🔒" label="Keychain Integration" />
        <FeaturePill icon="📁" label="SFTP Support" />
      </div>
      
      {/* Keyboard Shortcuts Hint */}
      <div className="mt-8 text-xs text-overlay-0">
        <span className="px-1.5 py-0.5 bg-surface-0/50 rounded text-overlay-1 font-mono">⌘T</span>
        <span className="mx-2">New Connection</span>
        <span className="px-1.5 py-0.5 bg-surface-0/50 rounded text-overlay-1 font-mono">⌘B</span>
        <span className="mx-2">Toggle Sidebar</span>
      </div>
    </div>
  );
}

function FeaturePill({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-0/50 rounded-full text-sm text-subtext-1">
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

export default App;
