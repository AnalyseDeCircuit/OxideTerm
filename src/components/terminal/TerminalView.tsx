import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useAppStore } from '../../store/appStore';
import { api } from '../../lib/api';

interface TerminalViewProps {
  sessionId: string;
  isActive?: boolean;
}

// Protocol Constants - Wire Protocol v1
// Frame Format: [Type: 1 byte][Length: 4 bytes big-endian][Payload: n bytes]
const MSG_TYPE_DATA = 0x00;
const MSG_TYPE_RESIZE = 0x01;
const MSG_TYPE_HEARTBEAT = 0x02;
const HEADER_SIZE = 5; // 1 byte type + 4 bytes length

// Helper function to encode a heartbeat response frame
const encodeHeartbeatFrame = (seq: number): Uint8Array => {
  const frame = new Uint8Array(HEADER_SIZE + 4); // 4 bytes for sequence number
  const view = new DataView(frame.buffer);
  view.setUint8(0, MSG_TYPE_HEARTBEAT);  // Type
  view.setUint32(1, 4, false);           // Length (4 bytes payload)
  view.setUint32(5, seq, false);         // Sequence number (big-endian)
  return frame;
};

// Helper function to encode a data frame
const encodeDataFrame = (payload: Uint8Array): Uint8Array => {
  const frame = new Uint8Array(HEADER_SIZE + payload.length);
  const view = new DataView(frame.buffer);
  view.setUint8(0, MSG_TYPE_DATA);           // Type
  view.setUint32(1, payload.length, false);  // Length (big-endian)
  frame.set(payload, HEADER_SIZE);           // Payload
  return frame;
};

// Helper function to encode a resize frame
const encodeResizeFrame = (cols: number, rows: number): Uint8Array => {
  const frame = new Uint8Array(HEADER_SIZE + 4); // 4 bytes for cols + rows
  const view = new DataView(frame.buffer);
  view.setUint8(0, MSG_TYPE_RESIZE);  // Type
  view.setUint32(1, 4, false);        // Length (4 bytes payload)
  view.setUint16(5, cols, false);     // Cols (big-endian)
  view.setUint16(7, rows, false);     // Rows (big-endian)
  return frame;
};

