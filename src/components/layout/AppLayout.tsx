import { lazy, Suspense } from 'react';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { useAppStore } from '../../store/appStore';
import { TerminalView } from '../terminal/TerminalView';
import { Button } from '../ui/button';
import { NewConnectionModal } from '../modals/NewConnectionModal';
import { SettingsModal } from '../modals/SettingsModal';
import { Plus } from 'lucide-react';

// Lazy load non-critical views (only loaded when user opens SFTP/Forwards tab)
const SFTPView = lazy(() => import('../sftp/SFTPView').then(m => ({ default: m.SFTPView })));
const ForwardsView = lazy(() => import('../forwards/ForwardsView').then(m => ({ default: m.ForwardsView })));

// Loading fallback for lazy components
const ViewLoader = () => (
  <div className="flex items-center justify-center h-full text-zinc-500">
    <div className="animate-pulse">Loading...</div>
  </div>
);

export const AppLayout = () => {
  const { tabs, activeTabId, toggleModal } = useAppStore();

  return (
    <div className="flex h-screen w-screen bg-theme-bg text-oxide-text overflow-hidden">
      {/* Modals */}
      <NewConnectionModal />
      <SettingsModal />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <TabBar />
        
        <div className="flex-1 relative bg-theme-bg overflow-hidden">
          {tabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500">
              <div className="mb-4 text-2xl font-bold text-zinc-700">OxideTerm</div>
              <p className="mb-8">No active sessions</p>
              <Button onClick={() => toggleModal('newConnection', true)} className="gap-2">
                <Plus className="h-4 w-4" /> New Connection
              </Button>
            </div>
          ) : (
            <>
              {tabs.map(tab => (
                 <div 
                   key={tab.id} 
                   className={`absolute inset-0 ${tab.id === activeTabId ? 'z-10 block' : 'z-0 hidden'}`}
                 >
                   {/* key={sessionId} forces remount when session changes (e.g., after reconnect) */}
                   {tab.type === 'terminal' && <TerminalView key={tab.sessionId} sessionId={tab.sessionId} isActive={tab.id === activeTabId} />}
                   {tab.type === 'sftp' && (
                     <Suspense fallback={<ViewLoader />}>
                       <SFTPView sessionId={tab.sessionId} />
                     </Suspense>
                   )}
                   {tab.type === 'forwards' && (
                     <Suspense fallback={<ViewLoader />}>
                       <ForwardsView sessionId={tab.sessionId} />
                     </Suspense>
                   )}
                 </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
