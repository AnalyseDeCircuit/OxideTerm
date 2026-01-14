import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import { 
  Dialog, 
  DialogContent, 
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
import { themes } from '../../lib/themes';
import { applyGlobalTheme } from '../../lib/themeManager';

const ThemePreview = ({ themeName }: { themeName: string }) => {
    const theme = themes[themeName] || themes.default;
    
    return (
        <div className="mt-2 p-3 rounded-md border border-theme-border" style={{ backgroundColor: theme.background }}>
            <div className="flex gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.red }}></div>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.yellow }}></div>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.green }}></div>
            </div>
            <div className="font-mono text-xs space-y-1" style={{ color: theme.foreground }}>
                <div>$ echo "Hello World"</div>
                <div style={{ color: theme.blue }}>~ <span style={{ color: theme.magenta }}>git</span> status</div>
                <div className="flex items-center">
                    <span>&gt; </span>
                    <span className="w-2 h-4 ml-1 animate-pulse" style={{ backgroundColor: theme.cursor }}></span>
                </div>
            </div>
        </div>
    );
};

// Extended persistence hook
interface PersistedSettings {
    // Terminal
    theme: string;
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    cursorStyle: string;
    cursorBlink: boolean;
    scrollback: number;
    // Buffer
    bufferMaxLines: number;
    bufferSaveOnDisconnect: boolean;
    // Appearance
    sidebarCollapsedDefault: boolean;
    // Connections
    defaultUsername: string;
    defaultPort: number;
}

const defaultSettings: PersistedSettings = {
    // Terminal
    theme: 'default',
    fontFamily: 'jetbrains',
    fontSize: 14,
    lineHeight: 1.2,
    cursorStyle: 'block',
    cursorBlink: true,
    scrollback: 1000,
    // Buffer
    bufferMaxLines: 100000,
    bufferSaveOnDisconnect: true,
    // Appearance
    sidebarCollapsedDefault: false,
    // Connections
    defaultUsername: 'root',
    defaultPort: 22,
};

const usePersistedSettings = () => {
    const [settings, setSettings] = useState<PersistedSettings>(() => {
        const saved = localStorage.getItem('oxide-settings');
        return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    });

    useEffect(() => {
        localStorage.setItem('oxide-settings', JSON.stringify(settings));
        window.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }));
    }, [settings]);

    const updateSetting = <K extends keyof PersistedSettings>(key: K, value: PersistedSettings[K]) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
        
        // Apply global theme immediately when theme changes
        // Use typeof guard to safely narrow the generic value type
        if (key === 'theme' && typeof value === 'string') {
            applyGlobalTheme(value);
        }
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
          // Refresh saved connections in sidebar
          const { loadSavedConnections } = useAppStore.getState();
          await loadSavedConnections();
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
            <div className="w-48 bg-theme-bg-panel border-r border-theme-border flex flex-col pt-4 pb-4">
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
            <div className="flex-1 bg-theme-bg overflow-y-auto p-6">
                {activeTab === 'terminal' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-zinc-100 mb-1">Terminal Settings</h3>
                            <p className="text-sm text-zinc-500">Configure appearance and behavior of the terminal.</p>
                        </div>
                        <Separator />
                        
                        <div className="grid gap-4">
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
                                            <SelectItem value="meslo">MesloLGM Nerd Font</SelectItem>
                                            <SelectItem value="tinos">Tinos Nerd Font</SelectItem>
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
                                    <Label>Scrollback Lines (Frontend)</Label>
                                    <Select 
                                        value={settings.scrollback.toString()}
                                        onValueChange={(v) => updateSetting('scrollback', parseInt(v))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {['1000', '5000', '10000'].map(l => (
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

                        {/* Buffer Settings */}
                        <div>
                            <h3 className="text-lg font-medium text-zinc-100 mb-1">Buffer Management</h3>
                            <p className="text-sm text-zinc-500">Configure backend scroll buffer for search and persistence.</p>
                        </div>
                        <Separator />
                        
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label>Maximum Buffer Lines</Label>
                                <Select 
                                    value={settings.bufferMaxLines.toString()}
                                    onValueChange={(v) => updateSetting('bufferMaxLines', parseInt(v))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10000">10,000 lines (~1 MB)</SelectItem>
                                        <SelectItem value="50000">50,000 lines (~5 MB)</SelectItem>
                                        <SelectItem value="100000">100,000 lines (~10 MB)</SelectItem>
                                        <SelectItem value="500000">500,000 lines (~50 MB)</SelectItem>
                                        <SelectItem value="1000000">1,000,000 lines (~100 MB)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-zinc-500">
                                    Older lines will be automatically discarded when limit is reached.
                                </p>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                                <Checkbox 
                                    id="buffer-save" 
                                    checked={settings.bufferSaveOnDisconnect}
                                    onCheckedChange={(c) => updateSetting('bufferSaveOnDisconnect', !!c)}
                                />
                                <Label htmlFor="buffer-save" className="cursor-pointer">
                                    Save buffer content on disconnect
                                </Label>
                            </div>
                            <p className="text-xs text-zinc-500 -mt-2 ml-6">
                                Buffer content will be persisted and restored when reconnecting to the session.
                            </p>
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
                                        <SelectItem value="default">Neutral</SelectItem>
                                        <SelectItem value="oxide">Oxide</SelectItem>
                                        <SelectItem value="dracula">Dracula</SelectItem>
                                        <SelectItem value="nord">Nord</SelectItem>
                                        <SelectItem value="solarized-dark">Solarized Dark</SelectItem>
                                        <SelectItem value="monokai">Monokai</SelectItem>
                                        <SelectItem value="github-dark">GitHub Dark</SelectItem>
                                    </SelectContent>
                                </Select>
                                <ThemePreview themeName={settings.theme} />
                            </div>

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
                                    <div key={group} className="flex items-center justify-between p-2 bg-theme-bg-panel rounded-sm border border-theme-border">
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
                            
                            <div className="h-32 overflow-y-auto border border-theme-border rounded-sm bg-theme-bg-panel p-1">
                                {sshHosts.map(host => (
                                    <div key={host.alias} className="flex items-center justify-between p-2 hover:bg-zinc-800 rounded-sm">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">{host.alias}</span>
                                            <span className="text-xs text-zinc-500">{host.user}@{host.hostname}:{host.port}</span>
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
                                <div key={key.name} className="flex items-center justify-between p-3 bg-theme-bg-panel border border-theme-border rounded-sm">
                                    <div className="flex items-center gap-3">
                                        <Key className="h-5 w-5 text-theme-accent" />
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
