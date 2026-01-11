/**
 * Terminal Container with Instance Pooling
 * 
 * Key Features:
 * - xterm instances are kept alive using CSS visibility
 * - Tab switching doesn't destroy terminal state or scrollback
 * - Memory-efficient: only active terminal renders WebGL
 * - Stable WebSocket connections (no cleanup on re-render)
 * - SearchAddon for in-terminal search
 * - WebLinksAddon for clickable URLs
 * - Unicode11Addon for CJK/emoji support
 * - Dynamic theme switching
 */

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import '@xterm/xterm/css/xterm.css';

import { useSessionStore, useTabs } from '../store';
import { useTerminalConfig } from '../store/terminalConfigStore';
import { encodeFrame, FrameDecoder, dataFrame, resizeFrame, heartbeatFrame, MessageType } from '../lib/protocol';
import type { SessionInfo } from '../types';
import { TerminalContextMenu } from './TerminalContextMenu';
import { TerminalSearchBar } from './TerminalSearchBar';

// Store terminal instances globally to persist across re-renders
const terminalInstances = new Map<string, {
  terminal: Terminal;
  fitAddon: FitAddon;
  searchAddon: SearchAddon;
  webglAddon?: WebglAddon;
  webLinksAddon?: WebLinksAddon;
  unicodeAddon?: Unicode11Addon;
  ws?: WebSocket;
  decoder: FrameDecoder;
  inputDisposable?: { dispose: () => void };
}>();

interface TerminalContainerProps {
  className?: string;
}

export function TerminalContainer({ className = '' }: TerminalContainerProps) {
  const tabs = useTabs();
  const sessions = useSessionStore(state => state.sessions);
  const activeTabId = useSessionStore(state => state.activeTabId);
  const [searchVisible, setSearchVisible] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sessionId: string } | null>(null);

  // Get active session ID for search/context menu
  const activeTab = tabs.find(t => t.id === activeTabId);
  const activeSessionId = activeTab?.sessionId ?? null;

  // Close context menu on click elsewhere
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Global keyboard shortcuts for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'f') {
        e.preventDefault();
        setSearchVisible(v => !v);
      }
      if (e.key === 'Escape' && searchVisible) {
        setSearchVisible(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchVisible]);

  const handleContextMenu = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, sessionId });
  }, []);

  const handleSearch = useCallback((query: string, options: { caseSensitive: boolean; wholeWord: boolean; regex: boolean }) => {
    if (!activeSessionId) return;
    const instance = terminalInstances.get(activeSessionId);
    if (instance?.searchAddon) {
      instance.searchAddon.findNext(query, {
        caseSensitive: options.caseSensitive,
        wholeWord: options.wholeWord,
        regex: options.regex,
      });
    }
  }, [activeSessionId]);

  const handleSearchNext = useCallback(() => {
    if (!activeSessionId) return;
    const instance = terminalInstances.get(activeSessionId);
    instance?.searchAddon?.findNext('');
  }, [activeSessionId]);

  const handleSearchPrev = useCallback(() => {
    if (!activeSessionId) return;
    const instance = terminalInstances.get(activeSessionId);
    instance?.searchAddon?.findPrevious('');
  }, [activeSessionId]);

  const handleCloseSearch = useCallback(() => {
    setSearchVisible(false);
    // Clear search decorations
    if (activeSessionId) {
      const instance = terminalInstances.get(activeSessionId);
      instance?.searchAddon?.clearDecorations();
    }
  }, [activeSessionId]);

  return (
    <div className={`relative flex-1 ${className}`}>
      {/* Search Bar */}
      {searchVisible && (
        <TerminalSearchBar
          onSearch={handleSearch}
          onNext={handleSearchNext}
          onPrev={handleSearchPrev}
          onClose={handleCloseSearch}
        />
      )}

      {tabs.map(tab => {
        const session = sessions.get(tab.sessionId);
        if (!session) return null;

        return (
          <TerminalInstance
            key={session.id}
            session={session}
            isVisible={tab.id === activeTabId}
            onContextMenu={(e) => handleContextMenu(e, session.id)}
          />
        );
      })}

      {/* Context Menu */}
      {contextMenu && (
        <TerminalContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          sessionId={contextMenu.sessionId}
          onClose={() => setContextMenu(null)}
          onShowSearch={() => setSearchVisible(true)}
        />
      )}

      {/* Empty state */}
      {tabs.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          No active sessions
        </div>
      )}
    </div>
  );
}

interface TerminalInstanceProps {
  session: SessionInfo;
  isVisible: boolean;
  onContextMenu: (e: React.MouseEvent) => void;
}

