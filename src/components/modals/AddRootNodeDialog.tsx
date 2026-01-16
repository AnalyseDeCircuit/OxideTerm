/**
 * Add Root Node Dialog
 * 
 * 添加根节点到 Session Tree
 */

import { useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Loader2, Plus, Server } from 'lucide-react';
import { api } from '../../lib/api';

interface AddRootNodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (nodeId: string) => void;
}

export const AddRootNodeDialog: React.FC<AddRootNodeDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  // 表单状态
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authType, setAuthType] = useState<'password' | 'key' | 'agent'>('agent');
  const [password, setPassword] = useState('');
  const [keyPath, setKeyPath] = useState('');
  const [passphrase, setPassphrase] = useState('');
  
  // 加载状态
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuthTypeChange = (value: string) => {
    if (value === 'password' || value === 'key' || value === 'agent') {
      setAuthType(value);
    }
  };

  const resetForm = () => {
    setHost('');
    setPort('22');
    setUsername('');
    setDisplayName('');
    setAuthType('agent');
    setPassword('');
    setKeyPath('');
    setPassphrase('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleBrowseKey = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        directory: false,
        title: '选择 SSH 私钥',
        defaultPath: '~/.ssh',
      });
      if (selected) {
        setKeyPath(selected);
      }
    } catch (err) {
      console.error('Failed to open file dialog:', err);
    }
  };

  const handleAdd = async () => {
    if (!host || !username) return;

    setIsAdding(true);
    setError(null);

    try {
      // 添加根节点到树
      const nodeId = await api.addRootNode({
        host,
        port: parseInt(port) || 22,
        username,
        authType,
        password: authType === 'password' ? password : undefined,
        keyPath: authType === 'key' ? keyPath : undefined,
        passphrase: authType === 'key' && passphrase ? passphrase : undefined,
        displayName: displayName || undefined,
      });

      onSuccess?.(nodeId);
      handleClose();
    } catch (err) {
      console.error('Failed to add root node:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="w-5 h-5 text-green-400" />
            添加根节点
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 目标服务器信息 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label htmlFor="host">主机</Label>
              <Input
                id="host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="hostname or IP"
              />
            </div>
            <div>
              <Label htmlFor="port">端口</Label>
              <Input
                id="port"
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="22"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="root"
              />
            </div>
            <div>
              <Label htmlFor="displayName">显示名称（可选）</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="My Server"
              />
            </div>
          </div>

          {/* 认证方式 */}
          <div>
            <Label>认证方式</Label>
            <Tabs value={authType} onValueChange={handleAuthTypeChange} className="mt-2">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="agent">SSH Agent</TabsTrigger>
                <TabsTrigger value="key">密钥</TabsTrigger>
                <TabsTrigger value="password">密码</TabsTrigger>
              </TabsList>
              
              <TabsContent value="agent" className="mt-3">
                <p className="text-sm text-gray-400">
                  使用 SSH Agent 进行认证（推荐）
                </p>
              </TabsContent>
              
              <TabsContent value="key" className="mt-3 space-y-3">
                <div>
                  <Label htmlFor="keyPath">私钥路径</Label>
                  <div className="flex gap-2">
                    <Input
                      id="keyPath"
                      value={keyPath}
                      onChange={(e) => setKeyPath(e.target.value)}
                      placeholder="~/.ssh/id_rsa"
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" onClick={handleBrowseKey}>
                      浏览
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="passphrase">密钥密码（可选）</Label>
                  <Input
                    id="passphrase"
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="如果密钥有密码"
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="password" className="mt-3">
                <div>
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="SSH 密码"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button 
            onClick={handleAdd} 
            disabled={isAdding || !host || !username}
          >
            {isAdding ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                添加中...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                添加节点
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddRootNodeDialog;
