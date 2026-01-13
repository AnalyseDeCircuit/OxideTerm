import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ConnectionInfo } from '../../types';
import { useAppStore } from '../../store/appStore';
import { api } from '../../lib/api';

interface EditConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionInfo | null;
  onConnect?: () => void;
}

export const EditConnectionModal: React.FC<EditConnectionModalProps> = ({
  open,
  onOpenChange,
  connection,
  onConnect
}) => {
  const { groups, loadGroups } = useAppStore();
  const [password, setPassword] = useState('');
  const [keyPath, setKeyPath] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [authType, setAuthType] = useState<'password' | 'key'>('password');
  const [group, setGroup] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && connection) {
      // Map auth_type to modal's authType (only 'password' or 'key')
      const modalAuthType = connection.auth_type === 'password' ? 'password' : 'key';
      setAuthType(modalAuthType);
      setKeyPath(connection.key_path || '');
      setGroup(connection.group || '');
      setPassword('');
      setPassphrase('');
      setError('');
      loadGroups();
    }
  }, [open, connection, loadGroups]);

  const handleConnect = async () => {
    if (!connection) return;

    setIsConnecting(true);
    setError('');

    try {
      const { connect } = useAppStore.getState();
      await connect({
        host: connection.host,
        port: connection.port,
        username: connection.username,
        auth_type: authType,
        password: authType === 'password' ? password : undefined,
        key_path: authType === 'key' ? keyPath : undefined,
        passphrase: authType === 'key' && passphrase ? passphrase : undefined,
        name: connection.name,
        group: group || undefined,
      });

      // Mark as used
      await api.markConnectionUsed(connection.id);
      
      onOpenChange(false);
      if (onConnect) onConnect();
    } catch (e: any) {
      console.error('Failed to connect:', e);
      setError(e.message || 'Failed to connect. Please check your credentials.');
    } finally {
      setIsConnecting(false);
    }
  };

  if (!connection) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-theme-bg-panel border-theme-border text-theme-text">
        <DialogHeader>
          <DialogTitle className="text-theme-text">Connect to {connection.name}</DialogTitle>
          <DialogDescription className="text-theme-text-muted">
            {connection.username}@{connection.host}:{connection.port}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-3 py-2 rounded-sm text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-theme-text">Authentication Method</Label>
            <RadioGroup 
              value={authType} 
              onValueChange={(v: 'password' | 'key') => setAuthType(v)}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="password" id="auth-password" className="border-theme-border data-[state=checked]:bg-theme-accent" />
                <Label htmlFor="auth-password" className="text-theme-text">Password</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="key" id="auth-key" className="border-theme-border data-[state=checked]:bg-theme-accent" />
                <Label htmlFor="auth-key" className="text-theme-text">SSH Key</Label>
              </div>
            </RadioGroup>
          </div>

          {authType === 'password' ? (
            <div className="space-y-2">
              <Label htmlFor="password" className="text-theme-text">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-theme-bg-panel border-theme-border text-theme-text focus-visible:ring-theme-accent"
                autoFocus
              />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="key-path" className="text-theme-text">SSH Key Path</Label>
                <Input
                  id="key-path"
                  placeholder="~/.ssh/id_rsa"
                  value={keyPath}
                  onChange={(e) => setKeyPath(e.target.value)}
                  className="bg-theme-bg-panel border-theme-border text-theme-text focus-visible:ring-theme-accent"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passphrase" className="text-theme-text">Passphrase (if required)</Label>
                <Input
                  id="passphrase"
                  type="password"
                  placeholder="Key passphrase"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="bg-theme-bg-panel border-theme-border text-theme-text focus-visible:ring-theme-accent"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="group" className="text-theme-text">Group (Optional)</Label>
            <Select value={group} onValueChange={setGroup}>
              <SelectTrigger className="w-full bg-theme-bg-panel border-theme-border text-theme-text focus:ring-theme-accent">
                <SelectValue placeholder="No group" />
              </SelectTrigger>
              <SelectContent className="bg-theme-bg-panel border-theme-border text-theme-text">
                <SelectItem value="">No group</SelectItem>
                {groups.map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            disabled={isConnecting}
            className="text-theme-text-muted hover:text-theme-text"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConnect}
            disabled={isConnecting || (authType === 'password' && !password) || (authType === 'key' && !keyPath)}
            className="bg-theme-accent hover:bg-theme-accent-hover text-white"
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
