import { useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { Toaster } from './components/ui/toaster';
import { ReconnectDialog } from './components/modals/ReconnectDialog';
import { AutoRouteModal } from './components/modals/AutoRouteModal';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useConnectionEvents } from './hooks/useConnectionEvents';
import { setupTreeStoreSubscriptions, cleanupTreeStoreSubscriptions } from './store/sessionTreeStore';

function App() {
  // Initialize global event listeners
  // useReconnectEvents 已废弃，由 useConnectionEvents 统一处理连接事件
  useNetworkStatus();
  useConnectionEvents();
  
  // Setup SessionTree state sync
  useEffect(() => {
    setupTreeStoreSubscriptions();
    return () => cleanupTreeStoreSubscriptions();
  }, []);

  return (
    <>
      <AppLayout />
      <Toaster />
      <ReconnectDialog />
      <AutoRouteModal />
    </>
  );
}

export default App;
