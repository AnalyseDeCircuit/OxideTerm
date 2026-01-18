import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { useSettingsStore, type RendererType, type FontFamily } from '../../store/settingsStore';
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
import { Monitor, Key, Terminal as TerminalIcon, Shield, Plus, Trash2, FolderInput, X, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';
import { SshKeyInfo, SshHostInfo } from '../../types';
import { themes } from '../../lib/themes';
import { platform } from '../../lib/platform';

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

export const SettingsModal = () => {
  const { modals, toggleModal } = useAppStore();
  const [activeTab, setActiveTab] = useState('terminal');
  
  // Use unified settings store
  const { settings, updateTerminal, updateBuffer, updateAppearance, updateConnectionDefaults, updateAi } = useSettingsStore();
  const { terminal, buffer, appearance, connectionDefaults, ai } = settings;
  
  // AI enable confirmation dialog
  const [showAiConfirm, setShowAiConfirm] = useState(false);
  // AI API key state
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeySaving, setApiKeySaving] = useState(false);
  
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
          } else if (activeTab === 'ai') {
              // Check if API key exists
              api.hasAiApiKey()
                .then(setHasApiKey)
                .catch((e) => {
                  console.error('Failed to check API key:', e);
                  setHasApiKey(false);
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
            <div className="w-48 bg-theme-bg-panel border-r border-theme-border flex flex-col pt-4 pb-4 min-h-0">
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
                <div className="space-y-1 px-2 flex-1 overflow-y-auto min-h-0">
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
                    <Button 
                        variant={activeTab === 'ai' ? 'secondary' : 'ghost'} 
                        className="w-full justify-start gap-2 h-8"
                        onClick={() => setActiveTab('ai')}
                    >
                        <Sparkles className="h-4 w-4" /> AI Assistant
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
                                        value={terminal.fontFamily}
                                        onValueChange={(v) => updateTerminal('fontFamily', v as FontFamily)}
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
                                        value={terminal.fontSize.toString()}
                                        onValueChange={(v) => updateTerminal('fontSize', parseInt(v))}
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
                                        value={terminal.lineHeight.toString()}
                                        onValueChange={(v) => updateTerminal('lineHeight', parseFloat(v))}
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
                                        value={terminal.scrollback.toString()}
                                        onValueChange={(v) => updateTerminal('scrollback', parseInt(v))}
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

                            <div className="grid gap-2">
                                <Label>Renderer</Label>
                                <Select 
                                    value={terminal.renderer}
                                    onValueChange={(v) => updateTerminal('renderer', v as RendererType)}
                                >
                                    <SelectTrigger className="w-[240px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">Auto (WebGL preferred)</SelectItem>
                                        <SelectItem value="webgl">WebGL</SelectItem>
                                        <SelectItem value="canvas">Canvas</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-zinc-500">
                                    Canvas is recommended on Windows for better stability. Requires restart to apply.
                                </p>
                            </div>
                            
                            <div className="grid gap-2 pt-2">
                                <Label>Cursor Style</Label>
                                <div className="flex gap-4">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox 
                                            id="block" 
                                            checked={terminal.cursorStyle === 'block'}
                                            onCheckedChange={() => updateTerminal('cursorStyle', 'block')}
                                        />
                                        <Label htmlFor="block">Block</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox 
                                            id="underline" 
                                            checked={terminal.cursorStyle === 'underline'}
                                            onCheckedChange={() => updateTerminal('cursorStyle', 'underline')}
                                        />
                                        <Label htmlFor="underline">Underline</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox 
                                            id="bar" 
                                            checked={terminal.cursorStyle === 'bar'}
                                            onCheckedChange={() => updateTerminal('cursorStyle', 'bar')}
                                        />
                                        <Label htmlFor="bar">Bar</Label>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                                <Checkbox 
                                    id="blink" 
                                    checked={terminal.cursorBlink}
                                    onCheckedChange={(c) => updateTerminal('cursorBlink', !!c)}
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
                                    value={buffer.maxLines.toString()}
                                    onValueChange={(v) => updateBuffer('maxLines', parseInt(v))}
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
                                    checked={buffer.saveOnDisconnect}
                                    onCheckedChange={(c) => updateBuffer('saveOnDisconnect', !!c)}
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
                                    value={terminal.theme} 
                                    onValueChange={(v) => updateTerminal('theme', v)}
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
                                <ThemePreview themeName={terminal.theme} />
                            </div>

                             <div className="flex items-center space-x-2">
                                <Checkbox 
                                    id="sidebar-col" 
                                    checked={appearance.sidebarCollapsedDefault}
                                    onCheckedChange={(c) => updateAppearance('sidebarCollapsedDefault', !!c)}
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
                                    value={connectionDefaults.username}
                                    onChange={(e) => updateConnectionDefaults('username', e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Default Port</Label>
                                <Input 
                                    value={connectionDefaults.port}
                                    onChange={(e) => updateConnectionDefaults('port', parseInt(e.target.value) || 22)}
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

                {activeTab === 'ai' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-zinc-100 mb-1">AI Assistant</h3>
                            <p className="text-sm text-zinc-500">Configure inline AI chat with your own API.</p>
                        </div>
                        <Separator />

                        {/* Enable Toggle with Confirmation */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-theme-bg-panel border border-theme-border rounded-md">
                                <div className="flex items-center gap-3">
                                    <Sparkles className="h-5 w-5 text-theme-accent" />
                                    <div>
                                        <div className="font-medium text-zinc-200">Enable AI Capabilities</div>
                                        <div className="text-xs text-zinc-500">
                                            Press {platform.isWindows ? 'Ctrl+Shift+I' : 'Ctrl+I / Cmd+I'} in terminal to open AI panel
                                        </div>
                                    </div>
                                </div>
                                <Checkbox 
                                    id="ai-enabled"
                                    checked={ai.enabled}
                                    onCheckedChange={(checked) => {
                                        if (checked && !ai.enabledConfirmed) {
                                            setShowAiConfirm(true);
                                        } else {
                                            updateAi('enabled', !!checked);
                                        }
                                    }}
                                />
                            </div>

                            {/* Privacy Notice */}
                            <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-4 py-3 rounded-md text-sm">
                                <p className="font-semibold mb-2">🔒 Privacy Notice</p>
                                <ul className="space-y-1 text-xs opacity-90">
                                    <li>• All AI requests are initiated from your local machine</li>
                                    <li>• No intermediate server is used</li>
                                    <li>• Only the selected context is sent to the API</li>
                                    <li>• API key is stored securely in system keychain</li>
                                </ul>
                            </div>
                        </div>

                        {/* API Configuration (only shown when enabled) */}
                        {ai.enabled && (
                            <>
                                <div>
                                    <h4 className="text-md font-medium text-zinc-100 mb-1">API Configuration</h4>
                                    <p className="text-sm text-zinc-500">OpenAI-compatible endpoint settings.</p>
                                </div>
                                <Separator />

                                <div className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label>Base URL</Label>
                                        <Input 
                                            value={ai.baseUrl}
                                            onChange={(e) => updateAi('baseUrl', e.target.value)}
                                            placeholder="https://api.openai.com/v1"
                                        />
                                        <p className="text-xs text-zinc-500">
                                            Works with OpenAI, Ollama, OneAPI, or any compatible endpoint.
                                        </p>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Model</Label>
                                        <Input 
                                            value={ai.model}
                                            onChange={(e) => updateAi('model', e.target.value)}
                                            placeholder="gpt-4o-mini"
                                        />
                                        <p className="text-xs text-zinc-500">
                                            Model identifier (e.g., gpt-4o-mini, deepseek-chat, llama3.2).
                                        </p>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>API Key</Label>
                                        {hasApiKey ? (
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-10 px-3 flex items-center bg-green-500/10 border border-green-500/30 rounded-md text-green-400 text-sm">
                                                    <Shield className="h-4 w-4 mr-2" />
                                                    API key configured in keychain
                                                </div>
                                                <Button 
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-red-400 hover:text-red-300"
                                                    onClick={async () => {
                                                        if (confirm('Remove API key from keychain?')) {
                                                            try {
                                                                await api.setAiApiKey('');
                                                                setHasApiKey(false);
                                                            } catch (e) {
                                                                alert(`Failed to remove API key: ${e}`);
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2">
                                                <Input 
                                                    type="password"
                                                    placeholder="sk-..."
                                                    className="flex-1"
                                                    value={apiKeyInput}
                                                    onChange={(e) => setApiKeyInput(e.target.value)}
                                                />
                                                <Button 
                                                    variant="secondary"
                                                    disabled={!apiKeyInput.trim() || apiKeySaving}
                                                    onClick={async () => {
                                                        if (!apiKeyInput.trim()) return;
                                                        setApiKeySaving(true);
                                                        try {
                                                            await api.setAiApiKey(apiKeyInput);
                                                            setApiKeyInput('');
                                                            setHasApiKey(true);
                                                        } catch (e) {
                                                            alert(`Failed to save API key: ${e}`);
                                                        } finally {
                                                            setApiKeySaving(false);
                                                        }
                                                    }}
                                                >
                                                    {apiKeySaving ? 'Saving...' : 'Save'}
                                                </Button>
                                            </div>
                                        )}
                                        <p className="text-xs text-zinc-500">
                                            Stored in system keychain, never saved to disk.
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-md font-medium text-zinc-100 mb-1">Context Limits</h4>
                                    <p className="text-sm text-zinc-500">Control how much context is sent to the AI.</p>
                                </div>
                                <Separator />

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Max Characters</Label>
                                        <Select 
                                            value={ai.contextMaxChars.toString()}
                                            onValueChange={(v) => updateAi('contextMaxChars', parseInt(v))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="2000">2,000 chars (~500 tokens)</SelectItem>
                                                <SelectItem value="4000">4,000 chars (~1,000 tokens)</SelectItem>
                                                <SelectItem value="8000">8,000 chars (~2,000 tokens)</SelectItem>
                                                <SelectItem value="16000">16,000 chars (~4,000 tokens)</SelectItem>
                                                <SelectItem value="32000">32,000 chars (~8,000 tokens)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Visible Lines</Label>
                                        <Select 
                                            value={ai.contextVisibleLines.toString()}
                                            onValueChange={(v) => updateAi('contextVisibleLines', parseInt(v))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="50">50 lines</SelectItem>
                                                <SelectItem value="100">100 lines</SelectItem>
                                                <SelectItem value="120">120 lines</SelectItem>
                                                <SelectItem value="200">200 lines</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <p className="text-xs text-zinc-500">
                                    Token estimates are approximate (1 token ≈ 4 characters for English).
                                </p>
                            </>
                        )}
                    </div>
                )}

                {/* AI Enable Confirmation Dialog */}
                {showAiConfirm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-theme-bg-panel border border-theme-border rounded-lg p-6 max-w-md mx-4">
                            <h3 className="text-lg font-semibold text-zinc-100 mb-2 flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-theme-accent" />
                                Enable AI Capabilities
                            </h3>
                            <div className="text-sm text-zinc-400 space-y-3 mb-6">
                                <p>Before enabling AI features, please confirm you understand:</p>
                                <ul className="space-y-2 text-xs">
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-400">✓</span>
                                        <span>All AI requests are initiated <strong>from your local machine</strong></span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-400">✓</span>
                                        <span><strong>No intermediate server</strong> is used by OxideTerm</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-400">✓</span>
                                        <span>Only <strong>selected context</strong> is sent to your configured API</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-yellow-400">!</span>
                                        <span>You are responsible for your API provider's data policies</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setShowAiConfirm(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={() => {
                                    updateAi('enabledConfirmed', true);
                                    updateAi('enabled', true);
                                    setShowAiConfirm(false);
                                }}>
                                    I Understand, Enable AI
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
