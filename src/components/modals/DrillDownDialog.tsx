import { useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Loader2, ArrowDownRight } from 'lucide-react';
import { api } from '../../lib/api';
import { useSessionTreeStore } from '../../store/sessionTreeStore';

interface DrillDownDialogProps {
  /** 父节点 ID */
  parentNodeId: string;
  /** 父节点主机名（用于显示） */
  parentHost: string;
  /** 对话框是否打开 */
  open: boolean;
  /** 关闭对话框回调 */
  onOpenChange: (open: boolean) => void;
  /** 成功后回调 */
  onSuccess?: (nodeId: string, sshConnectionId: string) => void;
}

export const DrillDownDialog: React.FC<DrillDownDialogProps> = ({
  parentNodeId,
  parentHost,
  open,
  onOpenChange,
  onSuccess,
}) => {
  // 表单状态
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [authType, setAuthType] = useState<'password' | 'key' | 'agent'>('agent');
  const [password, setPassword] = useState('');
  const [keyPath, setKeyPath] = useState('');
  const [passphrase, setPassphrase] = useState('');
  
  // 加载状态
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { fetchTree } = useSessionTreeStore();

  const handleAuthTypeChange = (value: string) => {
    if (value === 'password' || value === 'key' || value === 'agent') {
      setAuthType(value);
    }
  };

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

  const resetForm = () => {
    setHost('');
    setPort('22');
    setUsername('');
    setAuthType('agent');
    setPassword('');
    setKeyPath('');
    setPassphrase('');
    setError(null);
    setIsConnecting(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleDrillDown = async () => {
    if (!host || !username) return;

    setIsConnecting(true);
    setError(null);

    try {
      // 1. 调用 tree_drill_down 在树中添加子节点
      const nodeId = await api.treeDrillDown({
        parentNodeId,
        host,
        port: parseInt(port) || 22,
        username,
        authType,
        password: authType === 'password' ? password : undefined,
        keyPath: authType === 'key' ? keyPath : undefined,
        passphrase: authType === 'key' && passphrase ? passphrase : undefined,
      });

      // 2. 调用 connect_tree_node 建立实际连接
      const result = await api.connectTreeNode({
        nodeId,
        cols: 80,
        rows: 24,
      });

      // 3. 刷新树
      await fetchTree();

      // 4. 调用成功回调
      onSuccess?.(result.nodeId, result.sshConnectionId);

      // 5. 关闭对话框
      handleClose();
    } catch (err) {
      console.error('Drill down failed:', err);
      setError(err instanceof Error ? err.message : String(err));
      // 刷新树以显示失败状态
      await fetchTree();
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownRight className="w-5 h-5 text-blue-400" />
            钻入新服务器
          </DialogTitle>
          <p className="text-sm text-zinc-500 mt-1">
            从 <span className="text-white font-mono">{parentHost}</span> 建立隧道连接
          </p>
        </DialogHeader>

        <div className="space-y-4 p-4">
          {/* 错误提示 */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Host & Port */}
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3 space-y-2">
              <Label htmlFor="drill-host">目标主机 *</Label>
              <Input
                id="drill-host"
                placeholder="192.168.1.100 或 internal-server"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                disabled={isConnecting}
              />
            </div>
            <div className="col-span-1 space-y-2">
              <Label htmlFor="drill-port">端口</Label>
              <Input
                id="drill-port"
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                disabled={isConnecting}
              />
            </div>
          </div>

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="drill-username">用户名 *</Label>
            <Input
              id="drill-username"
              placeholder="root"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isConnecting}
            />
          </div>

          {/* Authentication */}
          <div className="space-y-2">
            <Label>认证方式</Label>
            <Tabs
              value={authType}
              onValueChange={handleAuthTypeChange}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="agent" disabled={isConnecting}>SSH Agent</TabsTrigger>
                <TabsTrigger value="key" disabled={isConnecting}>SSH Key</TabsTrigger>
                <TabsTrigger value="password" disabled={isConnecting}>密码</TabsTrigger>
              </TabsList>

                <TabsContent value="agent">
                <div className="text-sm text-zinc-400 pt-2 space-y-2">
                  <p>Authenticate using the system SSH Agent</p>
                  <p className="text-xs text-zinc-500">
                  Make sure your SSH Agent is running and contains the required key(s)
                  </p>
                </div>
                </TabsContent>

              <TabsContent value="key">
                <div className="space-y-2 pt-2">
                  <Label htmlFor="drill-keypath">密钥路径</Label>
                  <div className="flex gap-2">
                    <Input
                      id="drill-keypath"
                      value={keyPath}
                      onChange={(e) => setKeyPath(e.target.value)}
                      placeholder="~/.ssh/id_rsa"
                      disabled={isConnecting}
                    />
                    <Button 
                      variant="outline" 
                      onClick={handleBrowseKey} 
                      type="button"
                      disabled={isConnecting}
                    >
                      浏览
                    </Button>
                  </div>
                  <div className="space-y-1 pt-1">
                    <Label htmlFor="drill-passphrase" className="text-sm font-normal">密钥密码 (可选)</Label>
                    <Input
                      id="drill-passphrase"
                      type="password"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      disabled={isConnecting}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="password">
                <div className="space-y-2 pt-2">
                  <Label htmlFor="drill-password">密码</Label>
                  <Input
                    id="drill-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isConnecting}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={isConnecting}>
            取消
          </Button>
          <Button 
            onClick={handleDrillDown} 
            disabled={!host || !username || isConnecting}
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                连接中...
              </>
            ) : (
              <>
                <ArrowDownRight className="w-4 h-4 mr-2" />
                连接
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
