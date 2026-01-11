/**
 * Terminal Settings Panel
 * 
 * Modal for configuring terminal appearance:
 * - Theme selection with preview
 * - Font family and size
 * - Cursor style
 * - Scrollback buffer
 */

import { useState } from 'react';
import { useTerminalConfig } from '../store/terminalConfigStore';
import { themes, fontFamilies, fontSizes, scrollbackOptions } from '../lib/themes';

interface TerminalSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TerminalSettings({ isOpen, onClose }: TerminalSettingsProps) {
  const config = useTerminalConfig();
  const [activeTab, setActiveTab] = useState<'appearance' | 'behavior'>('appearance');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">⚙️ Terminal Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <TabButton
            active={activeTab === 'appearance'}
            onClick={() => setActiveTab('appearance')}
          >
            🎨 Appearance
          </TabButton>
          <TabButton
            active={activeTab === 'behavior'}
            onClick={() => setActiveTab('behavior')}
          >
            ⚡ Behavior
          </TabButton>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-130px)]">
          {activeTab === 'appearance' && <AppearanceSettings />}
          {activeTab === 'behavior' && <BehaviorSettings />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 bg-gray-900/50">
          <button
            onClick={() => config.reset()}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white"
          >
            Reset to Defaults
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function AppearanceSettings() {
  const { themeId, setTheme, fontFamily, setFontFamily, fontSize, setFontSize, scrollback, setScrollback } = useTerminalConfig();

  return (
    <div className="space-y-6">
      {/* Theme Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Color Theme</label>
        <div className="grid grid-cols-3 gap-3">
          {themes.map(theme => (
            <button
              key={theme.id}
              onClick={() => setTheme(theme.id)}
              className={`
                p-3 rounded-lg border-2 transition-all text-left
                ${themeId === theme.id 
                  ? 'border-blue-500 bg-blue-500/10' 
                  : 'border-gray-700 hover:border-gray-600'
                }
              `}
            >
              {/* Theme Preview */}
              <div 
                className="h-16 rounded mb-2 overflow-hidden font-mono text-xs p-2"
                style={{ 
                  backgroundColor: theme.background, 
                  color: theme.foreground 
                }}
              >
                <div style={{ color: theme.green }}>$ npm run dev</div>
                <div style={{ color: theme.cyan }}>→ Server running</div>
                <div style={{ color: theme.yellow }}>⚠ Warning</div>
              </div>
              <div className="text-sm text-white font-medium">{theme.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Font Family */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Font Family</label>
        <select
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          {fontFamilies.map(font => (
            <option key={font.id} value={font.value}>
              {font.name}
            </option>
          ))}
        </select>
      </div>

      {/* Font Size */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Font Size: {fontSize}px
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="10"
            max="24"
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value))}
            className="flex-1 accent-blue-500"
          />
          <div className="flex gap-1">
            {fontSizes.slice(0, 5).map(size => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                className={`
                  px-2 py-1 text-xs rounded
                  ${fontSize === size 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }
                `}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollback Buffer */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Scrollback Buffer</label>
        <select
          value={scrollback}
          onChange={(e) => setScrollback(parseInt(e.target.value))}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          {scrollbackOptions.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Higher values use more memory. Default is 10,000 lines.
        </p>
      </div>
    </div>
  );
}

function BehaviorSettings() {
  const { 
    cursorBlink, setCursorBlink,
    cursorStyle, setCursorStyle,
    bellStyle, setBellStyle,
    linkHandler, setLinkHandler,
    macOptionIsMeta, setMacOptionIsMeta,
  } = useTerminalConfig();

  return (
    <div className="space-y-6">
      {/* Cursor Style */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Cursor Style</label>
        <div className="flex gap-2">
          {(['block', 'underline', 'bar'] as const).map(style => (
            <button
              key={style}
              onClick={() => setCursorStyle(style)}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${cursorStyle === style 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }
              `}
            >
              {style.charAt(0).toUpperCase() + style.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Cursor Blink */}
      <ToggleOption
        label="Cursor Blink"
        description="Animate the terminal cursor"
        checked={cursorBlink}
        onChange={setCursorBlink}
      />

      {/* Link Handler */}
      <ToggleOption
        label="Clickable Links"
        description="URLs in terminal output become clickable (Cmd+Click)"
        checked={linkHandler}
        onChange={setLinkHandler}
      />

      {/* macOS Option Key */}
      <ToggleOption
        label="Option as Meta Key"
        description="Use Option key as Meta (for Emacs keybindings)"
        checked={macOptionIsMeta}
        onChange={setMacOptionIsMeta}
      />

      {/* Bell Style */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Bell Notification</label>
        <div className="flex gap-2">
          {(['none', 'sound', 'visual', 'both'] as const).map(style => (
            <button
              key={style}
              onClick={() => setBellStyle(style)}
              className={`
                px-3 py-2 rounded-lg text-sm transition-colors
                ${bellStyle === style 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }
              `}
            >
              {style.charAt(0).toUpperCase() + style.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ToggleOptionProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleOption({ label, description, checked, onChange }: ToggleOptionProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`
          relative w-11 h-6 rounded-full transition-colors
          ${checked ? 'bg-blue-600' : 'bg-gray-600'}
        `}
      >
        <div
          className={`
            absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
            ${checked ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        px-6 py-3 text-sm font-medium transition-colors
        ${active 
          ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800/50' 
          : 'text-gray-500 hover:text-gray-300'
        }
      `}
    >
      {children}
    </button>
  );
}
