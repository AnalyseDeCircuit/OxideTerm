import { AppLayout } from './components/layout/AppLayout';
import { Toaster } from './components/ui/toaster';
import { ReconnectDialog } from './components/modals/ReconnectDialog';
import { useReconnectEvents } from './hooks/useReconnectEvents';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useConnectionEvents } from './hooks/useConnectionEvents';

function App() {
  // Initialize global event listeners
  useReconnectEvents();
  useNetworkStatus();
  useConnectionEvents();

  return (
    <>
      <AppLayout />
      <Toaster />
      <ReconnectDialog />
    </>
  );
}

export default App;
