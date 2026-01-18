import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { useSettingsStore, type RendererType, type FontFamily, type CursorStyle } from '../../store/settingsStore';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import { 
    Dialog, 
    DialogContent, 
    DialogTitle, 
    DialogDescription,
    DialogHeader,
    DialogFooter
} from '../ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../ui/select';
import { Monitor, Key, Terminal as TerminalIcon, Shield, Plus, Trash2, FolderInput, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';
import { SshKeyInfo, SshHostInfo } from '../../types';
import { themes } from '../../lib/themes';

const formatThemeName = (key: string) => {
    return key.split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

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

export const SettingsView = () => {
    const [activeTab, setActiveTab] = useState('terminal');
  
    // Use unified settings store
    const { settings, updateTerminal, updateAppearance, updateConnectionDefaults, updateAi } = useSettingsStore();
    const { terminal, appearance, connectionDefaults, ai } = settings;
  
    // AI enable confirmation dialog
    const [showAiConfirm, setShowAiConfirm] = useState(false);
    const [hasApiKey, setHasApiKey] = useState(false);
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [apiKeySaving, setApiKeySaving] = useState(false);
  
  // Data State
  const [keys, setKeys] = useState<SshKeyInfo[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [newGroup, setNewGroup] = useState('');
  const [sshHosts, setSshHosts] = useState<SshHostInfo[]>([]);
  
  useEffect(() => {
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
        api.hasAiApiKey()
          .then(setHasApiKey)
          .catch((e) => {
            console.error('Failed to check API key:', e);
            setHasApiKey(false);
          });
    }
  }, [activeTab]);

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
    <div className="flex h-full w-full bg-theme-bg text-zinc-300">
        {/* Sidebar */}
        <div className="w-56 bg-theme-bg-panel border-r border-theme-border flex flex-col pt-6 pb-4 min-h-0">
            <div className="px-5 mb-6">
                <h2 className="text-xl font-semibold text-zinc-100">Settings</h2>
            </div>
            <div className="space-y-1 px-3 flex-1 overflow-y-auto min-h-0">
                <Button 
                    variant={activeTab === 'terminal' ? 'secondary' : 'ghost'} 
                    className="w-full justify-start gap-3 h-10 font-normal"
                    onClick={() => setActiveTab('terminal')}
                >
                    <TerminalIcon className="h-4 w-4" /> Terminal
                </Button>
                <Button 
                    variant={activeTab === 'appearance' ? 'secondary' : 'ghost'} 
                    className="w-full justify-start gap-3 h-10 font-normal"
                    onClick={() => setActiveTab('appearance')}
                >
                    <Monitor className="h-4 w-4" /> Appearance
                </Button>
                <Button 
                    variant={activeTab === 'connections' ? 'secondary' : 'ghost'} 
                    className="w-full justify-start gap-3 h-10 font-normal"
                    onClick={() => setActiveTab('connections')}
                >
                    <Shield className="h-4 w-4" /> Connections
                </Button>
                <Button 
                    variant={activeTab === 'ssh' ? 'secondary' : 'ghost'} 
                    className="w-full justify-start gap-3 h-10 font-normal"
                    onClick={() => setActiveTab('ssh')}
                >
                    <Key className="h-4 w-4" /> SSH Keys
                </Button>
                <Button 
                    variant={activeTab === 'ai' ? 'secondary' : 'ghost'} 
                    className="w-full justify-start gap-3 h-10 font-normal"
                    onClick={() => setActiveTab('ai')}
                >
                    <Sparkles className="h-4 w-4" /> AI Assistant
                </Button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-10">
                {activeTab === 'terminal' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div>
                            <h3 className="text-2xl font-medium text-zinc-100 mb-2">Terminal Settings</h3>
                            <p className="text-zinc-500">Configure appearance and behavior of the terminal emulator.</p>
                        </div>
                        <Separator />
                        
                        {/* Font Section */}
                        <div className="rounded-lg border border-theme-border bg-theme-bg-panel/50 p-5">
                            <h4 className="text-sm font-medium text-zinc-300 mb-4 uppercase tracking-wider">Font</h4>
                            <div className="space-y-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="text-zinc-200">Font Family</Label>
                                        <p className="text-xs text-zinc-500 mt-0.5">Monospace font for terminal text</p>
                                    </div>
                                    <Select 
                                        value={terminal.fontFamily} 
                                        onValueChange={(val) => updateTerminal('fontFamily', val as FontFamily)}
                                    >
                                        <SelectTrigger className="w-[200px]">
                                            <SelectValue placeholder="Select font" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="jetbrains">JetBrains Mono</SelectItem>
                                            <SelectItem value="meslo">Meslo LG Monitor</SelectItem>
                                            <SelectItem value="tinos">Tinos</SelectItem>
                                            <SelectItem value="menlo">Menlo (System)</SelectItem>
                                            <SelectItem value="courier">Courier New</SelectItem>
                                            <SelectItem value="monospace">Monospace (Generic)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Separator className="opacity-50" />

                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="text-zinc-200">Font Size</Label>
                                        <p className="text-xs text-zinc-500 mt-0.5">Size of terminal characters</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Input 
                                            type="range" 
                                            min="8" 
                                            max="32" 
                                            step="1"
                                            value={terminal.fontSize}
                                            onChange={(e) => updateTerminal('fontSize', parseInt(e.target.value))}
                                            className="w-32"
                                        />
                                        <div className="flex items-center gap-1">
                                            <Input 
                                                type="number"
                                                value={terminal.fontSize}
                                                onChange={(e) => updateTerminal('fontSize', parseInt(e.target.value))}
                                                className="w-16 text-center"
                                            />
                                            <span className="text-xs text-zinc-500">px</span>
                                        </div>
                                    </div>
                                </div>

                                <Separator className="opacity-50" />

                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="text-zinc-200">Line Height</Label>
                                        <p className="text-xs text-zinc-500 mt-0.5">Spacing between lines</p>
                                    </div>
                                    <Input 
                                        type="number" 
                                        step="0.1" 
                                        min="0.8" 
                                        max="3"
                                        value={terminal.lineHeight}
                                        onChange={(e) => updateTerminal('lineHeight', parseFloat(e.target.value))}
                                        className="w-20 text-center"
                                    />
                                </div>

                                <Separator className="opacity-50" />

                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="text-zinc-200">Renderer</Label>
                                        <p className="text-xs text-zinc-500 mt-0.5">Choose WebGL or Canvas rendering</p>
                                    </div>
                                    <Select
                                        value={terminal.renderer}
                                        onValueChange={(val) => updateTerminal('renderer', val as RendererType)}
                                    >
                                        <SelectTrigger className="w-[200px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="auto">Auto (WebGL preferred)</SelectItem>
                                            <SelectItem value="webgl">WebGL</SelectItem>
                                            <SelectItem value="canvas">Canvas</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Cursor Section */}
                        <div className="rounded-lg border border-theme-border bg-theme-bg-panel/50 p-5">
                            <h4 className="text-sm font-medium text-zinc-300 mb-4 uppercase tracking-wider">Cursor</h4>
                            <div className="space-y-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="text-zinc-200">Cursor Style</Label>
                                        <p className="text-xs text-zinc-500 mt-0.5">Shape of the text cursor</p>
                                    </div>
                                    <Select 
                                        value={terminal.cursorStyle} 
                                        onValueChange={(val) => updateTerminal('cursorStyle', val as CursorStyle)}
                                    >
                                        <SelectTrigger className="w-[160px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="block">Block █</SelectItem>
                                            <SelectItem value="underline">Underline _</SelectItem>
                                            <SelectItem value="bar">Bar |</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Separator className="opacity-50" />

                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="text-zinc-200">Cursor Blink</Label>
                                        <p className="text-xs text-zinc-500 mt-0.5">Animate cursor blinking</p>
                                    </div>
                                    <Checkbox 
                                        id="blink" 
                                        checked={terminal.cursorBlink}
                                        onCheckedChange={(checked) => updateTerminal('cursorBlink', checked as boolean)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Buffer Section */}
                        <div className="rounded-lg border border-theme-border bg-theme-bg-panel/50 p-5">
                            <h4 className="text-sm font-medium text-zinc-300 mb-4 uppercase tracking-wider">Buffer</h4>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-zinc-200">Scrollback Lines</Label>
                                    <p className="text-xs text-zinc-500 mt-0.5">Number of lines kept in memory for scrolling</p>
                                </div>
                                <Input 
                                    type="number"
                                    value={terminal.scrollback}
                                    onChange={(e) => updateTerminal('scrollback', parseInt(e.target.value))}
                                    className="w-28 text-center"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'appearance' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div>
                            <h3 className="text-2xl font-medium text-zinc-100 mb-2">Appearance</h3>
                            <p className="text-zinc-500">Customize the application theme.</p>
                        </div>
                        <Separator />
                        
                        {/* Theme Section */}
                        <div className="rounded-lg border border-theme-border bg-theme-bg-panel/50 p-5">
                            <h4 className="text-sm font-medium text-zinc-300 mb-4 uppercase tracking-wider">Theme</h4>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="text-zinc-200">Color Theme</Label>
                                        <p className="text-xs text-zinc-500 mt-0.5">Terminal color scheme</p>
                                    </div>
                                    <Select 
                                        value={terminal.theme} 
                                        onValueChange={(val) => updateTerminal('theme', val)}
                                    >
                                        <SelectTrigger className="w-[200px] text-zinc-100">
                                            <SelectValue placeholder="Select theme">
                                                {formatThemeName(terminal.theme)}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-900 border-zinc-700">
                                            {Object.keys(themes).map((key) => (
                                                <SelectItem key={key} value={key} className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
                                                    {formatThemeName(key)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <ThemePreview themeName={terminal.theme} />
                            </div>
                        </div>

                        {/* Layout Section */}
                        <div className="rounded-lg border border-theme-border bg-theme-bg-panel/50 p-5">
                            <h4 className="text-sm font-medium text-zinc-300 mb-4 uppercase tracking-wider">Layout</h4>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-zinc-200">Collapse Sidebar by Default</Label>
                                    <p className="text-xs text-zinc-500 mt-0.5">Start with sidebar hidden</p>
                                </div>
                                <Checkbox 
                                    id="sidebar" 
                                    checked={appearance.sidebarCollapsedDefault}
                                    onCheckedChange={(checked) => updateAppearance('sidebarCollapsedDefault', checked as boolean)}
                                />
                            </div>
                        </div>
                    </div>
                )}

                 {activeTab === 'connections' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div>
                            <h3 className="text-2xl font-medium text-zinc-100 mb-2">Connection Defaults</h3>
                            <p className="text-zinc-500">Default settings for new connections.</p>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-8 max-w-2xl">
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

                        <div className="pt-8">
                            <h3 className="text-xl font-medium text-zinc-100 mb-2">Groups</h3>
                            <p className="text-sm text-zinc-500 mb-4">Manage connection groups.</p>
                            <Separator className="mb-4" />
                            
                            <div className="flex gap-2 mb-4 max-w-md">
                                <Input 
                                    placeholder="New group name..." 
                                    value={newGroup}
                                    onChange={(e) => setNewGroup(e.target.value)}
                                />
                                <Button onClick={handleCreateGroup} disabled={!newGroup}>
                                    <Plus className="h-4 w-4 mr-1" /> Add
                                </Button>
                            </div>
                            
                            <div className="space-y-2 max-w-md">
                                {groups.map(group => (
                                    <div key={group} className="flex items-center justify-between p-3 bg-theme-bg-panel rounded-md border border-theme-border">
                                        <span className="text-sm">{group}</span>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-500 hover:text-red-400" onClick={() => handleDeleteGroup(group)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-8">
                            <h3 className="text-xl font-medium text-zinc-100 mb-2">Import from SSH Config</h3>
                            <p className="text-sm text-zinc-500 mb-4">Scan ~/.ssh/config for hosts.</p>
                            <Separator className="mb-4" />
                            
                            <div className="h-64 overflow-y-auto border border-theme-border rounded-md bg-theme-bg-panel p-2 max-w-2xl">
                                {sshHosts.map(host => (
                                    <div key={host.alias} className="flex items-center justify-between p-3 hover:bg-zinc-800 rounded-md border border-transparent hover:border-theme-border mb-1">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">{host.alias}</span>
                                            <span className="text-xs text-zinc-500">{host.user}@{host.hostname}:{host.port}</span>
                                        </div>
                                        <Button size="sm" variant="secondary" onClick={() => handleImportHost(host.alias)}>
                                            <FolderInput className="h-4 w-4 mr-1" /> Import
                                        </Button>
                                    </div>
                                ))}
                                {sshHosts.length === 0 && (
                                    <div className="text-center py-12 text-zinc-500 text-sm">
                                        No hosts found in ~/.ssh/config
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'ssh' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div>
                            <h3 className="text-2xl font-medium text-zinc-100 mb-2">SSH Keys</h3>
                            <p className="text-zinc-500">Manage local SSH keys detected in ~/.ssh/</p>
                        </div>
                        <Separator />
                        
                        <div className="space-y-3 max-w-3xl">
                            {keys.map(key => (
                                <div key={key.name} className="flex items-center justify-between p-4 bg-theme-bg-panel border border-theme-border rounded-md">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-theme-bg rounded-full">
                                            <Key className="h-5 w-5 text-theme-accent" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-zinc-200">{key.name}</span>
                                            <span className="text-xs text-zinc-500">{key.key_type} · {key.path}</span>
                                        </div>
                                    </div>
                                    {key.has_passphrase && (
                                        <span className="text-xs bg-yellow-900/30 text-yellow-500 px-2 py-1 rounded border border-yellow-900/50">Encrypted</span>
                                    )}
                                </div>
                            ))}
                            {keys.length === 0 && (
                                <div className="text-center py-12 text-zinc-500 border border-dashed border-theme-border rounded-md">
                                    No keys found in default location.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'ai' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div>
                            <h3 className="text-2xl font-medium text-zinc-100 mb-2">AI Assistant</h3>
                            <p className="text-zinc-500">Configure OpenAI-compatible API and context limits.</p>
                        </div>
                        <Separator />

                        {/* AI Settings Section */}
                        <div className="rounded-lg border border-theme-border bg-theme-bg-panel/50 p-5">
                            <h4 className="text-sm font-medium text-zinc-300 mb-4 uppercase tracking-wider">General</h4>
                            
                            {/* Enable Toggle - Standard Layout */}
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <Label className="text-zinc-200">Enable AI Capabilities</Label>
                                    <p className="text-xs text-zinc-500 mt-0.5">Enable inline chat and context analysis</p>
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

                            {/* Privacy Note - Integrating subtly */}
                             <div className="mb-6 p-3 rounded bg-zinc-900/50 border border-zinc-800">
                                <p className="text-xs text-zinc-500 leading-relaxed">
                                    <span className="font-semibold text-zinc-400">Privacy Notice:</span> All requests are initiated locally. 
                                    API keys are stored in the system keychain. Only selected terminal context is sent to the configured endpoint.
                                </p>
                            </div>

                            <Separator className="my-6 opacity-50" />

                            {/* API Configuration - Using Form/Grid Layout like Connections */}
                            <div className={ai.enabled ? "" : "opacity-50 pointer-events-none"}>
                                <h4 className="text-sm font-medium text-zinc-300 mb-4 uppercase tracking-wider">Provider Settings</h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mb-6">
                                    <div className="grid gap-2">
                                        <Label>Base URL</Label>
                                        <Input 
                                            value={ai.baseUrl}
                                            onChange={(e) => updateAi('baseUrl', e.target.value)}
                                            placeholder="https://api.openai.com/v1"
                                            className="bg-theme-bg"
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Model</Label>
                                        <Input 
                                            value={ai.model}
                                            onChange={(e) => updateAi('model', e.target.value)}
                                            placeholder="gpt-4o-mini"
                                            className="bg-theme-bg"
                                        />
                                    </div>
                                </div>

                                <div className="max-w-3xl mb-6">
                                    <div className="grid gap-2">
                                        <Label>API Key</Label>
                                        <div className="flex gap-2">
                                            {hasApiKey ? (
                                                <div className="flex-1 flex items-center gap-2">
                                                    <div className="flex-1 h-10 px-3 flex items-center bg-zinc-900/50 border border-zinc-700/50 rounded-md text-zinc-400 text-sm italic">
                                                        ••••••••••••••••••••••••
                                                    </div>
                                                    <Button 
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                                                        onClick={async () => {
                                                            if (confirm('Remove API key?')) {
                                                                try {
                                                                    await api.deleteAiApiKey();
                                                                    setHasApiKey(false);
                                                                    window.dispatchEvent(new CustomEvent('ai-api-key-updated'));
                                                                } catch (e) {
                                                                    alert(`Failed to remove API key: ${e}`);
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        Remove
                                                    </Button>
                                                </div>
                                            ) : (
                                                <>
                                                    <Input 
                                                        type="password"
                                                        placeholder="sk-..."
                                                        className="flex-1 bg-theme-bg"
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
                                                                window.dispatchEvent(new CustomEvent('ai-api-key-updated'));
                                                            } catch (e) {
                                                                alert(`Failed to save API key: ${e}`);
                                                            } finally {
                                                                setApiKeySaving(false);
                                                            }
                                                        }}
                                                    >
                                                        {apiKeySaving ? 'Saving...' : 'Save'}
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                        <p className="text-xs text-zinc-500">Stored securely in system keychain.</p>
                                    </div>
                                </div>

                                <Separator className="my-6 opacity-50" />

                                <h4 className="text-sm font-medium text-zinc-300 mb-4 uppercase tracking-wider">Context Controls</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
                                    <div className="grid gap-2">
                                        <Label>Max Context Length</Label>
                                        <Select 
                                            value={ai.contextMaxChars.toString()}
                                            onValueChange={(v) => updateAi('contextMaxChars', parseInt(v))}
                                        >
                                            <SelectTrigger className="bg-theme-bg">
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
                                        <p className="text-xs text-zinc-500">Maximum characters to send for analysis.</p>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Buffer History</Label>
                                        <Select 
                                            value={ai.contextVisibleLines.toString()}
                                            onValueChange={(v) => updateAi('contextVisibleLines', parseInt(v))}
                                        >
                                            <SelectTrigger className="bg-theme-bg">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="50">50 lines</SelectItem>
                                                <SelectItem value="100">100 lines</SelectItem>
                                                <SelectItem value="200">200 lines</SelectItem>
                                                <SelectItem value="400">400 lines</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-zinc-500">How many lines of terminal output to include.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* AI Enable Confirmation Dialog */}
        <Dialog open={showAiConfirm} onOpenChange={setShowAiConfirm}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Enable AI Capabilities?</DialogTitle>
                    <DialogDescription>
                        Confirm enabling AI features for terminal context analysis.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="p-4 space-y-4">
                    <p className="text-sm text-zinc-300">
                        This will allow OxideTerm to send selected terminal context to your configured AI endpoint.
                    </p>
                    <div className="space-y-2 text-xs text-zinc-500 bg-zinc-900/30 p-3 rounded border border-theme-border/50">
                        <div className="flex items-start gap-2">
                            <div className="w-1 h-1 rounded-full bg-zinc-500 mt-1.5 shrink-0"></div>
                            <p>All requests are initiated directly from your local machine</p>
                        </div>
                        <div className="flex items-start gap-2">
                            <div className="w-1 h-1 rounded-full bg-zinc-500 mt-1.5 shrink-0"></div>
                            <p>No intermediate server is used (unless configured otherwise)</p>
                        </div>
                        <div className="flex items-start gap-2">
                            <div className="w-1 h-1 rounded-full bg-zinc-500 mt-1.5 shrink-0"></div>
                            <p>Only text you specifically select or query is sent to the API</p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setShowAiConfirm(false)}>Cancel</Button>
                    <Button 
                        onClick={() => {
                            updateAi('enabled', true);
                            updateAi('enabledConfirmed', true);
                            setShowAiConfirm(false);
                        }}
                    >
                        Enable
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
};
