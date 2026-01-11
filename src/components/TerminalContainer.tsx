/**
 * Terminal Container with Instance Pooling
 * 
 * Key Features:
 * - xterm instances are kept alive using CSS visibility
 * - Tab switching doesn't destroy terminal state or scrollback
 * - Memory-efficient: only active terminal renders WebGL
 * - Stable WebSocket connections (no cleanup on re-render)
 */

import { useRef, useEffect, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';

import { useSessionStoreV2, useTabs } from '../store';
import { encodeFrame, FrameDecoder, dataFrame, resizeFrame, heartbeatFrame, MessageType } from '../lib/protocol';
import type { SessionInfo } from '../types';

// Store terminal instances globally to persist across re-renders
const terminalInstances = new Map<string, {
  terminal: Terminal;
  fitAddon: FitAddon;
  webglAddon?: WebglAddon;
  ws?: WebSocket;
  decoder: FrameDecoder;
  inputDisposable?: { dispose: () => void };
}>();

interface TerminalContainerProps {
  className?: string;
}

export function TerminalContainer({ className = '' }: TerminalContainerProps) {
  const tabs = useTabs();
  const sessions = useSessionStoreV2(state => state.sessions);
  const activeTabId = useSessionStoreV2(state => state.activeTabId);

  return (
    <div className={`relative flex-1 ${className}`}>
      {tabs.map(tab => {
        const session = sessions.get(tab.sessionId);
        if (!session) return null;

        return (
          <TerminalInstance
            key={session.id}
            session={session}
            isVisible={tab.id === activeTabId}
          />
        );
      })}

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
}

function TerminalInstance({ session, isVisible }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsConnectedRef = useRef(false);
  
  // Get store action directly to avoid dependency issues
  const updateSession = useSessionStoreV2(state => state.updateSession);
  
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
      // Create new terminal
      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
        theme: {
          background: '#1a1a2e',
          foreground: '#eaeaea',
          cursor: '#f8f8f2',
          selectionBackground: 'rgba(248, 248, 242, 0.3)',
        },
        scrollback: 10000,
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      
      terminal.open(containerRef.current);
      
      // Try WebGL, fallback to canvas
      let webglAddon: WebglAddon | undefined;
      try {
        webglAddon = new WebglAddon();
        terminal.loadAddon(webglAddon);
        webglAddon.onContextLoss(() => {
          webglAddon?.dispose();
        });
      } catch (e) {
        console.warn('WebGL not available, using canvas renderer');
      }

      fitAddon.fit();

      instance = {
        terminal,
        fitAddon,
        webglAddon,
        decoder: new FrameDecoder(),
      };
      
      terminalInstances.set(session.id, instance);
      console.log(`[Terminal] Instance created for session ${session.id}`);
    } else if (!instance.terminal.element?.parentElement) {
      // Re-attach terminal to container
      console.log(`[Terminal] Re-attaching instance for session ${session.id}`);
      containerRef.current.appendChild(instance.terminal.element!);
    }
  }, [session.id]);

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
    instance.terminal.dispose();
    terminalInstances.delete(sessionId);
  }
}

export default TerminalContainer;
