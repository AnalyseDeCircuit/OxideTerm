import { useState, useEffect, useCallback } from 'react';
import {
  ConnectionInfo,
  SshHostInfo,
  getConnections,
  getRecentConnections,
  searchConnections,
  getGroups,
  listSshConfigHosts,
  deleteConnection,
  markConnectionUsed,
} from '../lib/config';

interface ConnectionListProps {
  onConnect: (connection: ConnectionInfo) => void;
  onEdit: (connection: ConnectionInfo) => void;
  onNewConnection: () => void;
  onImportFromSsh: (hosts: SshHostInfo[]) => void;
}

type ViewMode = 'all' | 'recent' | 'groups' | 'ssh-config';

export function ConnectionList({
  onConnect,
  onEdit,
  onNewConnection,
  onImportFromSsh,
}: ConnectionListProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('recent');
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [recentConnections, setRecentConnections] = useState<ConnectionInfo[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [sshHosts, setSshHosts] = useState<SshHostInfo[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Recent']));
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredConnections, setFilteredConnections] = useState<ConnectionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load connections
  const loadConnections = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [allConns, recent, grps] = await Promise.all([
        getConnections(),
        getRecentConnections(5),
        getGroups(),
      ]);
      
      setConnections(allConns);
      setRecentConnections(recent);
      setGroups(grps);
    } catch (err) {
      console.error('Failed to load connections:', err);
      setError(err instanceof Error ? err.message : 'Failed to load connections');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load SSH config hosts
  const loadSshHosts = useCallback(async () => {
    try {
      const hosts = await listSshConfigHosts();
      setSshHosts(hosts);
    } catch (err) {
      console.error('Failed to load SSH config:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadConnections();
    loadSshHosts();
  }, [loadConnections, loadSshHosts]);

  // Search
  useEffect(() => {
    if (searchQuery.trim()) {
      searchConnections(searchQuery).then(setFilteredConnections).catch(console.error);
    } else {
      setFilteredConnections([]);
    }
  }, [searchQuery]);

  // Handle connect
  const handleConnect = async (conn: ConnectionInfo) => {
    try {
      await markConnectionUsed(conn.id);
      onConnect(conn);
      // Refresh recent
      const recent = await getRecentConnections(5);
      setRecentConnections(recent);
    } catch (err) {
      console.error('Failed to mark connection used:', err);
      onConnect(conn);
    }
  };

  // Handle delete
  const handleDelete = async (conn: ConnectionInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete connection "${conn.name}"?`)) return;
    
    try {
      await deleteConnection(conn.id);
      await loadConnections();
    } catch (err) {
      console.error('Failed to delete connection:', err);
    }
  };

  // Toggle group expansion
  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  // Group connections
  const groupedConnections = connections.reduce<Record<string, ConnectionInfo[]>>((acc, conn) => {
    const group = conn.group || 'Ungrouped';
    if (!acc[group]) acc[group] = [];
    acc[group].push(conn);
    return acc;
  }, {});

  // Show search results or regular view
  const showingSearch = searchQuery.trim().length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-2">
        <div className="relative">
          <input
            type="text"
            placeholder="Search connections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 pr-8 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* View Mode Tabs */}
      {!showingSearch && (
        <div className="flex border-b border-gray-800">
          {(['recent', 'all', 'groups', 'ssh-config'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors
                ${viewMode === mode
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-500 hover:text-gray-300'
                }`}
            >
              {mode === 'recent' && '⏱ Recent'}
              {mode === 'all' && '📋 All'}
              {mode === 'groups' && '📁 Groups'}
              {mode === 'ssh-config' && '🔑 SSH'}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-400 text-sm">{error}</div>
        ) : showingSearch ? (
          // Search Results
          <div className="p-2">
            {filteredConnections.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-4">
                No connections found
              </div>
            ) : (
              <div className="space-y-1">
                {filteredConnections.map((conn) => (
                  <ConnectionItem
                    key={conn.id}
                    connection={conn}
                    onConnect={() => handleConnect(conn)}
                    onEdit={() => onEdit(conn)}
                    onDelete={(e) => handleDelete(conn, e)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : viewMode === 'recent' ? (
          // Recent Connections
          <div className="p-2">
            {recentConnections.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                No recent connections.<br />
                <button
                  onClick={onNewConnection}
                  className="text-blue-400 hover:text-blue-300 mt-2"
                >
                  Create your first connection
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {recentConnections.map((conn) => (
                  <ConnectionItem
                    key={conn.id}
                    connection={conn}
                    onConnect={() => handleConnect(conn)}
                    onEdit={() => onEdit(conn)}
                    onDelete={(e) => handleDelete(conn, e)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : viewMode === 'all' ? (
          // All Connections
          <div className="p-2">
            {connections.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                No saved connections
              </div>
            ) : (
              <div className="space-y-1">
                {connections.map((conn) => (
                  <ConnectionItem
                    key={conn.id}
                    connection={conn}
                    onConnect={() => handleConnect(conn)}
                    onEdit={() => onEdit(conn)}
                    onDelete={(e) => handleDelete(conn, e)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : viewMode === 'groups' ? (
          // Grouped View
          <div className="p-2">
            {Object.keys(groupedConnections).length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                No connections
              </div>
            ) : (
              <div className="space-y-2">
                {['Recent', ...groups, 'Ungrouped'].map((group) => {
                  const conns = group === 'Recent' ? recentConnections : groupedConnections[group];
                  if (!conns || conns.length === 0) return null;
                  
                  const isExpanded = expandedGroups.has(group);
                  
                  return (
                    <div key={group}>
                      <button
                        onClick={() => toggleGroup(group)}
                        className="w-full flex items-center gap-2 px-2 py-1 text-xs font-semibold text-gray-400 hover:text-white"
                      >
                        <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                          ▶
                        </span>
                        {group} ({conns.length})
                      </button>
                      {isExpanded && (
                        <div className="ml-4 space-y-1">
                          {conns.map((conn) => (
                            <ConnectionItem
                              key={conn.id}
                              connection={conn}
                              compact
                              onConnect={() => handleConnect(conn)}
                              onEdit={() => onEdit(conn)}
                              onDelete={(e) => handleDelete(conn, e)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          // SSH Config Hosts
          <div className="p-2">
            {sshHosts.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                No hosts found in ~/.ssh/config
              </div>
            ) : (
              <>
                <div className="mb-2">
                  <button
                    onClick={() => onImportFromSsh(sshHosts)}
                    className="w-full text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded"
                  >
                    Import All ({sshHosts.length})
                  </button>
                </div>
                <div className="space-y-1">
                  {sshHosts.map((host) => (
                    <SshHostItem
                      key={host.alias}
                      host={host}
                      onImport={() => onImportFromSsh([host])}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

interface ConnectionItemProps {
  connection: ConnectionInfo;
  compact?: boolean;
  onConnect: () => void;
  onEdit: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function ConnectionItem({
  connection,
  compact,
  onConnect,
  onEdit,
  onDelete,
}: ConnectionItemProps) {
  const authIcon = {
    password: '🔑',
    key: '🔐',
    agent: '🔓',
  }[connection.authType];

  return (
    <div
      onClick={onConnect}
      className={`
        group flex items-center gap-2 px-2 rounded cursor-pointer
        hover:bg-gray-800 border border-transparent hover:border-gray-700
        ${compact ? 'py-1' : 'py-2'}
      `}
    >
      {/* Color indicator or icon */}
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: connection.color || '#3b82f6' }}
      />
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`font-medium text-white truncate ${compact ? 'text-xs' : 'text-sm'}`}>
            {connection.name}
          </span>
          <span className="text-xs">{authIcon}</span>
        </div>
        {!compact && (
          <div className="text-xs text-gray-500 truncate">
            {connection.username}@{connection.host}:{connection.port}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
          title="Edit"
        >
          ✏️
        </button>
        <button
          onClick={onDelete}
          className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400"
          title="Delete"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

interface SshHostItemProps {
  host: SshHostInfo;
  onImport: () => void;
}

function SshHostItem({ host, onImport }: SshHostItemProps) {
  return (
    <div
      className="group flex items-center gap-2 px-2 py-2 rounded cursor-pointer
        hover:bg-gray-800 border border-transparent hover:border-gray-700"
    >
      <span className="text-gray-500">🔑</span>
      
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">
          {host.alias}
        </div>
        <div className="text-xs text-gray-500 truncate">
          {host.user || '~'}@{host.hostname}:{host.port}
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onImport();
        }}
        className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-opacity"
      >
        Import
      </button>
    </div>
  );
}
