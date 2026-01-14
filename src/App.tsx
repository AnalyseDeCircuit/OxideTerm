import { AppLayout } from './components/layout/AppLayout';
import { Toaster } from './components/ui/toaster';
import { ReconnectDialog } from './components/modals/ReconnectDialog';
import { useReconnectEvents } from './hooks/useReconnectEvents';
import { useNetworkStatus } from './hooks/useNetworkStatus';

function App() {
  // Initialize global event listeners
  useReconnectEvents();
  useNetworkStatus();

  return (
    <>
      <AppLayout />
      <Toaster />
      <ReconnectDialog />
    </>
  );
}

export default App;