function TerminalInstance({ session, isVisible, onContextMenu }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsConnectedRef = useRef(false);
  
  // Get terminal config - use shallow comparison to avoid infinite loop
  // getXtermOptions() returns a new object every call, so we select primitive values instead
  const themeId = useTerminalConfig(state => state.themeId);
  const fontFamily = useTerminalConfig(state => state.fontFamily);
  const fontSize = useTerminalConfig(state => state.fontSize);
  const lineHeight = useTerminalConfig(state => state.lineHeight);
  const letterSpacing = useTerminalConfig(state => state.letterSpacing);
  const cursorBlink = useTerminalConfig(state => state.cursorBlink);
  const cursorStyle = useTerminalConfig(state => state.cursorStyle);
  const cursorWidth = useTerminalConfig(state => state.cursorWidth);
  const scrollback = useTerminalConfig(state => state.scrollback);
  const linkHandler = useTerminalConfig(state => state.linkHandler);
  const getTheme = useTerminalConfig(state => state.getTheme);
  
  // Memoize terminal config to avoid re-creating object on every render
  const terminalConfig = useMemo(() => {
    const theme = getTheme();
    return {
      theme: {
        background: theme.background,
        foreground: theme.foreground,
        cursor: theme.cursor,
        cursorAccent: theme.cursorAccent,
        selectionBackground: theme.selectionBackground,
        selectionForeground: theme.selectionForeground,
        selectionInactiveBackground: theme.selectionInactiveBackground,
        black: theme.black,
        red: theme.red,
        green: theme.green,
        yellow: theme.yellow,
        blue: theme.blue,
        magenta: theme.magenta,
        cyan: theme.cyan,
        white: theme.white,
        brightBlack: theme.brightBlack,
        brightRed: theme.brightRed,
        brightGreen: theme.brightGreen,
        brightYellow: theme.brightYellow,
        brightBlue: theme.brightBlue,
        brightMagenta: theme.brightMagenta,
        brightCyan: theme.brightCyan,
        brightWhite: theme.brightWhite,
      },
      fontFamily,
      fontSize,
      lineHeight,
      letterSpacing,
      cursorBlink,
      cursorStyle,
      cursorWidth,
      scrollback,
      allowProposedApi: true,
    };
  }, [themeId, fontFamily, fontSize, lineHeight, letterSpacing, cursorBlink, cursorStyle, cursorWidth, scrollback, getTheme]);
  
  // Get store action directly to avoid dependency issues
  const updateSession = useSessionStore(state => state.updateSession);
  
  // Stable callback using ref pattern
  const sessionRef = useRef(session);
  sessionRef.current = session;
  
  const handleStatusChange = useCallback((status: SessionInfo['state'], error?: string) => {
    const currentSession = sessionRef.current;
    if (currentSession.state !== status) {
      updateSession({ ...currentSession, state: status, error });
    }
  }, [updateSession]);

  // Initialize terminal instance
  useEffect(() => {
    if (!containerRef.current) return;

    // Check if instance already exists
    let instance = terminalInstances.get(session.id);
    
    if (!instance) {
      console.log(`[Terminal] Creating new instance for session ${session.id}`);
      // Create new terminal with config
      const terminal = new Terminal({
        ...terminalConfig,
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      
      // Search addon
      const searchAddon = new SearchAddon();
      terminal.loadAddon(searchAddon);
      
      // Unicode 11 addon for CJK/emoji support
      const unicodeAddon = new Unicode11Addon();
      terminal.loadAddon(unicodeAddon);
      terminal.unicode.activeVersion = '11';
      
      terminal.open(containerRef.current);
      
      // WebLinks addon for clickable URLs
      let webLinksAddon: WebLinksAddon | undefined;
      if (linkHandler) {
        try {
          webLinksAddon = new WebLinksAddon((_, uri) => {
            // Open URL in default browser via Tauri
            window.open(uri, '_blank');
          });
          terminal.loadAddon(webLinksAddon);
        } catch (e) {
          console.warn('WebLinksAddon failed to load:', e);
        }
      }
      
      // Try WebGL, fallback to canvas
      let webglAddon: WebglAddon | undefined;
      try {
        webglAddon = new WebglAddon();
        terminal.loadAddon(webglAddon);
        webglAddon.onContextLoss(() => {
          console.warn('[Terminal] WebGL context lost, disposing addon');
          webglAddon?.dispose();
        });
      } catch (e) {
        console.warn('WebGL not available, using canvas renderer');
      }

      fitAddon.fit();

      instance = {
        terminal,
        fitAddon,
        searchAddon,
        webglAddon,
        webLinksAddon,
        unicodeAddon,
        decoder: new FrameDecoder(),
      };
      
      terminalInstances.set(session.id, instance);
      console.log(`[Terminal] Instance created for session ${session.id}`);
    } else if (!instance.terminal.element?.parentElement) {
      // Re-attach terminal to container
      console.log(`[Terminal] Re-attaching instance for session ${session.id}`);
      containerRef.current.appendChild(instance.terminal.element!);
    }
  }, [session.id, terminalConfig, linkHandler]);

  // Update theme when it changes
  useEffect(() => {
    const instance = terminalInstances.get(session.id);
    if (instance && terminalConfig.theme) {
      instance.terminal.options.theme = terminalConfig.theme;
    }
  }, [session.id, themeId, terminalConfig.theme]);

  // Update font when it changes
  useEffect(() => {
    const instance = terminalInstances.get(session.id);
    if (instance) {
      instance.terminal.options.fontSize = terminalConfig.fontSize;
      instance.terminal.options.fontFamily = terminalConfig.fontFamily;
      instance.fitAddon.fit();
    }
  }, [session.id, terminalConfig.fontSize, terminalConfig.fontFamily]);

  // Connect WebSocket when session is connected - STABLE dependencies only
  useEffect(() => {
    const instance = terminalInstances.get(session.id);
    
    // Skip if no instance, no URL, or not connected
    if (!instance || !session.ws_url || session.state !== 'connected') {
      return;
    }
    
    // Skip if already connected
    if (instance.ws?.readyState === WebSocket.OPEN || instance.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }
    
    // Prevent duplicate connections
    if (wsConnectedRef.current) {
      return;
    }
    wsConnectedRef.current = true;

    console.log(`[WS] Connecting to ${session.ws_url} for session ${session.id}`);
    const ws = new WebSocket(session.ws_url);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      console.log(`[WS] WebSocket connected for session ${session.id}`);
      
      // Send initial resize
      const { cols, rows } = instance.terminal;
      ws.send(encodeFrame(resizeFrame(cols, rows)));
      
      // Focus terminal
      instance.terminal.focus();
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        instance.decoder.feed(new Uint8Array(event.data));
        
        let frame;
        while ((frame = instance.decoder.decode()) !== null) {
          switch (frame.type) {
            case MessageType.Data:
              instance.terminal.write(frame.data);
              break;
            case MessageType.Heartbeat:
              // Echo heartbeat back
              ws.send(encodeFrame(heartbeatFrame(frame.seq)));
              break;
            case MessageType.Error:
              console.error('Server error:', frame.message);
              handleStatusChange('error', frame.message);
              break;
          }
        }
      }
    };

    ws.onclose = () => {
      console.log(`[WS] WebSocket closed for session ${session.id}`);
      wsConnectedRef.current = false;
      instance.ws = undefined;
      handleStatusChange('disconnected');
    };

    ws.onerror = (error) => {
      console.error(`[WS] WebSocket error for session ${session.id}:`, error);
      wsConnectedRef.current = false;
      handleStatusChange('error', 'WebSocket connection error');
    };

    instance.ws = ws;

    // Set up input handler (only once)
    if (instance.inputDisposable) {
      instance.inputDisposable.dispose();
    }
    instance.inputDisposable = instance.terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(encodeFrame(dataFrame(data)));
      }
    });

    // Cleanup only on unmount or session change - NOT on every render
    return () => {
      // Only cleanup if the session ID is actually changing
      // or component is truly unmounting
    };
  }, [session.id, session.ws_url, session.state, handleStatusChange]);

  // Handle resize
  useEffect(() => {
    const instance = terminalInstances.get(session.id);
    if (!instance || !isVisible) return;

    const handleResize = () => {
      instance.fitAddon.fit();
      
      if (instance.ws?.readyState === WebSocket.OPEN) {
        const { cols, rows } = instance.terminal;
        instance.ws.send(encodeFrame(resizeFrame(cols, rows)));
      }
    };

    // Debounce resize
    let resizeTimer: number;
    const debouncedResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(handleResize, 150);
    };

    window.addEventListener('resize', debouncedResize);
    
    // Initial fit when becoming visible
    handleResize();
    instance.terminal.focus();

    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(resizeTimer);
    };
  }, [isVisible, session.id]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    const sessionId = session.id;
    return () => {
      wsConnectedRef.current = false;
      const instance = terminalInstances.get(sessionId);
      if (instance?.ws?.readyState === WebSocket.OPEN) {
        instance.ws.close();
      }
    };
  }, [session.id]);

  // Handle click to focus terminal
  const handleClick = () => {
    const instance = terminalInstances.get(session.id);
    if (instance && isVisible) {
      instance.terminal.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      onContextMenu={onContextMenu}
      className={`
        absolute inset-0 
        ${isVisible ? 'visible' : 'invisible'}
      `}
      style={{ 
        // Use visibility instead of display to keep terminal rendered
        visibility: isVisible ? 'visible' : 'hidden',
        zIndex: isVisible ? 1 : 0,
      }}
    />
  );
}

// Cleanup function to remove terminal instance when session is removed
export function cleanupTerminalInstance(sessionId: string) {
  const instance = terminalInstances.get(sessionId);
  if (instance) {
    instance.ws?.close();
    instance.webglAddon?.dispose();
    instance.webLinksAddon?.dispose();
    instance.unicodeAddon?.dispose();
    instance.searchAddon?.dispose();
    instance.terminal.dispose();
    terminalInstances.delete(sessionId);
  }
}

// Export for external access (e.g., settings panel)
export function getTerminalInstance(sessionId: string) {
  return terminalInstances.get(sessionId);
}

export default TerminalContainer;
