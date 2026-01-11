import { useState, useEffect } from 'react';
import {
  ConnectionInfo,
  SaveConnectionRequest,
  SshHostInfo,
  saveConnection,
  getGroups,
} from '../lib/config';

interface ConnectionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (connection: ConnectionInfo) => void;
  /** Pass connection to edit, or undefined for new */
  editConnection?: ConnectionInfo;
  /** Pass SSH hosts to import */
  importHosts?: SshHostInfo[];
}

type AuthType = 'password' | 'key' | 'agent';

export function ConnectionFormModal({
  isOpen,
  onClose,
  onSaved,
  editConnection,
  importHosts,
}: ConnectionFormModalProps) {
  // Form state
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('');
  const [authType, setAuthType] = useState<AuthType>('key');
  const [password, setPassword] = useState('');
  const [keyPath, setKeyPath] = useState('');
  const [group, setGroup] = useState<string>('');
  const [color, setColor] = useState('#3b82f6');
  const [tags, setTags] = useState('');
  
  // UI state
  const [groups, setGroups] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importIndex, setImportIndex] = useState(0);

  // Load groups
  useEffect(() => {
    getGroups().then(setGroups).catch(console.error);
  }, []);

  // Reset form when modal opens
  useEffect(() => {
    if (!isOpen) return;
    
    if (editConnection) {
      // Edit mode
      setName(editConnection.name);
      setHost(editConnection.host);
      setPort(editConnection.port);
      setUsername(editConnection.username);
      setAuthType(editConnection.authType);
      setKeyPath(editConnection.keyPath || '');
      setPassword('');
      setGroup(editConnection.group || '');
      setColor(editConnection.color || '#3b82f6');
      setTags(editConnection.tags.join(', '));
    } else if (importHosts && importHosts.length > 0) {
      // Import mode - load first host
      loadHostData(importHosts[0]);
      setImportIndex(0);
    } else {
      // New mode
      resetForm();
    }
    
    setError(null);
  }, [isOpen, editConnection, importHosts]);

  const loadHostData = (host: SshHostInfo) => {
    setName(host.alias);
    setHost(host.hostname);
    setPort(host.port);
    setUsername(host.user || '');
    setAuthType(host.identityFile ? 'key' : 'agent');
    setKeyPath(host.identityFile || '');
    setPassword('');
    setGroup('Imported');
    setColor('#10b981'); // Green for imported
    setTags('ssh-config');
  };

  const resetForm = () => {
    setName('');
    setHost('');
    setPort(22);
    setUsername('');
    setAuthType('key');
    setPassword('');
    setKeyPath('~/.ssh/id_rsa');
    setGroup('');
    setColor('#3b82f6');
    setTags('');
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

      const request: SaveConnectionRequest = {
        id: editConnection?.id,
        name: name.trim(),
        host: host.trim(),
        port,
        username: username.trim(),
        authType,
        password: authType === 'password' && password ? password : undefined,
        keyPath: authType === 'key' ? keyPath.trim() : undefined,
        group: group.trim() || null,
        color,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
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
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save connection');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const isImporting = importHosts && importHosts.length > 0;
  const title = editConnection 
    ? 'Edit Connection' 
    : isImporting 
      ? `Import Connection (${importIndex + 1}/${importHosts.length})`
      : 'New Connection';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 text-sm px-3 py-2 rounded">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Connection Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Server"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Host & Port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Host
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="example.com"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Port
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value) || 22)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="root"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Auth Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Authentication
            </label>
            <div className="flex gap-2">
              {(['key', 'password', 'agent'] as AuthType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAuthType(type)}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors
                    ${authType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                >
                  {type === 'key' && '🔐 Key'}
                  {type === 'password' && '🔑 Password'}
                  {type === 'agent' && '🔓 Agent'}
                </button>
              ))}
            </div>
          </div>

          {/* Auth-specific fields */}
          {authType === 'password' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Password {editConnection && '(leave empty to keep current)'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Stored securely in system keychain
              </p>
            </div>
          )}

          {authType === 'key' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Private Key Path
              </label>
              <input
                type="text"
                value={keyPath}
                onChange={(e) => setKeyPath(e.target.value)}
                placeholder="~/.ssh/id_rsa"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {authType === 'agent' && (
            <div className="text-sm text-gray-500 bg-gray-800 rounded px-3 py-2">
              Will use SSH agent for authentication. Make sure your key is added to the agent.
            </div>
          )}

          {/* Group */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Group
            </label>
            <input
              type="text"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              list="groups-list"
              placeholder="Work, Personal, etc."
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
            <datalist id="groups-list">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded border border-gray-700 cursor-pointer"
              />
              <div className="flex gap-1">
                {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded ${color === c ? 'ring-2 ring-white' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="production, linux, web"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : isImporting ? 'Import & Next' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
