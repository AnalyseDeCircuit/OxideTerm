import { useState, useEffect, useCallback } from 'react';
import { Clock, LayoutGrid, FolderOpen, Key, Search, X, Pencil, Trash2, ChevronRight, Lock, KeyRound, Unlock, Download } from 'lucide-react';
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
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-overlay-0/60" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/[0.04] rounded-xl 
              pl-9 pr-8 py-2 text-sm text-text 
              placeholder:text-overlay-0/50
              focus:outline-none focus:border-blue/30 focus:ring-2 focus:ring-blue/10
              transition-all duration-200"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-overlay-0/60 hover:text-text hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* View Mode Tabs (Pill Style) */}
      {!showingSearch && (
        <div className="flex mx-3 mb-3 p-1 bg-black/20 rounded-xl">
          {(['recent', 'all', 'groups', 'ssh-config'] as ViewMode[]).map((mode) => {
            const icons = {
              recent: Clock,
              all: LayoutGrid,
              groups: FolderOpen,
              'ssh-config': Key,
            };
            const Icon = icons[mode];
            const labels = {
              recent: 'Recent',
              all: 'All',
              groups: 'Groups',
              'ssh-config': 'SSH',
            };
            
            return (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg transition-all duration-200
                  ${viewMode === mode
                    ? 'bg-surface-1/80 text-text shadow-sm'
                    : 'text-overlay-1 hover:text-text hover:bg-white/[0.03]'
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{labels[mode]}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue" />
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red text-sm">{error}</div>
        ) : showingSearch ? (
          // Search Results
          <div className="p-3">
            {filteredConnections.length === 0 ? (
              <div className="text-center text-overlay-0 text-sm py-4">
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
          <div className="p-3">
            {recentConnections.length === 0 ? (
              <div className="text-center text-overlay-0 text-sm py-8">
                No recent connections.<br />
                <button
                  onClick={onNewConnection}
                  className="text-blue hover:text-blue/80 mt-2 transition-colors"
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
          <div className="p-3">
            {connections.length === 0 ? (
              <div className="text-center text-overlay-0 text-sm py-8">
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
          <div className="p-3">
            {Object.keys(groupedConnections).length === 0 ? (
              <div className="text-center text-overlay-0 text-sm py-8">
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
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-overlay-1 hover:text-text rounded-lg hover:bg-white/[0.03] transition-colors"
                      >
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
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
          <div className="p-3">
            {sshHosts.length === 0 ? (
              <div className="text-center text-overlay-0 text-sm py-8">
                No hosts found in ~/.ssh/config
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <button
                    onClick={() => onImportFromSsh(sshHosts)}
                    className="w-full flex items-center justify-center gap-2 text-xs bg-white/[0.04] hover:bg-white/[0.08] text-subtext-0 hover:text-text border border-white/[0.02] hover:border-white/[0.06] px-3 py-2 rounded-xl transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
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
  const AuthIcon = {
    password: Lock,
    key: KeyRound,
    agent: Unlock,
  }[connection.authType];

  return (
    <div
      onClick={onConnect}
      className={`
        group flex items-center gap-3 px-3 rounded-xl cursor-pointer
        bg-transparent hover:bg-white/[0.03] 
        border border-transparent hover:border-white/[0.04]
        transition-all duration-200
        ${compact ? 'py-2' : 'py-2.5'}
      `}
    >
      {/* Color indicator */}
      <div
        className="w-2 h-2 rounded-full flex-shrink-0 ring-2 ring-white/10"
        style={{ backgroundColor: connection.color || '#89b4fa' }}
      />
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium text-text truncate ${compact ? 'text-xs' : 'text-sm'}`}>
            {connection.name}
          </span>
          <AuthIcon className="w-3 h-3 text-overlay-0/60 flex-shrink-0" />
        </div>
        {!compact && (
          <div className="text-xs text-overlay-0 truncate mt-0.5">
            {connection.username}@{connection.host}:{connection.port}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1.5 rounded-lg text-overlay-0/60 hover:text-text hover:bg-white/[0.06] transition-colors"
          title="Edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-overlay-0/60 hover:text-red hover:bg-red/10 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
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
      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer
        bg-transparent hover:bg-white/[0.03] 
        border border-transparent hover:border-white/[0.04]
        transition-all duration-200"
    >
      <Key className="w-4 h-4 text-overlay-0/60 flex-shrink-0" />
      
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text truncate">
          {host.alias}
        </div>
        <div className="text-xs text-overlay-0 truncate mt-0.5">
          {host.user || '~'}@{host.hostname}:{host.port}
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onImport();
        }}
        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue/15 hover:bg-blue/25 text-blue border border-blue/10 hover:border-blue/20 rounded-lg transition-all"
      >
        <Download className="w-3 h-3" />
        Import
      </button>
    </div>
  );
}
