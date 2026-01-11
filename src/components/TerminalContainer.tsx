/**
 * Terminal Container with Instance Pooling
 * 
 * Key Features:
 * - xterm instances are kept alive using CSS visibility
 * - Tab switching doesn't destroy terminal state or scrollback
 * - Memory-efficient: only active terminal renders WebGL
 */

import { useRef, useEffect } from 'react';
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
}>();

interface TerminalContainerProps {
  className?: string;
}

export function TerminalContainer({ className = '' }: TerminalContainerProps) {
  const tabs = useTabs();
  const sessions = useSessionStoreV2(state => state.sessions);
  const activeTabId = useSessionStoreV2(state => state.activeTabId);
  const updateSession = useSessionStoreV2(state => state.updateSession);

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
            onStatusChange={(status, error) => {
              if (session.state !== status) {
                updateSession({ ...session, state: status, error });
              }
            }}
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
  onStatusChange: (status: SessionInfo['state'], error?: string) => void;
}

function TerminalInstance({ session, isVisible, onStatusChange }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef(terminalInstances.get(session.id));

  // Initialize terminal instance
  useEffect(() => {
    if (!containerRef.current) return;

    // Check if instance already exists
    let instance = terminalInstances.get(session.id);
    
    if (!instance) {
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
    } else if (!instance.terminal.element?.parentElement) {
      // Re-attach terminal to container
      containerRef.current.appendChild(instance.terminal.element!);
    }

    instanceRef.current = instance;
  }, [session.id]);

  // Connect WebSocket when session is connected
  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !session.ws_url || session.state !== 'connected') return;
    if (instance.ws?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(session.ws_url);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      console.log(`WebSocket connected for session ${session.id}`);
      
      // Send initial resize
      const { cols, rows } = instance.terminal;
      ws.send(encodeFrame(resizeFrame(cols, rows)));
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
              onStatusChange('error', frame.message);
              break;
          }
        }
      }
    };

    ws.onclose = () => {
      console.log(`WebSocket closed for session ${session.id}`);
      onStatusChange('disconnected');
    };

    ws.onerror = (error) => {
      console.error(`WebSocket error for session ${session.id}:`, error);
      onStatusChange('error', 'WebSocket connection error');
    };

    instance.ws = ws;

    // Set up input handler
    const inputDisposable = instance.terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(encodeFrame(dataFrame(data)));
      }
    });

    return () => {
      inputDisposable.dispose();
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [session.id, session.ws_url, session.state, onStatusChange]);

  // Handle resize
  useEffect(() => {
    const instance = instanceRef.current;
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
  }, [isVisible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't destroy instance - keep it for potential reactivation
      // Instance cleanup happens when session is removed from store
    };
  }, []);

  return (
    <div
      ref={containerRef}
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
