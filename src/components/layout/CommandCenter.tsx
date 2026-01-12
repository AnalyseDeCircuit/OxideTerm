/**
 * CommandCenter - Empty State
 *
 * Modern, clean empty state for when no terminals are open.
 * Warp-inspired minimal design.
 */

import React from 'react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';

interface CommandCenterProps {
  onNewConnection: () => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({ onNewConnection }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-base select-none">
      {/* Main Container */}
      <div className="w-full max-w-2xl mx-auto px-6 flex flex-col items-center justify-center">
        {/* Logo/Title */}
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-4xl font-bold text-text tracking-tight mb-1">
            OxideTerm
          </h1>
          <p className="text-sm text-subtext-0">
            Your modern SSH terminal
          </p>
        </div>

        {/* Main CTA Button */}
        <Button
          variant="primary"
          size="lg"
          onClick={onNewConnection}
          className="mb-6 w-full max-w-xs"
        >
          New Connection
        </Button>

        {/* Keyboard shortcuts */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-md">
          <ShortcutCard
            shortcut="⌘K"
            label="Command Palette"
            description="Quick access to everything"
          />
          <ShortcutCard
            shortcut="⌘N"
            label="New Tab"
            description="Create a new session"
          />
          <ShortcutCard
            shortcut="⌘B"
            label="Toggle Sidebar"
            description="Show/hide connections"
          />
          <ShortcutCard
            shortcut="⌘,"
            label="Settings"
            description="Configure preferences"
          />
        </div>

        {/* Footer info */}
        <div className="mt-12 text-xs text-subtext-1">
          <p>Press <kbd className="px-1.5 py-0.5 bg-ui-surface-bg border border-glass-border rounded text-subtext-0">?</kbd> for help</p>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Shortcut Card Component
// ============================================

interface ShortcutCardProps {
  shortcut: string;
  label: string;
  description: string;
}

const ShortcutCard: React.FC<ShortcutCardProps> = ({ shortcut, label, description }) => {
  return (
    <div
      className={cn(
        'flex flex-col items-start p-4',
        'bg-ui-surface-bg border border-glass-border rounded-lg',
        'hover:bg-ui-surface-hover hover:border-surface-1',
        'transition-all duration-200'
      )}
    >
      <div className="flex items-center gap-3 w-full">
        <kbd
          className={cn(
            'px-2 py-1 text-xs font-medium',
            'bg-surface-0 border border-glass-border rounded-md',
            'text-subtext-0'
          )}
        >
          {shortcut}
        </kbd>
        <div className="flex-1">
          <div className="text-sm font-medium text-text">{label}</div>
          <div className="text-xs text-subtext-0">{description}</div>
        </div>
      </div>
    </div>
  );
};
