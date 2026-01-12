import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription
} from '../ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../ui/select';
import { Monitor, Key, Terminal as TerminalIcon, Shield, Plus, Trash2, FolderInput, X } from 'lucide-react';
import { api } from '../../lib/api';
import { SshKeyInfo, SshHostInfo } from '../../types';

// Extended persistence hook
const usePersistedSettings = () => {
    const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem('oxide-settings');
        const defaults = {
            // Terminal
            theme: 'default',
            fontFamily: 'jetbrains',
            fontSize: 14,
            lineHeight: 1.2,
            cursorStyle: 'block',
            cursorBlink: true,
            scrollback: 10000,
            
            // Appearance
            sidebarCollapsedDefault: false,
            
            // Connections
            defaultUsername: 'root',
            defaultPort: 22,
        };
        return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    });

    useEffect(() => {
        localStorage.setItem('oxide-settings', JSON.stringify(settings));
        window.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }));
    }, [settings]);

    const updateSetting = (key: string, value: any) => {
        setSettings((prev: any) => ({ ...prev, [key]: value }));
    };

    return { settings, updateSetting };
};

export const SettingsModal = () => {
  const { modals, toggleModal } = useAppStore();
  const [activeTab, setActiveTab] = useState('terminal');
  const { settings, updateSetting } = usePersistedSettings();
  
  // Data State
  const [keys, setKeys] = useState<SshKeyInfo[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [newGroup, setNewGroup] = useState('');
  const [sshHosts, setSshHosts] = useState<SshHostInfo[]>([]);
  
  useEffect(() => {
      if (modals.settings) {
          if (activeTab === 'ssh') {
              api.checkSshKeys()
                .then(setKeys)
                .catch((e) => {
                  console.error('Failed to load SSH keys:', e);
                  setKeys([]);
                });
          } else if (activeTab === 'connections') {
              api.getGroups()
                .then(setGroups)
                .catch((e) => {
                  console.error('Failed to load groups:', e);
                  setGroups([]);
                });
              api.listSshConfigHosts()
                .then(setSshHosts)
                .catch((e) => {
                  console.error('Failed to load SSH hosts:', e);
                  setSshHosts([]);
                });
          }
      }
  }, [activeTab, modals.settings]);

  const handleCreateGroup = async () => {
      if (!newGroup.trim()) return;
      try {
          await api.createGroup(newGroup.trim());
          setNewGroup('');
          const updatedGroups = await api.getGroups();
          setGroups(updatedGroups);
      } catch (e) {
          console.error('Failed to create group:', e);
          alert(`Failed to create group: ${e}`);
      }
  };

  const handleDeleteGroup = async (name: string) => {
      try {
          await api.deleteGroup(name);
          const updatedGroups = await api.getGroups();
          setGroups(updatedGroups);
      } catch (e) {
          console.error('Failed to delete group:', e);
          alert(`Failed to delete group: ${e}`);
      }
  };

  const handleImportHost = async (alias: string) => {
      try {
          const imported = await api.importSshHost(alias);
          alert(`Successfully imported "${imported.name}" as a saved connection!`);
          // Remove from list to show it's imported
          setSshHosts(prev => prev.filter(h => h.alias !== alias));
      } catch (e) {
          console.error('Failed to import SSH host:', e);
          alert(`Failed to import host: ${e}`);
      }
  };

  return (
    <Dialog open={modals.settings} onOpenChange={(open) => toggleModal('settings', open)}>
      <DialogContent className="max-w-4xl h-[600px] flex flex-col p-0 gap-0 overflow-hidden sm:rounded-md" aria-describedby="settings-desc">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription id="settings-desc" className="sr-only">
            Application configuration settings.
        </DialogDescription>
        
        <div className="flex h-full">
            {/* Sidebar */}
            <div className="w-48 bg-oxide-panel border-r border-oxide-border flex flex-col pt-4 pb-4">
                <div className="px-4 mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-zinc-100">Settings</h2>
                    <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6" 
                        onClick={() => toggleModal('settings', false)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="space-y-1 px-2">
                    <Button 
                        variant={activeTab === 'terminal' ? 'secondary' : 'ghost'} 
                        className="w-full justify-start gap-2 h-8"
                        onClick={() => setActiveTab('terminal')}
                    >
                        <TerminalIcon className="h-4 w-4" /> Terminal
                    </Button>
                    <Button 
                        variant={activeTab === 'appearance' ? 'secondary' : 'ghost'} 
                        className="w-full justify-start gap-2 h-8"
                        onClick={() => setActiveTab('appearance')}
                    >
                        <Monitor className="h-4 w-4" /> Appearance
                    </Button>
                    <Button 
                        variant={activeTab === 'connections' ? 'secondary' : 'ghost'} 
                        className="w-full justify-start gap-2 h-8"
                        onClick={() => setActiveTab('connections')}
                    >
                        <Shield className="h-4 w-4" /> Connections
                    </Button>
                    <Button 
                        variant={activeTab === 'ssh' ? 'secondary' : 'ghost'} 
                        className="w-full justify-start gap-2 h-8"
                        onClick={() => setActiveTab('ssh')}
                    >
                        <Key className="h-4 w-4" /> SSH Keys
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 bg-oxide-bg overflow-y-auto p-6">
                {activeTab === 'terminal' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-zinc-100 mb-1">Terminal Settings</h3>
                            <p className="text-sm text-zinc-500">Configure appearance and behavior of the terminal.</p>
                        </div>
                        <Separator />
                        
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label>Theme</Label>
                                <Select 
                                    value={settings.theme} 
                                    onValueChange={(v) => updateSetting('theme', v)}
                                >
                                    <SelectTrigger className="w-[240px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="default">OxideTerm Default</SelectItem>
                                        <SelectItem value="dracula">Dracula</SelectItem>
                                        <SelectItem value="nord">Nord</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Font Family</Label>
                                    <Select 
                                        value={settings.fontFamily}
                                        onValueChange={(v) => updateSetting('fontFamily', v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="jetbrains">JetBrains Mono</SelectItem>
                                            <SelectItem value="sfmono">SF Mono</SelectItem>
                                            <SelectItem value="fira">Fira Code</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Font Size</Label>
                                    <Select 
                                        value={settings.fontSize.toString()}
                                        onValueChange={(v) => updateSetting('fontSize', parseInt(v))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[10, 11, 12, 13, 14, 15, 16, 18, 20, 24].map(size => (
                                                <SelectItem key={size} value={size.toString()}>{size}px</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Line Height</Label>
                                    <Select 
                                        value={settings.lineHeight.toString()}
                                        onValueChange={(v) => updateSetting('lineHeight', parseFloat(v))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {['1.0', '1.1', '1.2', '1.3', '1.4', '1.5'].map(h => (
                                                <SelectItem key={h} value={h}>{h}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Scrollback Lines</Label>
                                    <Select 
                                        value={settings.scrollback.toString()}
                                        onValueChange={(v) => updateSetting('scrollback', parseInt(v))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {['1000', '5000', '10000', '50000'].map(l => (
                                                <SelectItem key={l} value={l}>{l}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            
                            <div className="grid gap-2 pt-2">
                                <Label>Cursor Style</Label>
                                <div className="flex gap-4">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox 
                                            id="block" 
                                            checked={settings.cursorStyle === 'block'}
                                            onCheckedChange={() => updateSetting('cursorStyle', 'block')}
                                        />
                                        <Label htmlFor="block">Block</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox 
                                            id="underline" 
                                            checked={settings.cursorStyle === 'underline'}
                                            onCheckedChange={() => updateSetting('cursorStyle', 'underline')}
                                        />
                                        <Label htmlFor="underline">Underline</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox 
                                            id="bar" 
                                            checked={settings.cursorStyle === 'bar'}
                                            onCheckedChange={() => updateSetting('cursorStyle', 'bar')}
                                        />
                                        <Label htmlFor="bar">Bar</Label>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                                <Checkbox 
                                    id="blink" 
                                    checked={settings.cursorBlink}
                                    onCheckedChange={(c) => updateSetting('cursorBlink', !!c)}
                                />
                                <Label htmlFor="blink">Cursor Blink</Label>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'appearance' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-zinc-100 mb-1">Appearance</h3>
                            <p className="text-sm text-zinc-500">UI and layout preferences.</p>
                        </div>
                        <Separator />
                        <div className="grid gap-4">
                             <div className="flex items-center space-x-2">
                                <Checkbox 
                                    id="sidebar-col" 
                                    checked={settings.sidebarCollapsedDefault}
                                    onCheckedChange={(c) => updateSetting('sidebarCollapsedDefault', !!c)}
                                />
                                <Label htmlFor="sidebar-col">Collapse Sidebar by default</Label>
                            </div>
                        </div>
                    </div>
                )}

                 {activeTab === 'connections' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-zinc-100 mb-1">Connection Defaults</h3>
                            <p className="text-sm text-zinc-500">Default settings for new connections.</p>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Default Username</Label>
                                <Input 
                                    value={settings.defaultUsername}
                                    onChange={(e) => updateSetting('defaultUsername', e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Default Port</Label>
                                <Input 
                                    value={settings.defaultPort}
                                    onChange={(e) => updateSetting('defaultPort', parseInt(e.target.value) || 22)}
                                />
                            </div>
                        </div>

                        <div className="pt-4">
                            <h3 className="text-lg font-medium text-zinc-100 mb-1">Groups</h3>
                            <p className="text-sm text-zinc-500 mb-2">Manage connection groups.</p>
                            <Separator className="mb-2" />
                            
                            <div className="flex gap-2 mb-2">
                                <Input 
                                    placeholder="New group name..." 
                                    value={newGroup}
                                    onChange={(e) => setNewGroup(e.target.value)}
                                    className="h-8"
                                />
                                <Button size="sm" onClick={handleCreateGroup} disabled={!newGroup}>
                                    <Plus className="h-3 w-3 mr-1" /> Add
                                </Button>
                            </div>
                            
                            <div className="space-y-1">
                                {groups.map(group => (
                                    <div key={group} className="flex items-center justify-between p-2 bg-oxide-panel rounded-sm border border-oxide-border">
                                        <span className="text-sm">{group}</span>
                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-zinc-500 hover:text-red-400" onClick={() => handleDeleteGroup(group)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-4">
                            <h3 className="text-lg font-medium text-zinc-100 mb-1">Import from SSH Config</h3>
                            <p className="text-sm text-zinc-500 mb-2">Scan ~/.ssh/config for hosts.</p>
                            <Separator className="mb-2" />
                            
                            <div className="h-32 overflow-y-auto border border-oxide-border rounded-sm bg-oxide-panel p-1">
                                {sshHosts.map(host => (
                                    <div key={host.alias} className="flex items-center justify-between p-2 hover:bg-zinc-800 rounded-sm">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">{host.alias}</span>
                                            <span className="text-xs text-zinc-500">{host.user}@{host.host}:{host.port}</span>
                                        </div>
                                        <Button size="sm" variant="secondary" className="h-7" onClick={() => handleImportHost(host.alias)}>
                                            <FolderInput className="h-3 w-3 mr-1" /> Import
                                        </Button>
                                    </div>
                                ))}
                                {sshHosts.length === 0 && (
                                    <div className="text-center py-8 text-zinc-500 text-sm">
                                        No hosts found in ~/.ssh/config
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'ssh' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-zinc-100 mb-1">SSH Keys</h3>
                            <p className="text-sm text-zinc-500">Manage local SSH keys detected in ~/.ssh/</p>
                        </div>
                        <Separator />
                        
                        <div className="space-y-2">
                            {keys.map(key => (
                                <div key={key.name} className="flex items-center justify-between p-3 bg-oxide-panel border border-oxide-border rounded-sm">
                                    <div className="flex items-center gap-3">
                                        <Key className="h-5 w-5 text-oxide-accent" />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-zinc-200">{key.name}</span>
                                            <span className="text-xs text-zinc-500">{key.key_type} · {key.path}</span>
                                        </div>
                                    </div>
                                    {key.has_passphrase && (
                                        <span className="text-xs bg-yellow-900/30 text-yellow-500 px-2 py-0.5 rounded">Encrypted</span>
                                    )}
                                </div>
                            ))}
                            {keys.length === 0 && (
                                <div className="text-center py-8 text-zinc-500">
                                    No keys found in default location.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
