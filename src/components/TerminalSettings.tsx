/**
 * Terminal Settings Component
 * 
 * Settings panel for terminal configuration (theme, font, behavior).
 * Connected to terminalConfigStore for persistence.
 */

import { useState, useEffect } from 'react';
import { X, Settings, Palette, Terminal as TerminalIcon, Type, RotateCcw, Monitor, MousePointer } from 'lucide-react';
import { useTerminalConfig, type TerminalConfig } from '../store/terminalConfigStore';
import { themes, fontFamilies, scrollbackOptions } from '../lib/themes';

interface TerminalSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TerminalSettings({ isOpen, onClose }: TerminalSettingsProps) {
  // Get store values and actions
  const config = useTerminalConfig();
  
  // Local state for editing (apply on save)
  const [localConfig, setLocalConfig] = useState<Partial<TerminalConfig>>({});
  
  // Initialize local config when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalConfig({
        themeId: config.themeId,
        fontFamily: config.fontFamily,
        fontSize: config.fontSize,
        lineHeight: config.lineHeight,
        scrollback: config.scrollback,
        cursorBlink: config.cursorBlink,
        cursorStyle: config.cursorStyle,
        bellStyle: config.bellStyle,
        macOptionIsMeta: config.macOptionIsMeta,
        linkHandler: config.linkHandler,
        rightClickSelectsWord: config.rightClickSelectsWord,
      });
    }
  }, [isOpen, config]);
  
  const handleSave = () => {
    config.updateConfig(localConfig);
    onClose();
  };
  
  const handleReset = () => {
    config.reset();
    setLocalConfig({
      themeId: 'oxideterm',
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      scrollback: 10000,
      cursorBlink: true,
      cursorStyle: 'block',
      bellStyle: 'visual',
      macOptionIsMeta: false,
      linkHandler: true,
      rightClickSelectsWord: true,
    });
  };
  
  const updateLocal = <K extends keyof TerminalConfig>(key: K, value: TerminalConfig[K]) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  if (!isOpen) return null;

  // Get current theme for preview (available for future use)
  const _selectedTheme = themes.find(t => t.id === localConfig.themeId) ?? themes[0];
  void _selectedTheme; // Suppress unused warning - will be used for live preview

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-crust border border-white/[0.06] rounded-xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-mauve" />
            <span className="text-sm font-medium text-zinc-200">Terminal Settings</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/[0.06] rounded transition-colors"
          >
            <X size={16} className="text-zinc-500" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="p-4 space-y-6 overflow-y-auto flex-1">
          {/* Theme Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-zinc-400 uppercase tracking-wider">
              <Palette size={12} />
              <span>Theme</span>
            </div>
            
            {/* Theme Grid */}
            <div className="grid grid-cols-3 gap-2">
              {themes.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => updateLocal('themeId', theme.id)}
                  className={`p-3 rounded-lg border transition-all text-left ${
                    localConfig.themeId === theme.id
                      ? 'border-mauve bg-mauve/10'
                      : 'border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02]'
                  }`}
                >
                  {/* Theme Preview */}
                  <div 
                    className="h-8 rounded mb-2 flex items-center px-2 text-xs font-mono"
                    style={{ 
                      backgroundColor: theme.background, 
                      color: theme.foreground 
                    }}
                  >
                    <span style={{ color: theme.green }}>$</span>
                    <span className="ml-1">hello</span>
                  </div>
                  <span className="text-xs text-zinc-300">{theme.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Font Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-zinc-400 uppercase tracking-wider">
              <Type size={12} />
              <span>Font</span>
            </div>
            <div className="space-y-2">
              {/* Font Family */}
              <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                <span className="text-sm text-zinc-300">Font Family</span>
                <select 
                  className="px-2 py-1 text-xs bg-black/20 border border-white/[0.06] rounded text-zinc-200"
                  value={fontFamilies.find(f => f.value === localConfig.fontFamily)?.id ?? 'jetbrains-mono'}
                  onChange={(e) => {
                    const font = fontFamilies.find(f => f.id === e.target.value);
                    if (font) updateLocal('fontFamily', font.value);
                  }}
                >
                  {fontFamilies.map(font => (
                    <option key={font.id} value={font.id}>{font.name}</option>
                  ))}
                </select>
              </div>
              
              {/* Font Size */}
              <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                <span className="text-sm text-zinc-300">Font Size</span>
                <div className="flex items-center gap-2">
                  <input 
                    type="range"
                    min={8}
                    max={24}
                    value={localConfig.fontSize ?? 14}
                    onChange={(e) => updateLocal('fontSize', Number(e.target.value))}
                    className="w-24 accent-mauve"
                  />
                  <span className="w-8 text-xs text-zinc-400 text-right">{localConfig.fontSize}px</span>
                </div>
              </div>
              
              {/* Line Height */}
              <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                <span className="text-sm text-zinc-300">Line Height</span>
                <div className="flex items-center gap-2">
                  <input 
                    type="range"
                    min={1}
                    max={2}
                    step={0.1}
                    value={localConfig.lineHeight ?? 1.2}
                    onChange={(e) => updateLocal('lineHeight', Number(e.target.value))}
                    className="w-24 accent-mauve"
                  />
                  <span className="w-8 text-xs text-zinc-400 text-right">{(localConfig.lineHeight ?? 1.2).toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cursor Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-zinc-400 uppercase tracking-wider">
              <MousePointer size={12} />
              <span>Cursor</span>
            </div>
            <div className="space-y-2">
              {/* Cursor Style */}
              <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                <span className="text-sm text-zinc-300">Cursor Style</span>
                <div className="flex gap-1">
                  {(['block', 'underline', 'bar'] as const).map(style => (
                    <button
                      key={style}
                      onClick={() => updateLocal('cursorStyle', style)}
                      className={`px-3 py-1 text-xs rounded transition-colors ${
                        localConfig.cursorStyle === style
                          ? 'bg-mauve/20 text-mauve'
                          : 'bg-black/20 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {style.charAt(0).toUpperCase() + style.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Cursor Blink */}
              <label className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04] cursor-pointer">
                <span className="text-sm text-zinc-300">Cursor Blink</span>
                <input 
                  type="checkbox" 
                  checked={localConfig.cursorBlink ?? true}
                  onChange={(e) => updateLocal('cursorBlink', e.target.checked)}
                  className="w-4 h-4 rounded bg-black/20 border border-white/[0.06] checked:bg-mauve checked:border-mauve accent-mauve"
                />
              </label>
            </div>
          </div>

          {/* Terminal Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-zinc-400 uppercase tracking-wider">
              <TerminalIcon size={12} />
              <span>Terminal</span>
            </div>
            <div className="space-y-2">
              {/* Scrollback */}
              <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                <span className="text-sm text-zinc-300">Scrollback Lines</span>
                <select
                  className="px-2 py-1 text-xs bg-black/20 border border-white/[0.06] rounded text-zinc-200"
                  value={localConfig.scrollback ?? 10000}
                  onChange={(e) => updateLocal('scrollback', Number(e.target.value))}
                >
                  {scrollbackOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              
              {/* Bell Style */}
              <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                <span className="text-sm text-zinc-300">Bell Notification</span>
                <select
                  className="px-2 py-1 text-xs bg-black/20 border border-white/[0.06] rounded text-zinc-200"
                  value={localConfig.bellStyle ?? 'visual'}
                  onChange={(e) => updateLocal('bellStyle', e.target.value as 'none' | 'sound' | 'visual' | 'both')}
                >
                  <option value="none">None</option>
                  <option value="visual">Visual</option>
                  <option value="sound">Sound</option>
                  <option value="both">Both</option>
                </select>
              </div>
              
              {/* Link Detection */}
              <label className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04] cursor-pointer">
                <div>
                  <span className="text-sm text-zinc-300">Clickable Links</span>
                  <p className="text-xs text-zinc-500">Cmd+Click to open URLs</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={localConfig.linkHandler ?? true}
                  onChange={(e) => updateLocal('linkHandler', e.target.checked)}
                  className="w-4 h-4 rounded bg-black/20 border border-white/[0.06] checked:bg-mauve checked:border-mauve accent-mauve"
                />
              </label>
              
              {/* Right Click Selects Word */}
              <label className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04] cursor-pointer">
                <div>
                  <span className="text-sm text-zinc-300">Right Click Selects Word</span>
                  <p className="text-xs text-zinc-500">Select word under cursor on right click</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={localConfig.rightClickSelectsWord ?? true}
                  onChange={(e) => updateLocal('rightClickSelectsWord', e.target.checked)}
                  className="w-4 h-4 rounded bg-black/20 border border-white/[0.06] checked:bg-mauve checked:border-mauve accent-mauve"
                />
              </label>
            </div>
          </div>

          {/* macOS Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-zinc-400 uppercase tracking-wider">
              <Monitor size={12} />
              <span>macOS</span>
            </div>
            <div className="space-y-2">
              <label className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04] cursor-pointer">
                <div>
                  <span className="text-sm text-zinc-300">Option as Meta</span>
                  <p className="text-xs text-zinc-500">Use Option key as Meta for shell keybindings</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={localConfig.macOptionIsMeta ?? false}
                  onChange={(e) => updateLocal('macOptionIsMeta', e.target.checked)}
                  className="w-4 h-4 rounded bg-black/20 border border-white/[0.06] checked:bg-mauve checked:border-mauve accent-mauve"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.04] bg-white/[0.01] shrink-0">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <RotateCcw size={14} />
            Reset to Defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-sm bg-mauve/20 text-mauve hover:bg-mauve/30 rounded transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TerminalSettings;
