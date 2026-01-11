/**
 * Terminal Settings Component
 * 
 * Settings panel for terminal configuration (theme, font, behavior).
 * TODO: Implement full settings UI
 */

import { X, Settings, Palette, Terminal as TerminalIcon } from 'lucide-react';

interface TerminalSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TerminalSettings({ isOpen, onClose }: TerminalSettingsProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-crust border border-white/[0.06] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
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

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Appearance Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-zinc-400 uppercase tracking-wider">
              <Palette size={12} />
              <span>Appearance</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                <span className="text-sm text-zinc-300">Theme</span>
                <select 
                  className="px-2 py-1 text-xs bg-black/20 border border-white/[0.06] rounded text-zinc-200"
                  defaultValue="catppuccin-mocha"
                >
                  <option value="catppuccin-mocha">Catppuccin Mocha</option>
                  <option value="dracula">Dracula</option>
                  <option value="one-dark">One Dark</option>
                </select>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                <span className="text-sm text-zinc-300">Font Size</span>
                <input 
                  type="number" 
                  defaultValue={14}
                  min={10}
                  max={24}
                  className="w-16 px-2 py-1 text-xs bg-black/20 border border-white/[0.06] rounded text-zinc-200 text-center"
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                <span className="text-sm text-zinc-300">Font Family</span>
                <select 
                  className="px-2 py-1 text-xs bg-black/20 border border-white/[0.06] rounded text-zinc-200"
                  defaultValue="JetBrains Mono"
                >
                  <option value="JetBrains Mono">JetBrains Mono</option>
                  <option value="Fira Code">Fira Code</option>
                  <option value="SF Mono">SF Mono</option>
                </select>
              </div>
            </div>
          </div>

          {/* Terminal Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-zinc-400 uppercase tracking-wider">
              <TerminalIcon size={12} />
              <span>Terminal</span>
            </div>
            <div className="space-y-2">
              <label className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04] cursor-pointer">
                <span className="text-sm text-zinc-300">Scrollback Lines</span>
                <input 
                  type="number" 
                  defaultValue={10000}
                  min={1000}
                  max={100000}
                  step={1000}
                  className="w-20 px-2 py-1 text-xs bg-black/20 border border-white/[0.06] rounded text-zinc-200 text-center"
                />
              </label>
              <label className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04] cursor-pointer">
                <span className="text-sm text-zinc-300">Cursor Blink</span>
                <input 
                  type="checkbox" 
                  defaultChecked
                  className="w-4 h-4 rounded bg-black/20 border border-white/[0.06] checked:bg-mauve checked:border-mauve"
                />
              </label>
            </div>
          </div>

          {/* Coming Soon Notice */}
          <div className="text-center text-xs text-zinc-500 py-2">
            More settings coming soon...
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-white/[0.04] bg-white/[0.01]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm bg-mauve/20 text-mauve hover:bg-mauve/30 rounded transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default TerminalSettings;
