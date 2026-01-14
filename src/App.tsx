import { AppLayout } from './components/layout/AppLayout';
import { Toaster } from './components/ui/toaster';
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
    </>
  );
}

export default App;
