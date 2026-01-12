import React, { useState } from 'react';
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
import { Monitor, Key, Terminal as TerminalIcon, Shield } from 'lucide-react';

export const SettingsModal = () => {
  const { modals, toggleModal } = useAppStore();
  const [activeTab, setActiveTab] = useState('terminal');

  return (
    <Dialog open={modals.settings} onOpenChange={(open) => toggleModal('settings', open)}>
      <DialogContent className="max-w-4xl h-[600px] flex flex-col p-0 gap-0 overflow-hidden sm:rounded-md">
        <div className="flex h-full">
            {/* Sidebar */}
            <div className="w-48 bg-oxide-panel border-r border-oxide-border flex flex-col pt-4 pb-4">
                <div className="px-4 mb-4">
                    <h2 className="text-sm font-semibold text-zinc-100">Settings</h2>
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
                                <Select defaultValue="default">
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
                                    <Select defaultValue="jetbrains">
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
                                    <Select defaultValue="14">
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
                            
                            <div className="grid gap-2 pt-2">
                                <Label>Cursor Style</Label>
                                <div className="flex gap-4">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="block" checked disabled />
                                        <Label htmlFor="block">Block</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="underline" />
                                        <Label htmlFor="underline">Underline</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="bar" />
                                        <Label htmlFor="bar">Bar</Label>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                                <Checkbox id="blink" defaultChecked />
                                <Label htmlFor="blink">Cursor Blink</Label>
                            </div>

                             <div className="flex items-center space-x-2">
                                <Checkbox id="select-word" defaultChecked />
                                <Label htmlFor="select-word">Right-click selects word</Label>
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
                                <Checkbox id="sidebar-col" />
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
                                <Input placeholder="root" />
                            </div>
                            <div className="grid gap-2">
                                <Label>Default Port</Label>
                                <Input placeholder="22" />
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
