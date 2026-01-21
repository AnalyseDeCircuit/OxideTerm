import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { useAppStore } from '../../store/appStore';
import { TerminalView } from '../terminal/TerminalView';
import { LocalTerminalView } from '../terminal/LocalTerminalView';
import { Button } from '../ui/button';
import { NewConnectionModal } from '../modals/NewConnectionModal';
import { SettingsView } from '../settings/SettingsView';
import { ConnectionPoolMonitor } from '../connections/ConnectionPoolMonitor';
import { ConnectionsPanel } from '../connections/ConnectionsPanel';
import { TopologyPage } from '../topology/TopologyPage';
import { Plus } from 'lucide-react';

// Lazy load non-critical views (only loaded when user opens SFTP/Forwards tab)
const SFTPView = lazy(() => import('../sftp/SFTPView').then(m => ({ default: m.SFTPView })));
const ForwardsView = lazy(() => import('../forwards/ForwardsView').then(m => ({ default: m.ForwardsView })));

// Loading fallback for lazy components
const ViewLoader = () => {
  // Note: Can't use hooks in non-component, keep English for fallback
  return (
    <div className="flex items-center justify-center h-full text-zinc-500">
      <div className="animate-pulse">Loading...</div>
    </div>
  );
};

export const AppLayout = () => {
  const { t } = useTranslation();
  const { tabs, activeTabId, toggleModal } = useAppStore();

  return (
    <div className="flex h-screen w-screen bg-theme-bg text-oxide-text overflow-hidden">
      {/* Modals */}
      <NewConnectionModal />
      {/* SettingsModal removed - now a Tab View */}

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <TabBar />
        
        <div className="flex-1 relative bg-theme-bg overflow-hidden">
          {tabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500">
              <div className="mb-4 text-2xl font-bold text-zinc-700">{t('layout.empty.title')}</div>
              <p className="mb-8">{t('layout.empty.no_sessions')}</p>
              <Button onClick={() => toggleModal('newConnection', true)} className="gap-2">
                <Plus className="h-4 w-4" /> {t('layout.empty.new_connection')}
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
                   {tab.type === 'terminal' && tab.sessionId && <TerminalView key={tab.sessionId} sessionId={tab.sessionId} isActive={tab.id === activeTabId} />}
                   {tab.type === 'local_terminal' && tab.sessionId && <LocalTerminalView key={tab.sessionId} sessionId={tab.sessionId} isActive={tab.id === activeTabId} />}
                   {tab.type === 'sftp' && tab.sessionId && (
                     <Suspense fallback={<ViewLoader />}>
                       <SFTPView sessionId={tab.sessionId} />
                     </Suspense>
                   )}
                   {tab.type === 'forwards' && tab.sessionId && (
                     <Suspense fallback={<ViewLoader />}>
                       <ForwardsView sessionId={tab.sessionId} />
                     </Suspense>
                   )}
                   {tab.type === 'settings' && <SettingsView />}
                   {tab.type === 'connection_monitor' && (
                       <div className="h-full w-full bg-theme-bg p-8 overflow-auto">
                           <div className="max-w-5xl mx-auto">
                                <h2 className="text-2xl font-bold mb-6 text-zinc-200">{t('layout.connection_monitor.title')}</h2>
                                <ConnectionPoolMonitor />
                           </div>
                       </div>
                   )}
                   {tab.type === 'connection_pool' && <ConnectionsPanel />}
                   {tab.type === 'topology' && <TopologyPage />}
                 </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
