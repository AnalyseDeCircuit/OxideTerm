/**
 * Terminal Context Menu Component
 * 
 * Right-click menu for terminal operations:
 * - Copy selection
 * - Paste from clipboard
 * - Search
 * - Clear terminal
 * - Select all
 */

import { useCallback, useEffect, useRef } from 'react';
import { getTerminalInstance } from './TerminalContainer';

interface TerminalContextMenuProps {
  x: number;
  y: number;
  sessionId: string;
  onClose: () => void;
  onShowSearch: () => void;
}

export function TerminalContextMenu({ x, y, sessionId, onClose, onShowSearch }: TerminalContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (rect.right > viewportWidth) {
        menuRef.current.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > viewportHeight) {
        menuRef.current.style.top = `${y - rect.height}px`;
      }
    }
  }, [x, y]);

  const handleCopy = useCallback(async () => {
    const instance = getTerminalInstance(sessionId);
    if (instance) {
      const selection = instance.terminal.getSelection();
      if (selection) {
        await navigator.clipboard.writeText(selection);
      }
    }
    onClose();
  }, [sessionId, onClose]);

  const handlePaste = useCallback(async () => {
    const instance = getTerminalInstance(sessionId);
    if (instance && instance.ws?.readyState === WebSocket.OPEN) {
      try {
        const text = await navigator.clipboard.readText();
        // Send pasted text through WebSocket
        const { encodeFrame, dataFrame } = await import('../lib/protocol');
        instance.ws.send(encodeFrame(dataFrame(text)));
      } catch (err) {
        console.error('Failed to paste:', err);
      }
    }
    onClose();
  }, [sessionId, onClose]);

  const handleClear = useCallback(() => {
    const instance = getTerminalInstance(sessionId);
    if (instance) {
      instance.terminal.clear();
    }
    onClose();
  }, [sessionId, onClose]);

  const handleSelectAll = useCallback(() => {
    const instance = getTerminalInstance(sessionId);
    if (instance) {
      instance.terminal.selectAll();
    }
    onClose();
  }, [sessionId, onClose]);

  const handleSearch = useCallback(() => {
    onShowSearch();
    onClose();
  }, [onShowSearch, onClose]);

  const instance = getTerminalInstance(sessionId);
  const hasSelection = instance ? instance.terminal.getSelection().length > 0 : false;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[180px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <MenuItem
        icon="📋"
        label="Copy"
        shortcut="⌘C"
        onClick={handleCopy}
        disabled={!hasSelection}
      />
      <MenuItem
        icon="📥"
        label="Paste"
        shortcut="⌘V"
        onClick={handlePaste}
      />
      <Divider />
      <MenuItem
        icon="🔍"
        label="Search"
        shortcut="⌘F"
        onClick={handleSearch}
      />
      <MenuItem
        icon="📑"
        label="Select All"
        shortcut="⌘A"
        onClick={handleSelectAll}
      />
      <Divider />
      <MenuItem
        icon="🧹"
        label="Clear Terminal"
        shortcut="⌘K"
        onClick={handleClear}
      />
    </div>
  );
}

interface MenuItemProps {
  icon: string;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
}

function MenuItem({ icon, label, shortcut, onClick, disabled }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full flex items-center gap-3 px-3 py-2 text-sm text-left
        ${disabled 
          ? 'text-gray-500 cursor-not-allowed' 
          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
        }
      `}
    >
      <span className="w-5 text-center">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-xs text-gray-500">{shortcut}</span>
      )}
    </button>
  );
}

function Divider() {
  return <div className="my-1 border-t border-gray-700" />;
}
