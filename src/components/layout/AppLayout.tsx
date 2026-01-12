import React from 'react';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { useAppStore } from '../../store/appStore';
import { TerminalView } from '../terminal/TerminalView';
import { SFTPView } from '../sftp/SFTPView';
import { ForwardsView } from '../forwards/ForwardsView';
import { Button } from '../ui/button';

export const AppLayout = () => {
  const { tabs, activeTabId, connect } = useAppStore();

  const activeTab = tabs.find(t => t.id === activeTabId);

  // Quick connect for demo purposes if no tabs
  const handleQuickConnect = () => {
    connect({
      host: '127.0.0.1',
      port: 22,
      username: 'root',
      auth_type: 'password'
    });
  };

  return (
    <div className="flex h-screen w-screen bg-oxide-bg text-oxide-text overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <TabBar />
        
        <div className="flex-1 relative bg-oxide-bg overflow-hidden">
          {tabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500">
              <div className="mb-4 text-2xl font-bold text-zinc-700">OxideTerm</div>
              <p className="mb-8">No active sessions</p>
              <Button onClick={handleQuickConnect}>
                Quick Connect (Localhost)
              </Button>
            </div>
          ) : (
            <>
              {tabs.map(tab => (
                 <div 
                   key={tab.id} 
                   className={`absolute inset-0 ${tab.id === activeTabId ? 'z-10 block' : 'z-0 hidden'}`}
                 >
                   {tab.type === 'terminal' && <TerminalView sessionId={tab.sessionId} />}
                   {tab.type === 'sftp' && <SFTPView sessionId={tab.sessionId} />}
                   {tab.type === 'forwards' && <ForwardsView sessionId={tab.sessionId} />}
                 </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
