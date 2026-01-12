/**
 * ConnectionForm Component (Refactored)
 * 
 * Form for creating/editing SSH connections,
 * using new UI components and validation.
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Server,
  User,
  Lock,
  Key,
  KeyRound,
  FolderOpen,
  Tag,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { slideUpVariants } from '@/lib/animations';
import {
  type ConnectionInfo,
  type SaveConnectionRequest,
  type SshHostInfo,
  saveConnection,
  getGroups,
} from '@/lib/config';

type AuthType = 'password' | 'key' | 'agent';

interface ConnectionFormProps {
  /** Pass connection to edit, or undefined for new */
  editConnection?: ConnectionInfo;
  /** Pass SSH hosts to import */
  importHosts?: SshHostInfo[];
  onSaved: (connection: ConnectionInfo) => void;
  onCancel: () => void;
  className?: string;
}

// Preset colors for connections
const CONNECTION_COLORS = [
  '#cba6f7', // Mauve
  '#89b4fa', // Blue
  '#a6e3a1', // Green
  '#f9e2af', // Yellow
  '#f38ba8', // Red
  '#fab387', // Peach
  '#94e2d5', // Teal
  '#f5c2e7', // Pink
];

export function ConnectionForm({
  editConnection,
  importHosts,
  onSaved,
  onCancel,
  className,
}: ConnectionFormProps) {
  // Form state
  const [name, setName] = React.useState('');
  const [host, setHost] = React.useState('');
  const [port, setPort] = React.useState(22);
  const [username, setUsername] = React.useState('');
  const [authType, setAuthType] = React.useState<AuthType>('key');
  const [password, setPassword] = React.useState('');
  const [keyPath, setKeyPath] = React.useState('~/.ssh/id_rsa');
  const [group, setGroup] = React.useState<string>('');
  const [newGroup, setNewGroup] = React.useState('');
  const [color, setColor] = React.useState(CONNECTION_COLORS[0]);
  const [tags, setTags] = React.useState('');

  // UI state
  const [groups, setGroups] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [importIndex, setImportIndex] = React.useState(0);

  // Load groups
  React.useEffect(() => {
    getGroups().then(setGroups).catch(console.error);
  }, []);

  // Initialize form
  React.useEffect(() => {
    if (editConnection) {
      // Edit mode
      setName(editConnection.name);
      setHost(editConnection.host);
      setPort(editConnection.port);
      setUsername(editConnection.username);
      setAuthType(editConnection.authType);
      setKeyPath(editConnection.keyPath || '~/.ssh/id_rsa');
      setPassword('');
      setGroup(editConnection.group || '');
      setColor(editConnection.color || CONNECTION_COLORS[0]);
      setTags(editConnection.tags.join(', '));
    } else if (importHosts && importHosts.length > 0) {
      // Import mode
      loadHostData(importHosts[0]);
      setImportIndex(0);
    }
  }, [editConnection, importHosts]);

  const loadHostData = (hostInfo: SshHostInfo) => {
    setName(hostInfo.alias);
    setHost(hostInfo.hostname);
    setPort(hostInfo.port);
    setUsername(hostInfo.user || '');
    setAuthType(hostInfo.identityFile ? 'key' : 'agent');
    setKeyPath(hostInfo.identityFile || '~/.ssh/id_rsa');
    setPassword('');
    setGroup('Imported');
    setColor(CONNECTION_COLORS[2]); // Green for imported
    setTags('ssh-config');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Validation
      if (!name.trim()) throw new Error('Name is required');
      if (!host.trim()) throw new Error('Host is required');
      if (!username.trim()) throw new Error('Username is required');
      if (authType === 'password' && !password && !editConnection) {
        throw new Error('Password is required');
      }
      if (authType === 'key' && !keyPath.trim()) {
        throw new Error('Key path is required');
      }

      const finalGroup = newGroup.trim() || group;

      const request: SaveConnectionRequest = {
        id: editConnection?.id,
        name: name.trim(),
        host: host.trim(),
        port,
        username: username.trim(),
        authType,
        password: authType === 'password' && password ? password : undefined,
        keyPath: authType === 'key' ? keyPath.trim() : undefined,
        group: finalGroup || null,
        color,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };

      const saved = await saveConnection(request);

      // If importing multiple hosts, continue to next
      if (importHosts && importIndex < importHosts.length - 1) {
        const nextIndex = importIndex + 1;
        setImportIndex(nextIndex);
        loadHostData(importHosts[nextIndex]);
        onSaved(saved);
      } else {
        onSaved(saved);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save connection');
    } finally {
      setIsLoading(false);
    }
  };

  const isImporting = importHosts && importHosts.length > 0;
  const importProgress = isImporting
    ? `${importIndex + 1} / ${importHosts.length}`
    : null;

  return (
    <motion.form
      variants={slideUpVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onSubmit={handleSubmit}
      className={cn('flex flex-col gap-4', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">
          {editConnection
            ? 'Edit Connection'
            : isImporting
            ? 'Import Connection'
            : 'New Connection'}
        </h2>
        {importProgress && (
          <Badge variant="primary">{importProgress}</Badge>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-3 py-2 rounded-md bg-red/10 border border-red/20 text-sm text-red">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label htmlFor="name">Connection Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Server"
            leftIcon={<Server size={14} />}
          />
        </div>

        <div>
          <Label htmlFor="host">Host</Label>
          <Input
            id="host"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="192.168.1.1"
          />
        </div>

        <div>
          <Label htmlFor="port">Port</Label>
          <Input
            id="port"
            type="number"
            value={port}
            onChange={(e) => setPort(parseInt(e.target.value) || 22)}
            min={1}
            max={65535}
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="root"
            leftIcon={<User size={14} />}
          />
        </div>
      </div>

      {/* Authentication */}
      <div>
        <Label>Authentication</Label>
        <Tabs value={authType} onValueChange={(v) => setAuthType(v as AuthType)}>
          <TabsList className="w-full">
            <TabsTrigger value="key" className="flex-1 gap-1.5">
              <Key size={12} />
              SSH Key
            </TabsTrigger>
            <TabsTrigger value="password" className="flex-1 gap-1.5">
              <Lock size={12} />
              Password
            </TabsTrigger>
            <TabsTrigger value="agent" className="flex-1 gap-1.5">
              <KeyRound size={12} />
              Agent
            </TabsTrigger>
          </TabsList>

          <TabsContent value="key" className="mt-3">
            <Input
              value={keyPath}
              onChange={(e) => setKeyPath(e.target.value)}
              placeholder="~/.ssh/id_rsa"
              leftIcon={<Key size={14} />}
            />
          </TabsContent>

          <TabsContent value="password" className="mt-3">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={editConnection ? '(unchanged)' : 'Enter password'}
              leftIcon={<Lock size={14} />}
            />
          </TabsContent>

          <TabsContent value="agent" className="mt-3">
            <p className="text-xs text-overlay-1">
              Using system SSH agent for authentication
            </p>
          </TabsContent>
        </Tabs>
      </div>

      {/* Organization */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="group">Group</Label>
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger>
              <SelectValue placeholder="Select group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No group</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="newGroup">Or create new</Label>
          <Input
            id="newGroup"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            placeholder="New group name"
            leftIcon={<FolderOpen size={14} />}
          />
        </div>
      </div>

      {/* Color & Tags */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Color</Label>
          <div className="flex items-center gap-1.5 mt-1">
            {CONNECTION_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  'w-6 h-6 rounded-md transition-transform',
                  color === c && 'ring-2 ring-offset-2 ring-offset-base ring-white/20 scale-110'
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="production, web"
            leftIcon={<Tag size={14} />}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={isLoading}>
          {isLoading && <Loader2 size={14} className="animate-spin" />}
          {editConnection ? 'Save Changes' : isImporting ? 'Import & Next' : 'Create'}
        </Button>
      </div>
    </motion.form>
  );
}