export const TerminalView: React.FC<TerminalViewProps> = ({ sessionId, isActive = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isMountedRef = useRef(true); // Track mount state for StrictMode
  
  const { getSession } = useAppStore();
  const session = getSession(sessionId);

  // Load Settings
  const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem('oxide-settings');
        return saved ? JSON.parse(saved) : {
            theme: 'default',
            fontFamily: 'jetbrains',
            fontSize: 14,
            cursorStyle: 'block',
            cursorBlink: true
        };
  });

  // Listen for settings changes
  useEffect(() => {
    const handleSettingsChange = (e: CustomEvent) => {
        setSettings(e.detail);
        if (terminalRef.current) {
            terminalRef.current.options.fontFamily = getFontFamily(e.detail.fontFamily);
            terminalRef.current.options.fontSize = e.detail.fontSize;
            terminalRef.current.options.cursorStyle = e.detail.cursorStyle;
            terminalRef.current.options.cursorBlink = e.detail.cursorBlink;
            terminalRef.current.refresh(0, terminalRef.current.rows - 1);
            fitAddonRef.current?.fit();
        }
    };
    window.addEventListener('settings-changed', handleSettingsChange as EventListener);
    return () => window.removeEventListener('settings-changed', handleSettingsChange as EventListener);
  }, []);

  // Focus terminal when it becomes active (tab switch)
  useEffect(() => {
    if (isActive && terminalRef.current) {
      // Small delay to ensure DOM is ready
      const focusTimeout = setTimeout(() => {
        terminalRef.current?.focus();
        fitAddonRef.current?.fit();
      }, 50);
      return () => clearTimeout(focusTimeout);
    }
  }, [isActive]);

  const getFontFamily = (val: string) => {
      switch(val) {
          case 'jetbrains': return '"JetBrains Mono", "SF Mono", monospace';
          case 'sfmono': return '"SF Mono", "Fira Code", monospace';
          case 'fira': return '"Fira Code", monospace';
          default: return 'monospace';
      }
  };

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;
    
    isMountedRef.current = true; // Reset mount state

    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: settings.cursorBlink,
      cursorStyle: settings.cursorStyle,
      fontFamily: getFontFamily(settings.fontFamily),
      fontSize: settings.fontSize,
      lineHeight: 1.2,
      theme: {
        background: '#09090b', // oxide-bg
        foreground: '#f4f4f5', // oxide-text
        cursor: '#ea580c',     // oxide-accent
        selectionBackground: 'rgba(234, 88, 12, 0.3)',
        black: '#09090b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#d946ef',
        cyan: '#06b6d4',
        white: '#f4f4f5',
        brightBlack: '#71717a',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#e879f9',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();
    
    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(webLinksAddon);

    // Try WebGL, fallback to canvas/dom if needed
    try {
        // Configure WebGL with explicit DPR for crisp HiDPI rendering
        const dpr = Math.ceil(window.devicePixelRatio || 1);
        const webglAddon = new WebglAddon();
        webglAddon.onContextLoss(() => {
            webglAddon.dispose();
        });
        term.loadAddon(webglAddon);
        console.log(`WebGL addon loaded with DPR: ${dpr}`);
    } catch (e) {
        console.warn("WebGL addon failed to load, falling back to canvas renderer", e);
    }

    term.open(containerRef.current);
    fitAddon.fit();
    term.focus(); // Focus immediately after opening

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln(`\x1b[32mInitialized OxideTerm v0.1\x1b[0m`);
    
    // Delay WebSocket connection to avoid React StrictMode double-mount issue
    let wsConnectTimeout: ReturnType<typeof setTimeout> | null = null;
    
    if (session?.ws_url) {
        const wsUrl = session.ws_url; // Capture to avoid undefined in closure
        term.writeln(`Connecting to ${session.username}@${session.host}...`);
        
        wsConnectTimeout = setTimeout(() => {
            if (!isMountedRef.current) return; // Check if still mounted after delay
            
            try {
                const ws = new WebSocket(wsUrl);
                ws.binaryType = 'arraybuffer';
                wsRef.current = ws;

                ws.onopen = () => {
                    if (!isMountedRef.current) {
                        ws.close();
                        return;
                    }
                    term.writeln("Connected.\r\n");
                    // Initial resize using Wire Protocol v1
                    const frame = encodeResizeFrame(term.cols, term.rows);
                    ws.send(frame);
                    // Focus terminal after connection
                    term.focus();
                };

                ws.onmessage = (event) => {
                    if (!isMountedRef.current) return;
                    const data = event.data;
                    if (data instanceof ArrayBuffer) {
                        // Parse Wire Protocol v1 frame: [Type: 1][Length: 4][Payload: n]
                        const view = new DataView(data);
                        if (data.byteLength < HEADER_SIZE) return;
                        
                        const type = view.getUint8(0);
                        const length = view.getUint32(1, false); // big-endian
                        
                        if (data.byteLength < HEADER_SIZE + length) return;
                        
                        if (type === MSG_TYPE_DATA) {
                            const payload = new Uint8Array(data, HEADER_SIZE, length);
                            term.write(payload);
                        } else if (type === MSG_TYPE_HEARTBEAT) {
                            // Heartbeat ping from server - respond with pong
                            if (length === 4) {
                                const seq = view.getUint32(HEADER_SIZE, false); // big-endian
                                const response = encodeHeartbeatFrame(seq);
                                ws.send(response);
                            }
                        }
                        // MSG_TYPE_ERROR (0x03) can be handled here if needed
                    }
                };

                ws.onclose = () => {
                    if (!isMountedRef.current) return;
                    term.writeln("\r\n\x1b[31mConnection closed.\x1b[0m");
                };

                ws.onerror = (e) => {
                    if (!isMountedRef.current) return;
                    term.writeln(`\r\n\x1b[31mWebSocket error: ${e}\x1b[0m`);
                };



            } catch (e) {
                term.writeln(`\r\n\x1b[31mFailed to establish WebSocket: ${e}\x1b[0m`);
            }
        }, 100); // 100ms delay to let StrictMode unmount/remount complete
    } else {
         term.writeln(`\x1b[33mNo WebSocket URL available for session.\x1b[0m`);
    }

    // Terminal Input -> WebSocket (registered outside setTimeout to work immediately)
    term.onData(data => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            // Encode as Wire Protocol v1 Data frame
            const encoder = new TextEncoder();
            const payload = encoder.encode(data);
            const frame = encodeDataFrame(payload);
            ws.send(frame);
        }
    });

    term.onResize((size) => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            // Send resize frame using Wire Protocol v1
            const frame = encodeResizeFrame(size.cols, size.rows);
            ws.send(frame);
            api.resizeSession(sessionId, size.cols, size.rows);
        }
    });

    // Handle Window Resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Initial fit
    setTimeout(() => {
        fitAddon.fit();
    }, 100);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('resize', handleResize);
      if (wsConnectTimeout) {
          clearTimeout(wsConnectTimeout);
      }
      if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
      }
      term.dispose();
      terminalRef.current = null;
    };
  }, [sessionId]); // Only re-mount if sessionId changes absolutely

  const handleContainerClick = () => {
    terminalRef.current?.focus();
  };

  return (
    <div 
      className="terminal-container h-full w-full bg-oxide-bg overflow-hidden" 
      style={{ padding: '4px' }}
      onClick={handleContainerClick}
    >
       <div 
         ref={containerRef} 
         className="h-full w-full"
         style={{
           contain: 'strict',
           isolation: 'isolate'
         }}
       />
    </div>
  );
};
