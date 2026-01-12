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
    toggleModal
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

            <div className="px-2 pt-4">
               <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Saved Connections</span>
               {/* Mock Saved List */}
               <div className="mt-2 space-y-1">
                 <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 rounded-sm cursor-pointer">
                    <Monitor className="h-3 w-3" />
                    <span>Production DB</span>
                 </div>
                 <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 rounded-sm cursor-pointer">
                    <Monitor className="h-3 w-3" />
                    <span>Dev Server</span>
                 </div>
               </div>
            </div>
          </div>
        )}
        
        {sidebarActiveSection === 'sftp' && (
          <div className="p-2 text-sm text-zinc-500">
            Select a session to browse files.
          </div>
        )}

        {sidebarActiveSection === 'forwards' && (
          <div className="p-2 text-sm text-zinc-500">
             Select a session to manage ports.
          </div>
        )}
      </div>
    </div>
  );
};
