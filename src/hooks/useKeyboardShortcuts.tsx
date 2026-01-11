import { useEffect, useCallback } from 'react';
import { useSessionStore } from '../store';

interface UseKeyboardShortcutsOptions {
  onNewTab?: () => void;
}

/**
 * Global keyboard shortcuts for OxideTerm
 * 
 * - Cmd/Ctrl+T: New connection/tab
 * - Cmd/Ctrl+W: Close current tab
 * - Cmd/Ctrl+1-9: Switch to tab 1-9
 * - Cmd/Ctrl+Shift+[: Previous tab
 * - Cmd/Ctrl+Shift+]: Next tab
 * - Cmd/Ctrl+Tab: Cycle through tabs
 */
export function useKeyboardShortcuts({ onNewTab }: UseKeyboardShortcutsOptions = {}) {
  const tabs = useSessionStore((state) => state.tabs);
  const activeTabId = useSessionStore((state) => state.activeTabId);
  const setActiveTab = useSessionStore((state) => state.setActiveTab);
  const disconnect = useSessionStore((state) => state.disconnect);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Check for Cmd (Mac) or Ctrl (Windows/Linux)
    const isMod = e.metaKey || e.ctrlKey;
    if (!isMod) return;

    // Cmd/Ctrl+T: New tab
    if (e.key === 't' && !e.shiftKey) {
      e.preventDefault();
      onNewTab?.();
      return;
    }

    // Cmd/Ctrl+W: Close current tab
    if (e.key === 'w' && !e.shiftKey) {
      e.preventDefault();
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (activeTab) {
        disconnect(activeTab.sessionId);
      }
      return;
    }

    // Cmd/Ctrl+1-9: Switch to tab by index
    if (e.key >= '1' && e.key <= '9' && !e.shiftKey) {
      e.preventDefault();
      const index = parseInt(e.key, 10) - 1;
      if (index < tabs.length) {
        setActiveTab(tabs[index].id);
      }
      return;
    }

    // Cmd/Ctrl+Shift+[: Previous tab
    if (e.key === '[' && e.shiftKey) {
      e.preventDefault();
      const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
      if (currentIndex > 0) {
        setActiveTab(tabs[currentIndex - 1].id);
      } else if (tabs.length > 0) {
        // Wrap to last tab
        setActiveTab(tabs[tabs.length - 1].id);
      }
      return;
    }

    // Cmd/Ctrl+Shift+]: Next tab
    if (e.key === ']' && e.shiftKey) {
      e.preventDefault();
      const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
      if (currentIndex < tabs.length - 1) {
        setActiveTab(tabs[currentIndex + 1].id);
      } else if (tabs.length > 0) {
        // Wrap to first tab
        setActiveTab(tabs[0].id);
      }
      return;
    }

    // Cmd/Ctrl+Tab: Cycle through tabs
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
      const nextIndex = (currentIndex + 1) % tabs.length;
      if (tabs[nextIndex]) {
        setActiveTab(tabs[nextIndex].id);
      }
      return;
    }

    // Cmd/Ctrl+Shift+Tab: Reverse cycle through tabs
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
      if (tabs[prevIndex]) {
        setActiveTab(tabs[prevIndex].id);
      }
      return;
    }
  }, [tabs, activeTabId, setActiveTab, disconnect, onNewTab]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Display keyboard shortcut hints
 */
export function KeyboardShortcutsHelp() {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const mod = isMac ? '⌘' : 'Ctrl';

  const shortcuts = [
    { keys: `${mod}+T`, action: 'New connection' },
    { keys: `${mod}+W`, action: 'Close tab' },
    { keys: `${mod}+1-9`, action: 'Switch to tab' },
    { keys: `${mod}+[`, action: 'Previous tab' },
    { keys: `${mod}+]`, action: 'Next tab' },
    { keys: `${mod}+Tab`, action: 'Cycle tabs' },
  ];

  return (
    <div className="text-xs text-gray-500 space-y-1">
      {shortcuts.map(({ keys, action }) => (
        <div key={keys} className="flex justify-between">
          <span className="text-gray-400">{action}</span>
          <kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">{keys}</kbd>
        </div>
      ))}
    </div>
  );
}
