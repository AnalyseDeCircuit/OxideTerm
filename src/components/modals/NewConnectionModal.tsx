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
import { ConnectRequest } from '../../types';
import { api } from '../../lib/api';

export const NewConnectionModal = () => {
  const { modals, toggleModal, connect } = useAppStore();
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('root');
  const [authType, setAuthType] = useState<'password' | 'key' | 'default_key'>('password');
  const [password, setPassword] = useState('');
  const [keyPath, setKeyPath] = useState('');
  const [saveConnection, setSaveConnection] = useState(false);
  const [group, setGroup] = useState('');
  const [groups, setGroups] = useState<string[]>([]);

  // Load groups when modal opens
  useEffect(() => {
    if (modals.newConnection) {
      api.getGroups().then(setGroups).catch(() => setGroups([]));
    }
  }, [modals.newConnection]);

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

  const handleConnect = async () => {
    if (!host || !username) return;
    
    setLoading(true);
    try {
      const request: ConnectRequest = {
        name: name || undefined,
        host,
        port: parseInt(port) || 22,
        username,
        auth_type: authType,
        password: authType === 'password' ? password : undefined,
        key_path: authType === 'key' ? keyPath : undefined,
        group: saveConnection ? group : undefined
      };
      
      await connect(request);
      toggleModal('newConnection', false);
      
      // Reset sensitive fields if not saved (TODO: Implement saving logic separately)
      setPassword('');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={modals.newConnection} onOpenChange={(open) => toggleModal('newConnection', open)}>
      <DialogContent className="sm:max-w-[425px]" aria-describedby="new-connection-description">
        <DialogHeader>
          <DialogTitle>New Connection</DialogTitle>
          <DialogDescription id="new-connection-description">
            Enter the details for your new SSH connection.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4 px-6">
          <div className="grid gap-2">
            <Label htmlFor="name">Name (Optional)</Label>
            <Input 
              id="name" 
              placeholder="My Server" 
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3 grid gap-2">
              <Label htmlFor="host">Host *</Label>
              <Input 
                id="host" 
                placeholder="192.168.1.100" 
                value={host}
                onChange={(e) => setHost(e.target.value)}
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
            <Label htmlFor="username">Username *</Label>
            <Input 
              id="username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Authentication</Label>
            <Tabs 
              value={authType} 
              onValueChange={(v) => setAuthType(v as any)} 
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="password">Password</TabsTrigger>
                <TabsTrigger value="key">SSH Key</TabsTrigger>
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
            </Tabs>
          </div>

          <div className="grid gap-2">
            <Label>Group (Optional)</Label>
            <Select value={group} onValueChange={setGroup}>
              <SelectTrigger>
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                {groups.map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
                {groups.length === 0 && (
                  <SelectItem value="_none" disabled>No groups - create in Settings</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2 border-t border-theme-border pt-4">
            <Checkbox 
              id="save-conn" 
              checked={saveConnection}
              onCheckedChange={(c) => setSaveConnection(!!c)}
            />
            <Label htmlFor="save-conn">Save connection for future use</Label>
          </div>
        </div>

        <DialogFooter>
           <Button variant="ghost" onClick={() => toggleModal('newConnection', false)}>Cancel</Button>
           <Button onClick={handleConnect} disabled={loading || !host || !username}>
             {loading ? 'Connecting...' : 'Connect'}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
