import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useAppStore } from '../../store/appStore';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '../ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import { ConnectRequest, ProxyHopConfig, SshConnectRequest } from '../../types';
import { api } from '../../lib/api';
import { AddJumpServerDialog } from './AddJumpServerDialog';
import { Plus, Trash2, Key, Lock, ChevronDown, ChevronRight, Link2 } from 'lucide-react';
export const NewConnectionModal = () => {
  const { 
    modals, 
    toggleModal, 
    connect, 
    connectSsh, 
    connections 
  } = useAppStore();
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('root');
  const [authType, setAuthType] = useState<'password' | 'key' | 'default_key' | 'agent'>('password');
  const [password, setPassword] = useState('');
  const [keyPath, setKeyPath] = useState('');
  const [saveConnection, setSaveConnection] = useState(false);
  const [group, setGroup] = useState('Ungrouped');
  const [groups, setGroups] = useState<string[]>([]);

  const [proxyServers, setProxyServers] = useState<ProxyHopConfig[]>([]);
  const [showAddJumpDialog, setShowAddJumpDialog] = useState(false);
  const [proxyChainExpanded, setProxyChainExpanded] = useState(false);
  
  // 新增：连接池模式选项
  const [useConnectionPool] = useState(true); // TODO: 未来可添加 UI 开关
  const [reuseConnection, setReuseConnection] = useState(true);
  const [existingConnectionId, setExistingConnectionId] = useState<string | null>(null);

  // Type-safe auth type handler
  const handleAuthTypeChange = (value: string) => {
    if (value === 'password' || value === 'key' || value === 'default_key' || value === 'agent') {
      setAuthType(value);
    }
  };

  // Load groups when modal opens
  useEffect(() => {
    if (modals.newConnection) {
      api.getGroups().then(setGroups).catch(() => setGroups([]));
    }
  }, [modals.newConnection]);

  // 检查是否有可复用的连接
  useEffect(() => {
    if (modals.newConnection && host && username && useConnectionPool) {
      const portNum = parseInt(port) || 22;
      // 查找匹配的活跃连接
      const matching = Array.from(connections.values()).find(conn => 
        conn.host === host && 
        conn.port === portNum && 
        conn.username === username &&
        (conn.state === 'active' || conn.state === 'idle')
      );
      setExistingConnectionId(matching?.id || null);
    } else {
      setExistingConnectionId(null);
    }
  }, [modals.newConnection, host, port, username, useConnectionPool, connections]);

  const handleBrowseKey = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        title: 'Select SSH Key',
        defaultPath: '~/.ssh'
      });
      if (selected && typeof selected === 'string') {
        setKeyPath(selected);
      }
    } catch (e) {
      console.error('Failed to open file dialog:', e);
    }
  };

  // Convert JumpServer from dialog to ProxyHopConfig for backend
  const handleAddJumpServer = (server: { 
    id: string; 
    host: string; 
    port: string; 
    username: string; 
    authType: 'password' | 'key' | 'default_key' | 'agent';
    password?: string;
    keyPath?: string;
    passphrase?: string;
  }) => {
    const proxyConfig: ProxyHopConfig = {
      id: server.id,
      host: server.host,
      port: parseInt(server.port, 10) || 22,
      username: server.username,
      auth_type: server.authType,
      password: server.password,
      key_path: server.keyPath,
      passphrase: server.passphrase,
    };
    setProxyServers([...proxyServers, proxyConfig]);
  };

  const handleRemoveJumpServer = (index: number) => {
    const newServers = proxyServers.filter((_, i) => i !== index);
    setProxyServers(newServers);
  };

  const canConnect = () => {
    if (proxyServers.length > 0) {
      return proxyServers.every(server => server.host && server.username);
    }
    return host && username;
  };

  const handleConnect = async () => {
    if (proxyServers.length > 0) {
      if (!proxyServers.every(server => server.host && server.username)) return;
    } else {
      if (!host || !username) return;
    }

    setLoading(true);
    try {
      // Get buffer configuration from settings
      const settings = JSON.parse(localStorage.getItem('oxide-settings') || '{}');
      const bufferConfig = {
        max_lines: settings.bufferMaxLines || 100000,
        save_on_disconnect: settings.bufferSaveOnDisconnect !== false,
      };

      // 使用新的连接池 API（无跳板机时）
      if (useConnectionPool && proxyServers.length === 0) {
        // 如果选择复用且有现有连接，直接关闭对话框
        if (reuseConnection && existingConnectionId) {
          // 连接已存在，无需操作
        } else {
          // 创建新连接（不自动创建终端）
          const sshRequest: SshConnectRequest = {
            host,
            port: parseInt(port) || 22,
            username,
            authType,
            password: authType === 'password' ? password : undefined,
            keyPath: authType === 'key' ? keyPath : undefined,
            name: name || undefined,
            reuseConnection: false, // 强制新建
          };
          
          await connectSsh(sshRequest);
        }
        
        // 如果需要保存连接配置
        if (saveConnection) {
          // default_key 保存时作为 key 类型
          const saveAuthType = authType === 'default_key' ? 'key' : authType;
          await api.saveConnection({
            name: name || `${username}@${host}`,
            group: group || null,
            host,
            port: parseInt(port) || 22,
            username,
            auth_type: saveAuthType as 'password' | 'key' | 'agent',
            password: authType === 'password' ? password : undefined,
            key_path: authType === 'key' ? keyPath : undefined,
          });
        }
      } else {
        // 回退到旧 API（有跳板机或禁用连接池）
        const request: ConnectRequest = {
          name: name || undefined,
          host,
          port: parseInt(port) || 22,
          username,
          auth_type: authType,
          password: authType === 'password' ? password : undefined,
          key_path: authType === 'key' ? keyPath : undefined,
          group: saveConnection ? (group || undefined) : undefined,
          proxy_chain: proxyServers.length > 0 ? proxyServers : undefined,
          buffer_config: bufferConfig,
        };

        await connect(request);
      }
      
      toggleModal('newConnection', false);

      // Reset sensitive fields if not saved
      setPassword('');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={modals.newConnection} onOpenChange={(open) => {
      // 关闭 modal 时清除敏感数据
      if (!open) {
        setPassword('');
        // 清除代理链中的密码
        setProxyServers(prev => prev.map(p => ({ ...p, password: undefined, passphrase: undefined })));
      }
      toggleModal('newConnection', open);
    }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" aria-describedby="new-connection-description">
        <DialogHeader>
          <DialogTitle>New Connection</DialogTitle>
          <DialogDescription id="new-connection-description">
            Enter details for your new SSH connection.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 p-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name (Optional)</Label>
              <Input 
                id="name" 
                placeholder="My Server" 
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* 连接复用提示 */}
            {existingConnectionId && useConnectionPool && proxyServers.length === 0 && (
              <div className="bg-green-900/20 border-l-4 border-green-500 rounded p-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-green-400" />
                    <span className="font-medium text-green-300">发现活跃连接</span>
                  </div>
                  <p className="text-sm text-green-200/80">
                    已有到 {username}@{host}:{port} 的活跃连接，可以直接复用
                  </p>
                  <div className="flex items-center space-x-2 pt-1">
                    <Checkbox 
                      id="reuse-conn" 
                      checked={reuseConnection}
                      onCheckedChange={(c) => setReuseConnection(!!c)}
                    />
                    <Label htmlFor="reuse-conn" className="text-sm text-green-200">
                      复用现有连接（推荐）
                    </Label>
                  </div>
                </div>
              </div>
            )}

            {proxyServers.length > 0 && (
              <div className="bg-theme-bg border-l-4 border-theme-border rounded p-3 mb-4">
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">ⓘ跳板机已配置</span>
                  </p>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                    {proxyServers.map((server, idx) => (
                      <div key={server.id} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-zinc-400" />
                        <span className="flex-1 truncate">
                          <span className="font-mono">{idx + 1}.</span>
                          <span className="ml-2">{server.username}@{server.host}:{server.port}</span>
                          {server.auth_type === 'key' || server.auth_type === 'default_key' ? (
                            <Key className="inline-block h-3.5 w-3.5 text-zinc-500 ml-1" />
                          ) : (
                            <Lock className="inline-block h-3.5 w-3.5 text-zinc-500 ml-1" />
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3 grid gap-2">
                <Label htmlFor="host">Target Host *</Label>
                <Input
                  id="host"
                  placeholder="192.168.1.100"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className={proxyServers.length > 0 && !host ? 'border-orange-500' : ''}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="username">Target Username *</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={proxyServers.length > 0 && !username ? 'border-orange-500' : ''}
              />
            </div>

            <div className="grid gap-2">
              <Label>Authentication</Label>
              <Tabs
                value={authType}
                onValueChange={handleAuthTypeChange}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="password">Password</TabsTrigger>
                  <TabsTrigger value="default_key">Default Key</TabsTrigger>
                  <TabsTrigger value="key">SSH Key</TabsTrigger>
                  <TabsTrigger value="agent">SSH Agent</TabsTrigger>
                </TabsList>
                
                <TabsContent value="password">
                  <div className="grid gap-2 pt-2">
                    <Label htmlFor="password">Password</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <div className="flex items-center space-x-2 pt-1">
                       <Checkbox id="save-pass" />
                       <Label htmlFor="save-pass" className="font-normal">Save password to keychain</Label>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="key">
                   <div className="grid gap-2 pt-2">
                     <Label htmlFor="keypath">Key File</Label>
                     <div className="flex gap-2">
                        <Input 
                          id="keypath" 
                          value={keyPath}
                          onChange={(e) => setKeyPath(e.target.value)}
                          placeholder="~/.ssh/id_rsa"
                        />
                        <Button variant="outline" onClick={handleBrowseKey}>Browse</Button>
                     </div>
                   </div>
                </TabsContent>
                
                <TabsContent value="default_key">
                  <div className="text-sm text-zinc-500 pt-2">
                    使用默认 SSH 密钥 (~/.ssh/id_rsa, ~/.ssh/id_ed25519 等)
                  </div>
                </TabsContent>
                
                <TabsContent value="agent">
                  <div className="text-sm text-zinc-400 pt-2 space-y-2">
                    <p>使用系统 SSH Agent 进行认证</p>
                    <p className="text-xs text-zinc-500">
                      需要确保 SSH Agent 正在运行且包含所需密钥
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
   
            <div className="grid gap-2">
              <Label>Group</Label>
              <Select value={group} onValueChange={setGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ungrouped">Ungrouped</SelectItem>
                  {groups.map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                  {groups.length === 0 && (
                    <SelectItem value="_help" disabled className="text-zinc-500">Create groups in Settings</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
   
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="save-conn" 
                checked={saveConnection}
                onCheckedChange={(c) => setSaveConnection(!!c)}
              />
              <Label htmlFor="save-conn">Save connection for future use</Label>
            </div>
          </div>

          <div className="border-t border-theme-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">Proxy Chain</div>
              <div className="flex items-center gap-2">
                {proxyServers.length > 0 && (
                  <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setProxyChainExpanded(!proxyChainExpanded)}
                    >
                    {proxyChainExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddJumpDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Jump Server
                </Button>
              </div>
            </div>
   
            {proxyChainExpanded ? (
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {proxyServers.length === 0 ? (
                  <div className="text-center text-zinc-500 py-6">
                    No jump servers configured
                  </div>
                ) : (
                  <>
                    {proxyServers.map((server, index) => (
                      <div key={server.id} className="relative">
                        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2">
                          {index > 0 && (
                            <div className="absolute top-1/2 -translate-y-1/2 w-8 h-0.5 bg-zinc-600" />
                          )}
                          <div className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-theme-bg border-2 border-zinc-600 flex items-center justify-center">
                            {server.auth_type === 'key' || server.auth_type === 'default_key' ? (
                              <Key className="h-4 w-4 text-zinc-400" />
                            ) : (
                              <Lock className="h-4 w-4 text-zinc-400" />
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-6 pl-12">
                          <div className="flex-1 border border border-theme-border rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-medium text-zinc-600">
                                {index + 1}. Jump Server
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveJumpServer(index)}
                                className="h-6 w-6 p-0"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-zinc-400 hover:text-red-500" />
                              </Button>
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm">
                                <span className="text-zinc-500">Host:</span>
                                <span className="font-medium ml-2">{server.host}</span>
                              </div>
                              <div className="text-sm">
                                <span className="text-zinc-500">Port:</span>
                                <span className="font-medium ml-2">{server.port}</span>
                              </div>
                              <div className="text-sm">
                                <span className="text-zinc-500">Username:</span>
                                <span className="font-medium ml-2">{server.username}</span>
                              </div>
                              <div className="text-sm">
                                <span className="text-zinc-500">Auth:</span>
                                <span className="font-medium ml-2">
                                  {server.auth_type === 'key' ? 'SSH Key' :
                                   server.auth_type === 'default_key' ? 'Default Key' :
                                   'Password'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <div className="text-center text-zinc-500 py-6">
                {proxyServers.length === 0 ? (
                  'No jump servers configured'
                ) : (
                  `${proxyServers.length} jump server${proxyServers.length > 1 ? 's' : ''} configured - click to expand`
                )}
              </div>
            )}
          </div>
        </div>
   
        <DialogFooter>
           <Button variant="ghost" onClick={() => toggleModal('newConnection', false)}>Cancel</Button>
           <Button onClick={handleConnect} disabled={loading || !canConnect()}>
              {loading ? 'Connecting...' : 'Connect'}
           </Button>
        </DialogFooter>
      </DialogContent>
   
      <AddJumpServerDialog
        open={showAddJumpDialog}
        onClose={() => setShowAddJumpDialog(false)}
        onAdd={handleAddJumpServer}
      />
    </Dialog>
  );
 };
