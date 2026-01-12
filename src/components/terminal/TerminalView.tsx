/**
 * TerminalView Component (Refactored)
 * 
 * Wrapper around xterm.js terminal with proper layout integration.
 * Handles single terminal instance display and interactions.
 */

import { cn } from '@/lib/cn';

interface TerminalViewProps {
  sessionId: string;
  isActive: boolean;
  className?: string;
}

/**
 * TerminalView is a lightweight wrapper for the terminal container.
 * The actual xterm.js instance management is handled by TerminalContainer.
 * This component provides the layout slot for a terminal.
 */
export function TerminalView({
  sessionId,
  isActive,
  className,
}: TerminalViewProps) {
  return (
    <div
      id={`terminal-${sessionId}`}
      className={cn(
        'w-full h-full',
        'bg-base',
        // Active terminal is visible, inactive is hidden but preserved
        isActive ? 'block' : 'hidden',
        className
      )}
      data-session-id={sessionId}
    />
  );
}

/**
 * TerminalPlaceholder shown when no terminal is active
 */
export function TerminalPlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center h-full',
        'bg-base text-overlay-1',
        className
      )}
    >
      <div className="text-4xl mb-4">⚡</div>
      <h2 className="text-lg font-medium text-text mb-2">OxideTerm</h2>
      <p className="text-sm text-overlay-1 mb-4">No active session</p>
      <div className="flex items-center gap-2 text-xs text-overlay-0">
        <kbd className="px-1.5 py-0.5 rounded bg-surface-0">⌘N</kbd>
        <span>New connection</span>
        <span className="mx-2">•</span>
        <kbd className="px-1.5 py-0.5 rounded bg-surface-0">⌘K</kbd>
        <span>Command palette</span>
      </div>
    </div>
  );
}
