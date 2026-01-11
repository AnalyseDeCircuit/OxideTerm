import { useSessionStore } from '../store';
import { Session } from '../types';

interface SidebarProps {
  onNewConnection: () => void;
}

export function Sidebar({ onNewConnection }: SidebarProps) {
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const removeSession = useSessionStore((state) => state.removeSession);

  const sessionList = Array.from(sessions.values());

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          OxideTerm
        </h1>
      </div>

      {/* New Connection Button */}
      <div className="p-3">
        <button
          onClick={onNewConnection}
          className="w-full btn btn-primary flex items-center justify-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Connection
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Active Sessions ({sessionList.length})
        </div>
        
        {sessionList.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            No active sessions.<br />
            Click "New Connection" to start.
          </div>
        ) : (
          <div className="space-y-1 px-2">
            {sessionList.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onSelect={() => setActiveSession(session.id)}
                onClose={() => removeSession(session.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-800 text-xs text-gray-500">
        v0.1.0 • Built with Rust & Tauri
      </div>
    </div>
  );
}

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

function SessionItem({ session, isActive, onSelect, onClose }: SessionItemProps) {
  const statusColors = {
    disconnected: 'bg-gray-500',
    connecting: 'bg-yellow-500 animate-pulse',
    connected: 'bg-green-500',
    error: 'bg-red-500',
  };

  return (
    <div
      className={`
        group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer
        transition-colors duration-150
        ${isActive 
          ? 'bg-blue-600/20 border border-blue-500/30' 
          : 'hover:bg-gray-800 border border-transparent'
        }
      `}
      onClick={onSelect}
    >
      {/* Status indicator */}
      <div className={`w-2 h-2 rounded-full ${statusColors[session.status]}`} />
      
      {/* Session info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">
          {session.config.username}@{session.config.host}
        </div>
        <div className="text-xs text-gray-500 truncate">
          Port {session.config.port}
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-opacity"
        title="Close session"
      >
        <svg
          className="w-4 h-4 text-gray-400 hover:text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
