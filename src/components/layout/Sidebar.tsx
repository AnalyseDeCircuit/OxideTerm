import React from 'react';
import { 
  Terminal, 
  Folder, 
  ArrowLeftRight, 
  Settings, 
  Plus, 
  Monitor,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';

export const Sidebar = () => {
  const { 
    sidebarCollapsed, 
    sidebarActiveSection, 
    setSidebarSection,
    sessions,
    toggleModal,
    createTab
  } = useAppStore();

  if (sidebarCollapsed) {
    return null;
  }

  const sessionList = Array.from(sessions.values());

  return (
    <div className="flex h-full border-r border-oxide-border bg-oxide-panel w-64 flex-col">
      {/* Activity Bar (Top of sidebar) */}
      <div className="flex items-center p-2 gap-1 border-b border-oxide-border">
        <Button 
          variant={sidebarActiveSection === 'sessions' ? 'secondary' : 'ghost'} 
          size="icon"
          onClick={() => setSidebarSection('sessions')}
          title="Sessions"
          className="rounded-sm"
        >
          <Terminal className="h-4 w-4" />
        </Button>
        <Button 
          variant={sidebarActiveSection === 'sftp' ? 'secondary' : 'ghost'} 
          size="icon"
          onClick={() => setSidebarSection('sftp')}
          title="SFTP"
          className="rounded-sm"
        >
          <Folder className="h-4 w-4" />
        </Button>
        <Button 
          variant={sidebarActiveSection === 'forwards' ? 'secondary' : 'ghost'} 
          size="icon"
          onClick={() => setSidebarSection('forwards')}
          title="Port Forwarding"
          className="rounded-sm"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-sm"
          onClick={() => toggleModal('settings', true)}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-2">
        {sidebarActiveSection === 'sessions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Sessions</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={() => toggleModal('newConnection', true)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            
            <div className="space-y-1">
              {sessionList.length === 0 ? (
                <div className="text-sm text-zinc-500 px-2 py-4 text-center">
                  No active sessions
                </div>
              ) : (
                sessionList.map(session => (
                  <div 
                    key={session.id}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 rounded-sm cursor-pointer group"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${session.state === 'connected' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <span className="truncate flex-1">{session.name}</span>
                  </div>
                ))
              )}
            </div>


          </div>
        )}
        
        {sidebarActiveSection === 'sftp' && (
          <div className="space-y-4">
            <div className="px-2">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">SFTP Sessions</span>
            </div>
            <div className="space-y-1">
              {sessionList.length === 0 ? (
                <div className="text-sm text-zinc-500 px-2 py-4 text-center">
                  No active sessions
                </div>
              ) : (
                sessionList.filter(s => s.state === 'connected').map(session => (
                  <div 
                    key={session.id}
                    onClick={() => createTab('sftp', session.id)}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 rounded-sm cursor-pointer group"
                  >
                    <Folder className="h-3 w-3 text-zinc-500" />
                    <span className="truncate flex-1">{session.name}</span>
                    <ChevronRight className="h-3 w-3 text-zinc-600 opacity-0 group-hover:opacity-100" />
                  </div>
                ))
              )}
              {sessionList.length > 0 && sessionList.filter(s => s.state === 'connected').length === 0 && (
                <div className="text-sm text-zinc-500 px-2 py-4 text-center">
                  No connected sessions
                </div>
              )}
            </div>
          </div>
        )}

        {sidebarActiveSection === 'forwards' && (
          <div className="space-y-4">
            <div className="px-2">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Port Forwarding</span>
            </div>
            <div className="space-y-1">
              {sessionList.length === 0 ? (
                <div className="text-sm text-zinc-500 px-2 py-4 text-center">
                  No active sessions
                </div>
              ) : (
                sessionList.filter(s => s.state === 'connected').map(session => (
                  <div 
                    key={session.id}
                    onClick={() => createTab('forwards', session.id)}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 rounded-sm cursor-pointer group"
                  >
                    <ArrowLeftRight className="h-3 w-3 text-zinc-500" />
                    <span className="truncate flex-1">{session.name}</span>
                    <ChevronRight className="h-3 w-3 text-zinc-600 opacity-0 group-hover:opacity-100" />
                  </div>
                ))
              )}
              {sessionList.length > 0 && sessionList.filter(s => s.state === 'connected').length === 0 && (
                <div className="text-sm text-zinc-500 px-2 py-4 text-center">
                  No connected sessions
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
