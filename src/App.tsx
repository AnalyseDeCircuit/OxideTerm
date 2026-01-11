import { useState, useCallback } from 'react';
import { Sidebar, ConnectModal, TabBar, TerminalContainer } from './components';
import { useSessionStore } from './store';
import { ConnectionInfo, getConnectionPassword } from './lib/config';
import { useKeyboardShortcuts } from './hooks';

function App() {
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [prefillConnection, setPrefillConnection] = useState<{
    host: string;
    port: number;
    username: string;
    authType: 'password' | 'key';
    password?: string;
    keyPath?: string;
  } | null>(null);
  
  const tabs = useSessionStore((state) => state.tabs);
  const hasSessions = tabs.length > 0;

  // Handle connecting from saved connection
  const handleConnectSaved = useCallback(async (conn: ConnectionInfo) => {
    try {
      let password: string | undefined;
      
      // Get password from keychain if password auth
      if (conn.authType === 'password') {
        password = await getConnectionPassword(conn.id);
      }
      
      // Pre-fill the connection modal
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
      // Fallback: open modal without password
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
    <div className="flex h-screen w-screen bg-gray-900 overflow-hidden">
      {/* Sidebar */}
      <Sidebar 
        onNewConnection={openNewConnection}
        onConnectSaved={handleConnectSaved}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tab Bar (only show if sessions exist) */}
        {hasSessions && <TabBar />}

        {/* Terminal Area */}
        <div className="flex-1 relative">
          {!hasSessions ? (
            <WelcomeScreen onNewConnection={openNewConnection} />
          ) : (
            <TerminalContainer className="h-full" />
          )}
        </div>
      </div>

      {/* Connect Modal */}
      <ConnectModal
        isOpen={isConnectModalOpen}
        onClose={handleCloseModal}
        prefill={prefillConnection || undefined}
      />
    </div>
  );
}

function WelcomeScreen({ onNewConnection }: { onNewConnection: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="text-6xl mb-6">⚡</div>
      <h1 className="text-3xl font-bold text-white mb-2">
        Welcome to OxideTerm
      </h1>
      <p className="text-gray-400 mb-8 max-w-md">
        A high-performance SSH terminal client built with Rust and modern web technologies.
        Zero-latency experience with WebSocket bridging and GPU-accelerated rendering.
      </p>
      <button
        onClick={onNewConnection}
        className="btn btn-primary text-lg px-8 py-3"
      >
        🔗 Create Your First Connection
      </button>
      
      <div className="mt-12 grid grid-cols-3 gap-8 text-center">
        <div>
          <div className="text-2xl mb-2">🚀</div>
          <div className="text-sm text-gray-400">Zero Latency</div>
        </div>
        <div>
          <div className="text-2xl mb-2">🎨</div>
          <div className="text-sm text-gray-400">GPU Accelerated</div>
        </div>
        <div>
          <div className="text-2xl mb-2">🔒</div>
          <div className="text-sm text-gray-400">Secure</div>
        </div>
      </div>
    </div>
  );
}

export default App;
