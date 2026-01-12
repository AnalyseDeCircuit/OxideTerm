/**
 * ConnectionList Component (Refactored)
 * 
 * Displays connections organized by groups with search,
 * using new UI components and design system.
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  ChevronRight,
  Clock,
  FolderOpen,
  Download,
  Server,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { ConnectionCard, type ConnectionStatus } from './ConnectionCard';
import {
  type ConnectionInfo,
  type SshHostInfo,
  getConnections,
  getRecentConnections,
  searchConnections,
  getGroups,
  listSshConfigHosts,
  deleteConnection,
  markConnectionUsed,
} from '@/lib/config';

interface ConnectionListProps {
  onConnect: (connection: ConnectionInfo) => void;
  onEdit: (connection: ConnectionInfo) => void;
  onNewConnection: () => void;
  onImportFromSsh?: (hosts: SshHostInfo[]) => void;
  /** Map of connection ID to current status */
  connectionStatuses?: Map<string, ConnectionStatus>;
  /** Currently active connection ID */
  activeConnectionId?: string | null;
  className?: string;
}

export function ConnectionList({
  onConnect,
  onEdit,
  onNewConnection,
  onImportFromSsh,
  connectionStatuses = new Map(),
  activeConnectionId,
  className,
}: ConnectionListProps) {
  const [connections, setConnections] = React.useState<ConnectionInfo[]>([]);
  const [recentConnections, setRecentConnections] = React.useState<ConnectionInfo[]>([]);
  const [groups, setGroups] = React.useState<string[]>([]);
  const [sshHosts, setSshHosts] = React.useState<SshHostInfo[]>([]);
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
    new Set(['Recent', 'Ungrouped'])
  );
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filteredConnections, setFilteredConnections] = React.useState<ConnectionInfo[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Load connections
  const loadConnections = React.useCallback(async () => {
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
  const loadSshHosts = React.useCallback(async () => {
    try {
      const hosts = await listSshConfigHosts();
      setSshHosts(hosts);
    } catch (err) {
      console.error('Failed to load SSH config:', err);
    }
  }, []);

  // Initial load
  React.useEffect(() => {
    loadConnections();
    loadSshHosts();
  }, [loadConnections, loadSshHosts]);

  // Search effect
  React.useEffect(() => {
    if (searchQuery.trim()) {
      searchConnections(searchQuery)
        .then(setFilteredConnections)
        .catch(console.error);
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
  const handleDelete = async (conn: ConnectionInfo) => {
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
  const groupedConnections = React.useMemo(() => {
    return connections.reduce<Record<string, ConnectionInfo[]>>((acc, conn) => {
      const group = conn.group || 'Ungrouped';
      if (!acc[group]) acc[group] = [];
      acc[group].push(conn);
      return acc;
    }, {});
  }, [connections]);

  const showingSearch = searchQuery.trim().length > 0;

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex flex-col gap-3 p-3', className)}>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-6 text-center', className)}>
        <Server className="w-10 h-10 text-overlay-1 mb-3" />
        <p className="text-sm text-red mb-2">Failed to load connections</p>
        <p className="text-xs text-overlay-1 mb-4">{error}</p>
        <Button variant="secondary" size="sm" onClick={loadConnections}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Search */}
      <div className="p-3 space-y-2">
        <Input
          placeholder="Search connections..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search size={14} />}
          className="h-8"
        />

        {/* New Connection Button */}
        <Button
          variant="primary"
          size="sm"
          onClick={onNewConnection}
          className="w-full"
        >
          <Plus size={14} />
          New Connection
        </Button>
      </div>

      {/* Connection List */}
      <ScrollArea className="flex-1">
        <div className="px-2 pb-3">
          {/* Search Results */}
          {showingSearch ? (
            <div className="space-y-1">
              {filteredConnections.length === 0 ? (
                <EmptyState
                  icon={<Search size={24} />}
                  title="No results"
                  description={`No connections matching "${searchQuery}"`}
                />
              ) : (
                filteredConnections.map((conn) => (
                  <ConnectionCard
                    key={conn.id}
                    connection={conn}
                    status={connectionStatuses.get(conn.id)}
                    isActive={conn.id === activeConnectionId}
                    onConnect={handleConnect}
                    onEdit={onEdit}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </div>
          ) : (
            <>
              {/* Recent Section */}
              {recentConnections.length > 0 && (
                <ConnectionGroup
                  title="Recent"
                  icon={<Clock size={12} />}
                  count={recentConnections.length}
                  isExpanded={expandedGroups.has('Recent')}
                  onToggle={() => toggleGroup('Recent')}
                >
                  {recentConnections.map((conn) => (
                    <ConnectionCard
                      key={conn.id}
                      connection={conn}
                      status={connectionStatuses.get(conn.id)}
                      isActive={conn.id === activeConnectionId}
                      onConnect={handleConnect}
                      onEdit={onEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </ConnectionGroup>
              )}

              {/* Grouped Connections */}
              {groups.map((group) => (
                <ConnectionGroup
                  key={group}
                  title={group}
                  icon={<FolderOpen size={12} />}
                  count={groupedConnections[group]?.length || 0}
                  isExpanded={expandedGroups.has(group)}
                  onToggle={() => toggleGroup(group)}
                >
                  {groupedConnections[group]?.map((conn) => (
                    <ConnectionCard
                      key={conn.id}
                      connection={conn}
                      status={connectionStatuses.get(conn.id)}
                      isActive={conn.id === activeConnectionId}
                      onConnect={handleConnect}
                      onEdit={onEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </ConnectionGroup>
              ))}

              {/* Ungrouped */}
              {groupedConnections['Ungrouped']?.length > 0 && (
                <ConnectionGroup
                  title="Ungrouped"
                  icon={<Server size={12} />}
                  count={groupedConnections['Ungrouped'].length}
                  isExpanded={expandedGroups.has('Ungrouped')}
                  onToggle={() => toggleGroup('Ungrouped')}
                >
                  {groupedConnections['Ungrouped'].map((conn) => (
                    <ConnectionCard
                      key={conn.id}
                      connection={conn}
                      status={connectionStatuses.get(conn.id)}
                      isActive={conn.id === activeConnectionId}
                      onConnect={handleConnect}
                      onEdit={onEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </ConnectionGroup>
              )}

              {/* SSH Config Import */}
              {sshHosts.length > 0 && onImportFromSsh && (
                <div className="mt-4 pt-4 border-t border-surface-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onImportFromSsh(sshHosts)}
                    className="w-full text-overlay-1 hover:text-text"
                  >
                    <Download size={14} />
                    Import from SSH Config ({sshHosts.length})
                  </Button>
                </div>
              )}

              {/* Empty State */}
              {connections.length === 0 && (
                <EmptyState
                  icon={<Server size={32} />}
                  title="No connections yet"
                  description="Create your first SSH connection to get started"
                  action={
                    <Button variant="primary" size="sm" onClick={onNewConnection}>
                      <Plus size={14} />
                      New Connection
                    </Button>
                  }
                />
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================
// Connection Group Component
// ============================================

interface ConnectionGroupProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function ConnectionGroup({
  title,
  icon,
  count,
  isExpanded,
  onToggle,
  children,
}: ConnectionGroupProps) {
  return (
    <div className="mb-2">
      {/* Header */}
      <button
        onClick={onToggle}
        className={cn(
          'flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md',
          'text-xs font-medium text-overlay-1 uppercase tracking-wider',
          'hover:bg-surface-0/50 transition-colors'
        )}
      >
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronRight size={12} />
        </motion.div>
        {icon}
        <span className="flex-1 text-left">{title}</span>
        <Badge variant="secondary" size="sm">
          {count}
        </Badge>
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pl-2 space-y-0.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Empty State Component
// ============================================

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="text-overlay-1 mb-3">{icon}</div>
      <h3 className="text-sm font-medium text-text mb-1">{title}</h3>
      <p className="text-xs text-overlay-1 mb-4 max-w-[200px]">{description}</p>
      {action}
    </div>
  );
}
