import { useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface JumpServer {
  id: string;
  host: string;
  port: string;
  username: string;
  authType: 'password' | 'key' | 'default_key';
  password?: string;
  keyPath?: string;
  passphrase?: string;
}

interface AddJumpServerDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (server: JumpServer) => void;
}

export const AddJumpServerDialog: React.FC<AddJumpServerDialogProps> = ({
  open,
  onClose,
  onAdd
}) => {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [authType, setAuthType] = useState<'password' | 'key' | 'default_key'>('key');
  const [password, setPassword] = useState('');
  const [keyPath, setKeyPath] = useState('');
  const [passphrase, setPassphrase] = useState<string>('');

  const handleBrowseKey = async () => {
    try {
      const selected = await openDialog({
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

  const handleAdd = () => {
    if (!host || !username) return;

    onAdd({
      id: crypto.randomUUID(),
      host,
      port: port || '22',
      username,
      authType,
      password: authType === 'password' ? password : undefined,
      keyPath: authType === 'key' ? keyPath : undefined,
      passphrase: authType === 'key' ? passphrase || undefined : undefined,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Jump Server</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3 space-y-2">
              <Label htmlFor="jump-host">Host *</Label>
              <Input
                id="jump-host"
                placeholder="bastion.example.com"
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
            </div>
            <div className="col-span-1 space-y-2">
              <Label htmlFor="jump-port">Port</Label>
              <Input
                id="jump-port"
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jump-username">Username *</Label>
            <Input
              id="jump-username"
              placeholder="jumpuser"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Authentication</Label>
            <Tabs
              value={authType}
              onValueChange={(v) => setAuthType(v as any)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="default_key">Default Key</TabsTrigger>
                <TabsTrigger value="key">SSH Key</TabsTrigger>
                <TabsTrigger value="password">Password</TabsTrigger>
              </TabsList>

              <TabsContent value="default_key">
                <div className="text-sm text-zinc-500 pt-2">
                  Use default SSH key (~/.ssh/id_rsa, etc.)
                </div>
              </TabsContent>

              <TabsContent value="key">
                <div className="space-y-2 pt-2">
                  <Label htmlFor="jump-keypath">Key Path</Label>
                  <div className="flex gap-2">
                    <Input
                      id="jump-keypath"
                      value={keyPath}
                      onChange={(e) => setKeyPath(e.target.value)}
                      placeholder="~/.ssh/id_rsa"
                    />
                    <Button variant="outline" onClick={handleBrowseKey} type="button">Browse</Button>
                  </div>
                  <div className="space-y-1 pt-1">
                    <Label htmlFor="jump-passphrase" className="text-sm font-normal">Passphrase (Optional)</Label>
                    <Input
                      id="jump-passphrase"
                      type="password"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="password">
                <div className="space-y-2 pt-2">
                  <Label htmlFor="jump-password">Password</Label>
                  <Input
                    id="jump-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!host || !username}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
